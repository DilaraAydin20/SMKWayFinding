import { Router } from 'express'
import Artwork from '../models/Artwork.js'
import ArtworkRoomMapping from '../models/ArtworkRoomMapping.js'
import Room from '../models/Room.js'
import { literal, Op } from 'sequelize'

const router = Router()

function parsePositiveInteger(value, defaultValue) {
  if (value === undefined) return defaultValue
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null

  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function toArtworkResponse(artwork) {
  const plain = artwork.get({ plain: true })
  const hasImage = plain.has_image
  delete plain.has_image
  delete plain.on_display
  return {
    ...plain,
    image_thumbnail: hasImage ? `/api/artworks/${encodeURIComponent(plain.smk_id)}/image` : null
  }
}

function getArtworkAttributes() {
  return {
    exclude: ['image_data'],
    include: [[literal('image_data IS NOT NULL'), 'has_image']]
  }
}

// GET /api/artworks — search/filter/paginate artworks
router.get('/', async (req, res) => {
  try {
    const { q, artist, room, year, location } = req.query
    const page = parsePositiveInteger(req.query.page, 1)
    const limit = parsePositiveInteger(req.query.limit, 50)

    if (page === null || limit === null || limit > 100) {
      return res.status(400).json({ error: 'Page must be positive and limit must be between 1 and 100.' })
    }

    if ([q, artist, room, year, location].some(value => value !== undefined && typeof value !== 'string')) {
      return res.status(400).json({ error: 'Search filters must be single string values.' })
    }

    const roomId = room === undefined ? null : parsePositiveInteger(room, null)
    if (room !== undefined && roomId === null) {
      return res.status(400).json({ error: 'Room must be a positive integer.' })
    }

    const offset = (page - 1) * limit

    const where = {
      current_location_name: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
    }
    if (q) {
      where[Op.or] = [
        { title: { [Op.like]: `%${q}%` } },
        { artist: { [Op.like]: `%${q}%` } }
      ]
    }
    if (artist) where['artist'] = { [Op.like]: `%${artist}%` }
    if (year) where['year'] = year
    if (location) where.current_location_name = location
    const include = []
    if (roomId !== null) {
      include.push({
        model: ArtworkRoomMapping,
        as: 'mappings',
        required: true,
        include: [{
          model: Room,
          as: 'room',
          where: { id: roomId },
          required: true
        }]
      })
    }

    const { count, rows } = await Artwork.findAndCountAll({
      where,
      include,
      attributes: getArtworkAttributes(),
      limit,
      offset,
      order: [['title', 'ASC']],
      distinct: true
    })

    res.json({
      artworks: rows.map(toArtworkResponse),
      total: count,
      page,
      totalPages: Math.ceil(count / limit)
    })
  } catch (err) {
    console.error('Error searching artworks:', err.message)
    res.status(500).json({ error: 'Failed to search artworks' })
  }
})

// GET /api/artworks/locations — list distinct assigned artwork locations
router.get('/locations', async (_req, res) => {
  try {
    const locations = await Artwork.findAll({
      attributes: ['current_location_name'],
      where: {
        current_location_name: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
      },
      group: ['current_location_name'],
      order: [['current_location_name', 'ASC']],
      raw: true
    })

    res.json({ locations: locations.map(artwork => artwork.current_location_name) })
  } catch (err) {
    console.error('Error fetching artwork locations:', err.message)
    res.status(500).json({ error: 'Failed to fetch artwork locations' })
  }
})

// GET /api/artworks/:smkId — single artwork detail
router.get('/:smkId', async (req, res) => {
  try {
    const artwork = await Artwork.findOne({
      where: {
        smk_id: req.params.smkId,
        current_location_name: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
      },
      attributes: getArtworkAttributes()
    })
    if (!artwork) return res.status(404).json({ error: 'Artwork not found' })
    res.json(toArtworkResponse(artwork))
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
