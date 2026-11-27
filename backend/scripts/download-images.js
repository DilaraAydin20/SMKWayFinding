import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import sequelize from '../config/db.js'
import Artwork from '../models/Artwork.js'
import SyncLog from '../models/SyncLog.js'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function downloadImage(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length === 0) return null
    return buffer
  } catch {
    return null
  }
}

async function downloadMissingImages() {
  const CONCURRENCY = parseInt(process.env.IMAGE_CONCURRENCY || '50', 10)
  const MAX_RETRIES = 3
  const BATCH_SIZE = parseInt(process.env.IMAGE_DOWNLOAD_BATCH_SIZE || '200', 10)

  console.log('Starting image download for artworks missing images...')
  console.log(`Concurrency: ${CONCURRENCY}, Batch size: ${BATCH_SIZE}`)

  await sequelize.authenticate()
  console.log('Connected to MySQL successfully.')

  const startTime = Date.now()

  // Fetch all artworks that don't have image_data yet
  let artworks = await Artwork.findAll({
    attributes: ['smk_id', 'title'],
    where: {
      image_data: null
    },
    order: sequelize.literal('RAND()') // random order to avoid hotspots
  })

  console.log(`Found ${artworks.length} artworks without images.`)

  if (artworks.length === 0) {
    console.log('All artworks already have images. Nothing to do.')
    return { success: true, count: 0 }
  }

  const SMK_API_BASE = process.env.SMK_API_BASE || 'https://api.smk.dk/api/v1/art/search/'

  // Fetch thumbnail URLs from SMK API for these artworks
  const smkIds = artworks.map(a => a.smk_id)
  console.log(`Fetching thumbnail URLs from SMK API...`)

  // Query SMK API in chunks to get thumbnail URLs
  const artworkUrls = new Map() // smkId -> thumbnailUrl
  let hasMore = true
  let offset = 0

  while (hasMore && artworkUrls.size < smkIds.length) {
    const url = `${SMK_API_BASE}?keys=*&offset=${offset}&rows=1000`
    try {
      const response = await fetch(url)
      if (!response.ok) {
        console.warn(`  API returned ${response.status}, skipping...`)
        hasMore = false
        break
      }
      const data = await response.json()
      const items = data.items || []

      for (const item of items) {
        const smkId = item.object_number || (item.id ? `KMS${item.id}` : null)
        if (smkId && item.image_thumbnail) {
          artworkUrls.set(smkId, item.image_thumbnail)
        }
      }

      offset += 1000
      hasMore = items.length >= 1000
    } catch (err) {
      console.warn(`  Failed to fetch from SMK API: ${err.message}`)
      break
    }
  }

  // Build download queue
  const downloadQueue = artworks
    .filter(a => artworkUrls.has(a.smk_id))
    .map(a => ({ smkId: a.smk_id, url: artworkUrls.get(a.smk_id), title: a.title }))

  console.log(`Downloading ${downloadQueue.length} images with concurrency ${CONCURRENCY}...`)

  // Simple concurrency pool
  async function* chunks(arr, size) {
    for (let i = 0; i < arr.length; i += size) {
      yield arr.slice(i, i + size)
    }
  }

  let downloadedSoFar = 0
  let failedCount = 0
  const poolSize = Math.min(CONCURRENCY, downloadQueue.length)
  console.log(`  Starting ${poolSize} concurrent workers...`)

  for await (const chunk of chunks(downloadQueue, poolSize)) {
    await Promise.allSettled(chunk.map(async ({ smkId, url, title }) => {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const imageBuffer = await downloadImage(url)
          if (imageBuffer && imageBuffer.length > 0) {
            await Artwork.update({ image_data: imageBuffer }, { where: { smk_id: smkId } })
            downloadedSoFar++
            break
          }
        } catch (imgErr) {
          if (attempt < MAX_RETRIES) {
            await sleep(Math.pow(2, attempt) * 1000)
          } else {
            failedCount++
            console.warn(`  Failed to download image for ${smkId} ("${title}") after ${MAX_RETRIES} attempts:`, imgErr.message)
          }
        }
      }
    }))

    if (downloadedSoFar % 100 === 0 || downloadedSoFar === downloadQueue.length) {
      console.log(`  Downloaded ${downloadedSoFar}/${downloadQueue.length} images (${failedCount} failed)...`)
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  await SyncLog.create({
    last_sync_at: new Date(),
    status: 'success',
    records_fetched: downloadedSoFar,
    error_message: failedCount > 0 ? `${failedCount} images failed to download` : null
  })

  console.log(`\nImage download complete in ${elapsed}s`)
  console.log(`  Downloaded: ${downloadedSoFar}`)
  console.log(`  Failed: ${failedCount}`)

  return { success: failedCount === 0, count: downloadedSoFar }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  downloadMissingImages()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Image download failed:', err.message)
      SyncLog.create({
        last_sync_at: new Date(),
        status: 'error',
        records_fetched: 0,
        error_message: err.message
      }).finally(() => process.exit(1))
    })
}

export { downloadMissingImages }
