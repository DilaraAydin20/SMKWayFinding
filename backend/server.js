import express from 'express'
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const port = process.env.PORT || 3001
const voiceId = 'JBFqnCBsd6RMkjVDRZzb'
const languageCodes = new Set(['da', 'en', 'de', 'fr', 'sv', 'it'])
const apiKey = process.env.ELEVENLABS_API_KEY
const elevenLabs = apiKey ? new ElevenLabsClient() : null
const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const frontendBuildPath = path.join(projectRoot, '..', 'dist')

app.use(express.json({ limit: '10kb' }))

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

    res.set({
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store'
    })
    await pipeline(Readable.fromWeb(audio), res)
  } catch (error) {
    console.error('ElevenLabs speech generation failed:', error instanceof Error ? error.message : error)
    if (!res.headersSent) {
      res.status(502).json({ error: 'Speech generation failed. Please try again.' })
    } else {
      res.destroy()
    }
  }
})

app.use(express.static(frontendBuildPath))

app.listen(port, () => {
  console.log(`SMK Wayfinding server listening on port ${port}`)
  if (!apiKey) {
    console.error('ELEVENLABS_API_KEY is not set; artwork speech requests will be unavailable.')
  }
})
