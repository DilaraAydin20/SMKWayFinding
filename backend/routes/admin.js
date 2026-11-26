import { Router } from 'express'
import SyncLog from '../models/SyncLog.js'
import Artwork from '../models/Artwork.js'

const router = Router()

// POST /api/admin/sync — trigger SMK sync (calls syncFromSmkApi)
router.post('/sync', async (req, res) => {
  try {
    const { syncFromSmkApi } = await import('../scripts/sync-smk.js')
    const result = await syncFromSmkApi()

    await SyncLog.create({
      last_sync_at: new Date(),
      status: result.success ? 'success' : 'error',
      records_fetched: result.count || 0,
      error_message: result.error || null
    })

    if (result.success) {
      res.json({ message: `Sync complete. ${result.count} artworks synced.` })
    } else {
      res.status(500).json({ message: 'Sync failed', error: result.error })
    }
  } catch (err) {
    console.error('Sync error:', err.message)
    res.status(500).json({ error: err.message || 'Sync failed' })
  }
})

// GET /api/admin/sync/status — last sync status
router.get('/sync/status', async (req, res) => {
  try {
    const log = await SyncLog.findOne({ order: [['id', 'DESC']] })
    if (!log) return res.json({ message: 'No sync history found' })
    res.json(log.get({ plain: true }))
  } catch (err) {
    console.error('Error fetching sync status:', err.message)
    res.status(500).json({ error: 'Failed to fetch sync status' })
  }
})

export default router
