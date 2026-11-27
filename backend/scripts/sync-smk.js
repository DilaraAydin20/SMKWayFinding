import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import sequelize, { ensureDatabase } from '../config/db.js'
import SyncLog from '../models/SyncLog.js'

const SMK_API_BASE = process.env.SMK_API_BASE || 'https://api.smk.dk/api/v1/art/search/'
const IMAGE_BASE_URL = process.env.SMK_IMAGE_BASE || 'https://api.smk.dk/api/v1/art/image/'
const ROWS_PER_PAGE = parseInt(process.env.SMK_ROWS_PER_PAGE || '2000', 10)
const API_CONCURRENCY = parseInt(process.env.API_CONCURRENCY || '8', 10)
const IMAGE_DOWNLOAD_CONCURRENCY = parseInt(process.env.IMAGE_DOWNLOAD_CONCURRENCY || '20', 10)

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Download image from a URL as a Buffer
async function downloadImage(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url)
      if (!response.ok) return null
      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.length === 0) return null
      return buffer
    } catch {
      if (attempt < 3) await sleep(1000 * attempt)
      else return null
    }
  }
  return null
}

// Concurrent pool executor
async function concurrentMap(items, fn, concurrency) {
  const results = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++
      results[i] = await fn(items[i], i)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

// MySQL-compatible datetime string: '2026-11-27 10:48:51'
function mysqlNow() {
  const d = new Date()
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')
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

// Escape a value for raw SQL string literals
function sqlEscape(val) {
  if (val === null) return 'NULL'
  const str = String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')
  return `'${str}'`
}

// Convert raw API item to DB record shape
function itemToRecord(item) {
  const smkId = item.object_number || (item.id ? `KMS${item.id}` : null)
  if (!smkId) return null

  const titles = item.titles?.[0]?.title || 'Untitled'
  const artistVal = sanitize(item.artist) || null
  const year = sanitize(item.year_of_publication) || null
  const descriptionEn = sanitize(item.descriptions?.en || item.description_en || null)
  const descriptionDa = sanitize(item.descriptions?.da || item.description_da || null)
  const webUrl = sanitize(item.frontend_url) || null
  const onDisplay = item.on_display ?? null
  const locationName = sanitize(item.current_location_name) || null
  const imageThumbnail = item.image_thumbnail || null

  return { smkId, title: titles, artist: artistVal, year, description_en: descriptionEn, description_da: descriptionDa, web_url: webUrl, on_display: onDisplay, current_location_name: locationName, image_thumbnail: imageThumbnail }
}

async function fetchPage(offset) {
  const url = `${SMK_API_BASE}?keys=*&offset=${offset}&rows=${ROWS_PER_PAGE}`
  let response
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      response = await fetch(url)
      if (response.ok) break
      console.warn(`  [offset ${offset}] API returned ${response.status}, retry ${attempt}/5...`)
      await sleep(2000 * attempt)
    } catch (err) {
      console.warn(`  [offset ${offset}] Fetch error: ${err.message}, retry ${attempt}/5...`)
      await sleep(2000 * attempt)
    }
  }
  if (!response?.ok) return null

  let data
  const body = await response.text()
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      data = JSON.parse(body)
      break
    } catch (err) {
      console.warn(`  [offset ${offset}] JSON parse error, retry ${attempt}/3...`)
      await sleep(1000)
    }
  }
  return data
}

function buildUpsertSql(records) {
  const now = mysqlNow()
  const columns = ['smk_id', 'title', 'artist', 'year', 'description_en', 'description_da', 'web_url', 'on_display', 'current_location_name', 'last_synced_at', 'image_data']
  const updateFields = ['title', 'artist', 'year', 'description_en', 'description_da', 'web_url', 'on_display', 'current_location_name', 'last_synced_at', 'image_data']

  // Build VALUES clause
  const values = records.map(r => {
    const imgHex = r.image_data ? `0x${r.image_data.toString('hex')}` : 'NULL'
    return `(${sqlEscape(r.smkId)}, ${sqlEscape(r.title)}, ${sqlEscape(r.artist)}, ${sqlEscape(r.year)}, ${sqlEscape(r.description_en)}, ${sqlEscape(r.description_da)}, ${sqlEscape(r.web_url)}, ${r.onDisplay ? 'TRUE' : 'FALSE'}, ${sqlEscape(r.current_location_name)}, '${now}', ${imgHex})`
  }).join(', ')

  return `INSERT INTO artworks (${columns.join(', ')}) VALUES ${values} ON DUPLICATE KEY UPDATE ${updateFields.map(f => `${f}=VALUES(${f})`).join(', ')}`
}

async function syncFromSmkApi() {
  const allRecords = []

  console.log('Starting SMK API sync...')
  console.log(`API Base: ${SMK_API_BASE}`)
  console.log(`Rows per page: ${ROWS_PER_PAGE}, API concurrency: ${API_CONCURRENCY}`)

  // Ensure database exists
  await ensureDatabase()
  await sequelize.authenticate()
  console.log('Connected to MySQL successfully.')

  const startTime = Date.now()

  // ── Phase 1: Parallel fetch all records from SMK API ──
  console.log('\nPhase 1: Fetching all records (parallel)...')

  // SMK API often returns total=0, so we fetch until we get an empty page.
  // We use a growing window approach: keep fetching offsets until a page returns < ROWS_PER_PAGE items.
  const fetchedOffsets = new Set()
  let lastBatchSize = ROWS_PER_PAGE // start by fetching page 0
  let consecutiveEmpties = 0

  async function fetchWindow(startOffset) {
    const promises = []
    for (let offset = startOffset; offset < startOffset + ROWS_PER_PAGE * 10 && consecutiveEmpties < 3; offset += ROWS_PER_PAGE) {
      if (fetchedOffsets.has(offset)) continue
      fetchedOffsets.add(offset)
      promises.push(fetchPage(offset))
    }
    const results = await Promise.allSettled(promises)
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value?.items?.length > 0) {
        const data = result.value
        for (const item of data.items) {
          const record = itemToRecord(item)
          if (record && record.current_location_name !== null) allRecords.push(record)
        }
        consecutiveEmpties = 0 // reset on successful fetch
      } else {
        consecutiveEmpties++
      }
    }
  }

  // Fetch in overlapping windows of 10 pages at a time, with concurrency control
  let currentOffset = 0
  while (consecutiveEmpties < 3) {
    const windowRecordsBefore = allRecords.length
    await fetchWindow(currentOffset)
    currentOffset += ROWS_PER_PAGE * 5 // advance by 5 pages each round (overlap handles gaps)

    if (allRecords.length === windowRecordsBefore) {
      consecutiveEmpties++
    } else {
      consecutiveEmpties = 0
    }

    console.log(`  Fetched ${allRecords.length} records so far...`)
  }

  // Deduplicate by smk_id (parallel fetches may overlap)
  const deduped = new Map()
  for (const record of allRecords) {
    deduped.set(record.smkId, record)
  }
  const uniqueRecords = Array.from(deduped.values())
  console.log(`\nFetched ${allRecords.length} total, ${uniqueRecords.length} unique records.`)

  // ── Phase 1.5: Download images in parallel for all filtered records ──
  console.log(`\nPhase 1.5: Downloading images for ${uniqueRecords.length} records...`)

  const imageTasks = uniqueRecords.filter(r => r.image_thumbnail).map(r => ({ smkId: r.smkId, url: r.image_thumbnail }))
  let imageDownloadsCompleted = 0
  let imageDownloadFailures = 0

  await concurrentMap(imageTasks, async ({ smkId, url }) => {
    const imageBuffer = await downloadImage(url)
    if (imageBuffer) {
      const record = deduped.get(smkId)
      if (record) record.image_data = imageBuffer
      imageDownloadsCompleted++
    } else {
      imageDownloadFailures++
    }

    if (imageDownloadsCompleted % 50 === 0 || imageDownloadsCompleted === imageTasks.length) {
      console.log(`  Downloaded ${imageDownloadsCompleted}/${imageTasks.length} images (${imageDownloadFailures} failed)...`)
    }
  }, IMAGE_DOWNLOAD_CONCURRENCY)

  const imageElapsed = ((Date.now() - startTime) / 1000).toFixed(0)
  console.log(`Image download complete: ${imageDownloadsCompleted}/${imageTasks.length} succeeded, ${imageDownloadFailures} failed (${imageElapsed}s elapsed)`)

  // ── Phase 2: Raw SQL bulk upsert (no transactions — direct INSERT) ──
  const BATCH_SIZE = parseInt(process.env.UPSERT_BATCH_SIZE || '3000', 10)

  console.log(`\nPhase 2: Upserting ${uniqueRecords.length} records in batches of ${BATCH_SIZE}...`)

  let successCount = 0
  let failedRecords = []

  for (let i = 0; i < uniqueRecords.length; i += BATCH_SIZE) {
    const batch = uniqueRecords.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    console.log(`  Upserting batch ${batchNum} (${batch.length} records)...`)

    try {
      // Direct insert — no transaction wrapper (avoids MySQL/Sequelize transaction issues)
      await sequelize.query(buildUpsertSql(batch))
      successCount += batch.length
    } catch (err) {
      const batchErr = err instanceof Error ? err.message : String(err)
      console.warn(`  Batch ${batchNum} failed (${batchErr}), retrying individually...`)

      for (const record of batch) {
        try {
          await sequelize.query(buildUpsertSql([record]))
          successCount++
        } catch (recordErr) {
          const recordMsg = recordErr instanceof Error ? recordErr.message : String(recordErr)
          failedRecords.push({ smkId: record.smkId, error: recordMsg })
        }
      }
    }

    // Progress every batch
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
    console.log(`  ✓ Batch ${batchNum} done — ${successCount}/${uniqueRecords.length} upserted (${elapsed}s)`)
  }

  if (failedRecords.length > 0) {
    const failureSummary = `${failedRecords.length} records skipped: ${failedRecords.slice(0, 20).map(r => `${r.smkId}: ${r.error.slice(0, 80)}`).join('; ')}`
    console.warn(`\nTotal failed: ${failedRecords.length}`)
    console.warn(failureSummary)
  } else {
    console.log(`Bulk upsert complete. ${successCount} records processed.`)
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const finalStatus = failedRecords.length > 0 ? 'partial_error' : 'success'
  const finalMessage = failedRecords.length > 0
    ? `${failedRecords.length} records skipped: ${failedRecords.slice(0, 20).map(r => `${r.smkId}: ${r.error.slice(0, 80)}`).join('; ')}`
    : null

  try {
    await SyncLog.create({
      last_sync_at: new Date(),
      status: finalStatus,
      records_fetched: successCount || uniqueRecords.length,
      error_message: finalMessage
    })
  } catch (err) { /* ignore sync log errors */ }

  const imagesStored = uniqueRecords.filter(r => r.image_data != null).length

  console.log(`\nSync complete in ${elapsed}s`)
  console.log(`  Total fetched: ${allRecords.length}`)
  console.log(`  Unique records: ${uniqueRecords.length}`)
  console.log(`  Successfully upserted: ${successCount}`)
  console.log(`  Failed/skipped: ${failedRecords.length}`)
  console.log(`  Images stored: ${imagesStored}/${uniqueRecords.length}`)

  return { success: failedRecords.length === 0, count: successCount || uniqueRecords.length, imagesStored }
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
