import express from 'express'
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sequelize from './config/db.js'
import Artwork from './models/Artwork.js'
import Room from './models/Room.js'
import ArtworkRoomMapping from './models/ArtworkRoomMapping.js'
import UserVisit from './models/UserVisit.js'
import SyncLog from './models/SyncLog.js'
import syncRouter from './routes/admin.js'
import { syncFromSmkApi } from './scripts/sync-smk.js'

const app = express()
const port = process.env.PORT || 3001
const voiceId = 'JBFqnCBsd6RMkjVDRZzb'
const languageCodes = new Set(['da', 'en', 'de', 'fr', 'sv', 'it'])
const apiKey = process.env.ELEVENLABS_API_KEY
const elevenLabs = apiKey ? new ElevenLabsClient() : null
const deeplApiKey = process.env.DEEPL_API_KEY
const deeplApiUrl = process.env.DEEPL_API_URL || 'https://api-free.deepl.com/v2/translate'
const translationCache = new Map()
const translationRequests = new Map()
const translationCacheLimit = 500

// --- Model associations ---
Artwork.hasMany(ArtworkRoomMapping, { as: 'mappings', foreignKey: 'artwork_smk_id' })
ArtworkRoomMapping.belongsTo(Artwork, { as: 'artwork', foreignKey: 'artwork_smk_id' })
Room.hasMany(ArtworkRoomMapping, { as: 'artworkMappings', foreignKey: 'room_id' })
ArtworkRoomMapping.belongsTo(Room, { as: 'room', foreignKey: 'room_id' })

// --- Middleware ---
app.use(express.json({ limit: '25kb' }))

app.post('/api/translate', async (req, res) => {
  const { text, targetLanguage } = req.body ?? {}

  if (typeof text !== 'string' || !text.trim() || text.length > 5000) {
    return res.status(400).json({ error: 'Provide text between 1 and 5000 characters.' })
  }

  if (typeof targetLanguage !== 'string' || !languageCodes.has(targetLanguage)) {
    return res.status(400).json({ error: 'Choose a supported translation language.' })
  }

  if (!deeplApiKey) {
    return res.status(503).json({ error: 'Translation is not configured on the server.' })
  }

  const normalizedText = text.trim()
  const cacheKey = createHash('sha256')
    .update(`${targetLanguage}\0${normalizedText}`)
    .digest('hex')
  const cachedTranslation = translationCache.get(cacheKey)

  if (cachedTranslation) {
    translationCache.delete(cacheKey)
    translationCache.set(cacheKey, cachedTranslation)
    return res.json({ text: cachedTranslation })
  }

  let translationRequest = translationRequests.get(cacheKey)
  if (!translationRequest) {
    translationRequest = (async () => {
      const response = await fetch(deeplApiUrl, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${deeplApiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          text: normalizedText,
          source_lang: 'DA',
          target_lang: targetLanguage.toUpperCase()
        })
      })

      if (!response.ok) {
        throw new Error(`DeepL request failed with status ${response.status}`)
      }

      const result = await response.json()
      const translatedText = result.translations?.[0]?.text
      if (typeof translatedText !== 'string' || !translatedText.trim()) {
        throw new Error('DeepL returned an empty translation')
      }
      return translatedText
    })()
    translationRequests.set(cacheKey, translationRequest)
  }

  try {
    const translatedText = await translationRequest
    if (translationCache.size >= translationCacheLimit) {
      translationCache.delete(translationCache.keys().next().value)
    }
    translationCache.set(cacheKey, translatedText)
    return res.json({ text: translatedText })
  } catch (error) {
    console.error('Artwork description translation failed:', error instanceof Error ? error.message : error)
    return res.status(502).json({ error: 'Translation failed. Please try again later.' })
  } finally {
    if (translationRequests.get(cacheKey) === translationRequest) {
      translationRequests.delete(cacheKey)
    }
  }
})

// --- API Routes ---
app.use('/api/artworks', await import('./routes/artworks.js').then(m => m.default))
app.use('/api/rooms', await import('./routes/rooms.js').then(m => m.default))
app.use('/api/admin', syncRouter)

// --- TTS (ElevenLabs) ---
app.post('/api/tts', async (req, res) => {
  const { text, language } = req.body ?? {}

  if (typeof text !== 'string' || !text.trim() || text.length > 5000) {
    return res.status(400).json({ error: 'Provide a description between 1 and 5000 characters.' })
  }

  if (typeof language !== 'string' || !languageCodes.has(language)) {
    return res.status(400).json({ error: 'Choose a supported description language.' })
  }

  if (!elevenLabs) {
    return res.status(503).json({ error: 'Speech is not configured. Set ELEVENLABS_API_KEY on the server.' })
  }

  try {
    const audio = await elevenLabs.textToSpeech.convert(voiceId, {
      text: text.trim(),
      modelId: 'eleven_v4',
      languageCode: language,
      outputFormat: 'mp3_44100_128'
    })

    res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' })
    await pipeline(Readable.fromWeb(audio), res)
  } catch (error) {
    console.error('ElevenLabs speech generation failed:', error instanceof Error ? error.message : error)
    if (!res.headersSent) res.status(502).json({ error: 'Speech generation failed. Please try again.' })
    else res.destroy()
  }
})

// --- Sync check on startup ---
async function checkAndSync() {
  try {
    const lastLog = await SyncLog.findOne({ order: [['id', 'DESC']] })
    if (!lastLog || lastLog.status === 'error') {
      console.log('No successful sync found. Starting initial sync in background...')
      syncFromSmkApi().catch(console.error)
      return
    }

    const daysSinceSync = (Date.now() - new Date(lastLog.last_sync_at).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceSync > 7) {
      console.log('Last sync was >7 days ago. Starting background sync...')
      syncFromSmkApi().catch(console.error)
    } else {
      console.log(`Last sync: ${lastLog.last_sync_at}. Next auto-sync in ${Math.ceil(7 - daysSinceSync)} days.`)
    }
  } catch (err) {
    console.error('Sync check failed:', err.message)
  }
}

// --- Production static serving ---
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendBuildPath = path.join(__dirname, '..', 'frontend', 'dist')

app.use(express.static(frontendBuildPath))

// --- Start server ---
async function startServer() {
  try {
    await sequelize.authenticate()
    console.log('MySQL connected successfully.')

    // Sync models (create tables if they don't exist)
    await sequelize.sync({ alter: true })
    console.log('Database models synchronized.')

    app.listen(port, () => {
      console.log(`SMK Wayfinding server listening on port ${port}`)
      if (!apiKey) console.error('ELEVENLABS_API_KEY is not set; artwork speech requests will be unavailable.')
      checkAndSync()
    })
  } catch (err) {
    console.error('Failed to start server:', err.message)
    process.exit(1)
  }
}

startServer()
