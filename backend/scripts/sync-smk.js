import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import sequelize from '../config/db.js'
import Artwork from '../models/Artwork.js'
import SyncLog from '../models/SyncLog.js'
import { Op } from 'sequelize'

const SMK_API_BASE = process.env.SMK_API_BASE || 'https://api.smk.dk/api/v1/art/search/'
const ROWS_PER_PAGE = parseInt(process.env.SMK_ROWS_PER_PAGE || '1000', 10)
const RATE_LIMIT_MS = 500 // ~120 req/min to avoid SMK API drops

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function downloadImage(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    return buffer
  } catch {
    return null
  }
}

// Recursively flatten arrays/objects to a string for DB storage
function sanitize(val) {
  if (val == null) return null
  // Handle double-nested arrays from SMK API: [[{name:'A'}, {name:'B'}]]
  if (Array.isArray(val)) {
    val = val.flat(Infinity) // flatten any depth
    return val.map(item => {
      if (typeof item === 'object' && item !== null) {
        // Extract name/artist/display from objects
        return item.name || item.artist || item.title || item.display || ''
      }
      return String(item)
    }).filter(Boolean).join('; ') || null
  }
  if (typeof val === 'object') {
    return val.name || val.artist || val.title || val.display || null
  }
  return String(val) || null
}

async function syncFromSmkApi() {
  let totalFetched = 0
  let upserted = 0
  let imagesDownloaded = 0
  let hasMore = true
  let offset = 0
  const pendingImages = [] // Queue for batch image download

  console.log('Starting SMK API sync...')
  console.log(`API Base: ${SMK_API_BASE}`)
  console.log(`Rows per page: ${ROWS_PER_PAGE}`)

  await sequelize.authenticate()
  console.log('Connected to MySQL successfully.')

  const startTime = Date.now()

  while (hasMore) {
    const url = `${SMK_API_BASE}?keys=*&offset=${offset}&rows=${ROWS_PER_PAGE}`
    console.log(`Fetching offset ${offset}...`)

    let response
    let fetchOk = false
    for (let attempt = 1; attempt <= 5 && !fetchOk; attempt++) {
      try {
        response = await fetch(url)
        if (response.ok) fetchOk = true
        else {
          console.warn(`  API returned status ${response.status}, retry ${attempt}/5...`)
          await sleep(2000 * attempt)
        }
      } catch (err) {
        console.warn(`  Fetch error: ${err.message}, retry ${attempt}/5...`)
        await sleep(2000 * attempt)
      }
    }
    if (!fetchOk) {
      return { success: false, count: totalFetched, error: `SMK API fetch failed after 5 retries` }
    }

    let data
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        data = await response.json()
        break
      } catch {
        console.warn(`  JSON parse error, retry ${attempt}/3...`)
        await sleep(1000)
      }
    }
    if (!data) return { success: false, count: totalFetched, error: 'Failed to parse SMK API response' }
    const items = data.items || []

    if (items.length === 0) {
      hasMore = false
      break
    }

    for (const item of items) {
      totalFetched++

      const smkId = item.object_number || `KMS${item.id}`
      // Truncate title to fit column — SMK API sometimes returns long descriptions as titles
      let titles = (item.titles?.[0]?.title || 'Untitled').substring(0, 2000)
      let artistVal = sanitize(item.artist) || null
      const year = sanitize(item.year_of_publication) || null

      const descriptionEn = sanitize(item.descriptions?.en || item.description_en || null)
      const descriptionDa = sanitize(item.descriptions?.da || item.description_da || null)
      const webUrl = sanitize(item.frontend_url) || null
      const onDisplay = item.on_display ?? null
      const locationName = sanitize(item.current_location_name) || null
      const imageThumbnailUrl = sanitize(item.image_thumbnail) || null

      // Upsert artwork — await the .then() to serialize DB operations
      await Artwork.findOrCreate({
        where: { smk_id: smkId },
        defaults: {
          title: titles,
          artist: artistVal,
          year,
          description_en: descriptionEn,
          description_da: descriptionDa,
          web_url: webUrl,
          on_display: onDisplay,
          current_location_name: locationName,
          last_synced_at: new Date()
        }
      }).then(async ([artwork, created]) => {
        if (!created) {
          // Update existing record — catch errors so one bad row doesn't crash the sync
          try {
            await Artwork.update({
              title: titles, artist: artistVal, year,
              description_en: descriptionEn, description_da: descriptionDa,
              web_url: webUrl, on_display: onDisplay, current_location_name: locationName,
              last_synced_at: new Date()
            }, { where: { smk_id: smkId } })
          } catch (updateErr) {
            console.error(`Error updating artwork ${smkId}:`, updateErr.message)
          }
        }
        upserted++

        // Queue images for later batch download
        if (imageThumbnailUrl && imageThumbnailUrl.startsWith('http')) {
          pendingImages.push({ smkId, url: imageThumbnailUrl })
        }
      }).catch(err => {
        console.error(`Error processing artwork ${smkId}:`, err.message)
      })
    }

    offset += ROWS_PER_PAGE

    // Rate limit: sleep between batches
    if (hasMore && items.length >= ROWS_PER_PAGE) {
      await sleep(RATE_LIMIT_MS)
    }

    // Save progress every batch for resume support
    console.log(`  Processed ${totalFetched} records so far...`)
  }

  console.log(`\nUpserted ${upserted} artworks. Downloading ${pendingImages.length} images in batches...`)

  // Batch image download — process 5 at a time with retries to avoid overwhelming the network
  const BATCH_SIZE = 5
  const MAX_RETRIES = 3

  for (let i = 0; i < pendingImages.length; i += BATCH_SIZE) {
    const batch = pendingImages.slice(i, i + BATCH_SIZE)
    console.log(`  Downloading images ${i + 1}–${Math.min(i + BATCH_SIZE, pendingImages.length)}/${pendingImages.length}...`)

    await Promise.allSettled(batch.map(async ({ smkId, url }) => {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const imageBuffer = await downloadImage(url)
          if (imageBuffer && imageBuffer.length > 0) {
            await Artwork.update({ image_data: imageBuffer }, { where: { smk_id: smkId } })
            imagesDownloaded++
            break // success, move to next image
          }
        } catch (imgErr) {
          if (attempt < MAX_RETRIES) {
            const waitMs = Math.pow(2, attempt) * 1000
            console.log(`    Retry ${attempt}/${MAX_RETRIES} for ${smkId} after ${waitMs}ms`)
            await sleep(waitMs)
          } else {
            console.warn(`  Failed to download image for ${smkId} after ${MAX_RETRIES} attempts:`, imgErr.message)
          }
        }
      }
    }))

    // Delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < pendingImages.length) {
      await sleep(1000)
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  // Update SyncLog
  await SyncLog.create({
    last_sync_at: new Date(),
    status: 'success',
    records_fetched: totalFetched,
    error_message: null
  })

  console.log(`\nSync complete in ${elapsed}s`)
  console.log(`  Total fetched: ${totalFetched}`)
  console.log(`  Upserted: ${upserted}`)
  console.log(`  Images downloaded: ${imagesDownloaded}`)

  return { success: true, count: totalFetched }
}

// Run if called directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  syncFromSmkApi()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Sync failed:', err.message)
      SyncLog.create({
        last_sync_at: new Date(),
        status: 'error',
        records_fetched: 0,
        error_message: err.message
      }).finally(() => process.exit(1))
    })
}

export { syncFromSmkApi }
