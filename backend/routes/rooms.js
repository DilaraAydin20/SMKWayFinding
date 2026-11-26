import { Router } from 'express'
import Room from '../models/Room.js'
import ArtworkRoomMapping from '../models/ArtworkRoomMapping.js'
import Artwork from '../models/Artwork.js'

const router = Router()

// GET /api/rooms — list all rooms (optional ?level= filter)
router.get('/', async (req, res) => {
  try {
    const { level } = req.query
    const where = {}
    if (level) where.level = parseInt(level, 10)

    const rooms = await Room.findAll({
      where,
      order: [['level', 'ASC'], ['name', 'ASC']]
    })
    res.json(rooms.map(r => r.get({ plain: true })))
  } catch (err) {
    console.error('Error fetching rooms:', err.message)
    res.status(500).json({ error: 'Failed to fetch rooms' })
  }
})

// GET /api/rooms/:id — room detail with mapped artworks
router.get('/:id', async (req, res) => {
  try {
    const room = await Room.findByPk(req.params.id, {
      include: [{
        model: ArtworkRoomMapping,
        as: 'artworkMappings',
        include: [{ model: Artwork, as: 'artwork' }]
      }]
    })
    if (!room) return res.status(404).json({ error: 'Room not found' })

    const plain = room.get({ plain: true })
    res.json({
      ...plain,
      artworks: plain.artworkMappings?.map(m => m.artwork) || []
    })
  } catch (err) {
    console.error('Error fetching room detail:', err.message)
    res.status(500).json({ error: 'Failed to fetch room detail' })
  }
})

export default router
