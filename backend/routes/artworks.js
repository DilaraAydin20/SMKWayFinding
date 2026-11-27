import { Router } from 'express'
import Artwork from '../models/Artwork.js'
import ArtworkRoomMapping from '../models/ArtworkRoomMapping.js'
import Room from '../models/Room.js'
import { Op } from 'sequelize'

const router = Router()

// GET /api/artworks — search/filter/paginate artworks
router.get('/', async (req, res) => {
  try {
    const { q, artist, room, year, page = 1, limit = 50 } = req.query
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10)

    const where = {}
    if (q) where['title'] = { [Op.like]: `%${q}%` }
    if (artist) where['artist'] = { [Op.like]: `%${artist}%` }
    if (year) where['year'] = year

    const include = []
    if (room) {
      include.push({
        model: ArtworkRoomMapping,
        as: 'mapping',
        required: true,
        include: [{
          model: Room,
          as: 'room',
          where: { id: parseInt(room, 10) },
          required: true
        }]
      })
    }

    const { count, rows } = await Artwork.findAndCountAll({
      where,
      include,
      limit: parseInt(limit, 10),
      offset,
      order: [['title', 'ASC']]
    })

    // Only include current_location_name if the search query is about location
    const locationKeywords = ['location', 'place', 'room', 'sted', 'plads', 'stelle']
    const searchLower = (q || '').toLowerCase()
    const includeLocation = locationKeywords.some(kw => searchLower.includes(kw))

    res.json({
      artworks: rows.map(a => {
        const art = a.get({ plain: true })
        if (!includeLocation) delete art.current_location_name
        return art
      }),
      total: count,
      page: parseInt(page, 10),
      totalPages: Math.ceil(count / parseInt(limit, 10))
    })
  } catch (err) {
    console.error('Error searching artworks:', err.message)
    res.status(500).json({ error: 'Failed to search artworks' })
  }
})

// GET /api/artworks/:smkId — single artwork detail
router.get('/:smkId', async (req, res) => {
  try {
    const artwork = await Artwork.findByPk(req.params.smkId)
    if (!artwork) return res.status(404).json({ error: 'Artwork not found' })
    res.json(artwork.get({ plain: true }))
  } catch (err) {
    console.error('Error fetching artwork:', err.message)
    res.status(500).json({ error: 'Failed to fetch artwork' })
  }
})

// GET /api/artworks/:smkId/image — stream image BLOB
router.get('/:smkId/image', async (req, res) => {
  try {
    const artwork = await Artwork.findByPk(req.params.smkId)
    if (!artwork) return res.status(404).json({ error: 'Artwork not found' })
    if (!artwork.image_data) return res.status(404).json({ error: 'Image not available' })

    res.set('Content-Type', 'image/jpeg')
    res.set('Cache-Control', 'public, max-age=86400')
    res.send(artwork.image_data)
  } catch (err) {
    console.error('Error streaming image:', err.message)
    res.status(500).json({ error: 'Failed to stream image' })
  }
})

export default router
