export const artworksPerPage = 40

const apiUrl = '/api/artworks'
const artworkCountsRequests = new Map()
const artworkDescriptionCache = new Map()
const artworkDescriptionRequests = new Map()

function normalizeText(text) {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : ''
}

function toFrontendArtwork(artwork) {
  const descriptionDa = normalizeText(artwork.description_da)
  const descriptionEn = normalizeText(artwork.description_en)

  return {
    object_number: artwork.smk_id,
    hasDescription: Boolean(descriptionDa || descriptionEn),
    descriptions: {
      da: descriptionDa,
      en: descriptionEn
    },
    titles: [{ title: artwork.title || '' }],
    artist: artwork.artist ? [artwork.artist] : [],
    production_date: artwork.year ? [{ display: artwork.year }] : [],
    room_name: artwork.current_location_name || '',
    frontend_url: artwork.web_url || '',
    image_thumbnail: artwork.image_thumbnail || '',
    image_orientation: ''
  }
}

async function fetchArtworkPage(page, limit, location = '') {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit)
  })
  if (location) params.set('location', location)
  const response = await fetch(`${apiUrl}?${params}`)
  if (!response.ok) {
    throw new Error(`Artwork request failed with status ${response.status}`)
  }

  const data = await response.json()
  if (!Array.isArray(data.artworks) || !Number.isInteger(data.total)) {
    throw new Error('Backend returned an invalid artwork search response')
  }

  return data
}

async function fetchArtwork(objectNumber) {
  const response = await fetch(`${apiUrl}/${encodeURIComponent(objectNumber)}`)
  if (!response.ok) {
    throw new Error(response.status === 404
      ? 'Artwork not found in the local catalog'
      : `Artwork request failed with status ${response.status}`)
  }

  return response.json()
}

export function getArtworkCounts(location = '') {
  const cacheKey = location || ''
  if (!artworkCountsRequests.has(cacheKey)) {
    const request = fetchArtworkPage(1, 1, cacheKey)
      .then(({ total }) => ({ roomAssigned: total }))
      .catch(error => {
        artworkCountsRequests.delete(cacheKey)
        throw error
      })
    artworkCountsRequests.set(cacheKey, request)
  }

  return artworkCountsRequests.get(cacheKey)
}

export async function getArtworkLocations() {
  const response = await fetch(`${apiUrl}/locations`)
  if (!response.ok) {
    throw new Error(`Artwork locations request failed with status ${response.status}`)
  }

  const data = await response.json()
  if (!Array.isArray(data.locations) || data.locations.some(location => typeof location !== 'string')) {
    throw new Error('Backend returned an invalid artwork locations response')
  }

  return data.locations
}

export async function getArtworks(offset, limit = artworksPerPage, location = '') {
  if (!Number.isInteger(offset) || offset < 0 ||
      !Number.isInteger(limit) || limit < 1 || offset % limit !== 0) {
    throw new RangeError('Artwork offset and limit must define a valid page.')
  }

  const page = Math.floor(offset / limit) + 1
  const { artworks } = await fetchArtworkPage(page, limit, location)
  return artworks.map(toFrontendArtwork)
}

export function getArtworkText(objectNumber, language) {
  const cacheKey = `${objectNumber}:${language}`
  if (artworkDescriptionCache.has(cacheKey)) {
    return Promise.resolve(artworkDescriptionCache.get(cacheKey))
  }

  if (artworkDescriptionRequests.has(cacheKey)) {
    return artworkDescriptionRequests.get(cacheKey)
  }

  const request = fetchArtworkText(objectNumber, language)
    .finally(() => artworkDescriptionRequests.delete(cacheKey))
  artworkDescriptionRequests.set(cacheKey, request)
  return request
}

async function fetchArtworkText(objectNumber, language) {
  const cacheKey = `${objectNumber}:${language}`
  const artwork = await fetchArtwork(objectNumber)
  const requestedText = normalizeText(artwork[`description_${language}`])

  if (requestedText) {
    const result = { text: requestedText, translated: false, fallback: false }
    artworkDescriptionCache.set(cacheKey, result)
    return result
  }

  const danishText = normalizeText(artwork.description_da)
  if (!danishText) {
    return { text: '', translated: false, fallback: false }
  }

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: danishText, targetLanguage: language })
    })

    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      throw new Error(result.error || `Translation request failed (${response.status}).`)
    }

    const result = await response.json()
    if (typeof result.text !== 'string' || !result.text.trim()) {
      throw new Error('Translation service returned an empty description.')
    }

    const description = { text: normalizeText(result.text), translated: true, fallback: false }
    artworkDescriptionCache.set(cacheKey, description)
    return description
  } catch (error) {
    console.warn('Artwork description translation is unavailable:', error)
    return { text: danishText, translated: false, fallback: true, error: true }
  }
}
