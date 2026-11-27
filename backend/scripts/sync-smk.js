import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import sequelize from '../config/db.js'
import Artwork from '../models/Artwork.js'
import SyncLog from '../models/SyncLog.js'

const SMK_API_BASE = process.env.SMK_API_BASE || 'https://api.smk.dk/api/v1/art/search/'
const ROWS_PER_PAGE = parseInt(process.env.SMK_ROWS_PER_PAGE || '1000', 10)
const RATE_LIMIT_MS = parseInt(process.env.SMK_RATE_LIMIT_MS || '500', 10)

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
  if (Array.isArray(val)) {
    val = val.flat(Infinity)
    return val.map(item => {
      if (typeof item === 'object' && item !== null) {
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
  let imagesDownloaded = 0
  let hasMore = true
  let offset = 0
  const allRecords = [] // Collect all sanitized records in memory
  const imageRequests = [] // Queue for batch image download

  console.log('Starting SMK API sync...')
  console.log(`API Base: ${SMK_API_BASE}`)
  console.log(`Rows per page: ${ROWS_PER_PAGE}`)

  await sequelize.authenticate()
  console.log('Connected to MySQL successfully.')

  const startTime = Date.now()

  // ── Phase 1: Fetch all records from SMK API ──
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

      // Truncate title to fit column
      let titles = (item.titles?.[0]?.title || 'Untitled').substring(0, 2000)
      let artistVal = sanitize(item.artist) || null
      const year = sanitize(item.year_of_publication) || null

      const descriptionEn = sanitize(item.descriptions?.en || item.description_en || null)
      const descriptionDa = sanitize(item.descriptions?.da || item.description_da || null)
      const webUrl = sanitize(item.frontend_url) || null
      const onDisplay = item.on_display ?? null
      const locationName = sanitize(item.current_location_name) || null
      const imageThumbnailUrl = sanitize(item.image_thumbnail) || null

      allRecords.push({ smkId, title: titles, artist: artistVal, year, description_en: descriptionEn, description_da: descriptionDa, web_url: webUrl, on_display: onDisplay, current_location_name: locationName, last_synced_at: new Date() })

      if (imageThumbnailUrl && imageThumbnailUrl.startsWith('http')) {
        imageRequests.push({ smkId, url: imageThumbnailUrl })
      }
    }

    offset += ROWS_PER_PAGE

    // Rate limit
    if (items.length >= ROWS_PER_PAGE) {
      await sleep(RATE_LIMIT_MS)
    }

    console.log(`  Processed ${totalFetched} records so far...`)
  }

  console.log(`\nFetched ${totalFetched} total records. Bulk upserting...`)

  // ── Phase 2: Single bulk upsert ──
  const upsertFields = ['title', 'artist', 'year', 'description_en', 'description_da', 'web_url', 'on_display', 'current_location_name', 'last_synced_at']
  await Artwork.bulkCreate(allRecords, {
    updateOnDuplicate: upsertFields
  })
  console.log(`Bulk upsert complete. ${allRecords.length} records processed.`)

  // ── Phase 3: Batch image downloads ──
  const BATCH_SIZE = parseInt(process.env.IMAGE_BATCH_SIZE || '20', 10)
  const MAX_RETRIES = 3

  console.log(`Downloading ${imageRequests.length} images in batches of ${BATCH_SIZE}...`)

  for (let i = 0; i < imageRequests.length; i += BATCH_SIZE) {
    const batch = imageRequests.slice(i, i + BATCH_SIZE)
    console.log(`  Downloading images ${i + 1}–${Math.min(i + BATCH_SIZE, imageRequests.length)}/${imageRequests.length}...`)

    await Promise.allSettled(batch.map(async ({ smkId, url }) => {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const imageBuffer = await downloadImage(url)
          if (imageBuffer && imageBuffer.length > 0) {
            await Artwork.update({ image_data: imageBuffer }, { where: { smk_id: smkId } })
            imagesDownloaded++
            break
          }
        } catch (imgErr) {
          if (attempt < MAX_RETRIES) {
            const waitMs = Math.pow(2, attempt) * 1000
            console.log(`    Retry ${attempt}/${MAX_RETRIES} for ${smkId}`)
            await sleep(waitMs)
          } else {
            console.warn(`  Failed to download image for ${smkId} after ${MAX_RETRIES} attempts:`, imgErr.message)
          }
        }
      }
    }))

    if (i + BATCH_SIZE < imageRequests.length) {
      await sleep(200)
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
