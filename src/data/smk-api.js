import noImage from '../images/noimage.png'

const apiUrl = 'https://api.smk.dk/api/v1/art/search/';

export const rows = 1000;

export async function getArtworks(offset = 0) {
    try {
        const response = await fetch(
            `${apiUrl}?keys=*&offset=${offset}&rows=${rows}`
        );
        if (!response.ok) {
            throw new Error(`SMK API request failed with status ${response.status}`);
        }

        const data = await response.json();
        return data.items.map(artwork => ({
            object_number: artwork?.object_number ?? '',
            titles: artwork?.titles ?? [],
            artist: artwork?.artist ?? [],
            production_date: artwork?.production_date ?? [],
            frontend_url: artwork?.frontend_url ?? '',
            on_display: artwork?.on_display ?? null,
            image_thumbnail: artwork?.image_thumbnail ?? noImage,
            image_orientation: artwork?.image_orientation ?? ''
        }));

    } catch(err){
        console.error('Error while retreiving artworks :', err);
        throw err;
    }
}

const artworkDescriptionCache = new Map()
const artworkDescriptionRequests = new Map()

function normalizeText(text) {
    return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : ''
}

function getDescription(item) {
    const label = item?.labels?.find(entry => entry.type === 'CATALOGUETEXT')
        || item?.labels?.[0]
    return normalizeText(label?.text)
}

async function fetchArtwork(objectNumber, language) {
    const query = new URLSearchParams({ object_number: objectNumber, lang: language })
    const response = await fetch(`https://api.smk.dk/api/v1/art/?${query}`)
    if (!response.ok) {
        throw new Error(`SMK API request failed with status ${response.status}`)
    }

    return (await response.json()).items?.[0] ?? null
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
    const requestedArtwork = await fetchArtwork(objectNumber, language)
    const requestedLabel = requestedArtwork?.labels?.find(entry => entry.type === 'CATALOGUETEXT')
        || requestedArtwork?.labels?.[0]
    const requestedText = getDescription(requestedArtwork)
    const requestedLanguage = requestedLabel?.language || requestedLabel?.lang || requestedLabel?.language_code
    const normalizedRequestedLanguage = typeof requestedLanguage === 'string'
        ? requestedLanguage.toLowerCase().split(/[-_]/)[0]
        : ''

    if (language === 'da') {
        const result = { text: requestedText, translated: false, fallback: false }
        artworkDescriptionCache.set(cacheKey, result)
        return result
    }

    const danishArtwork = await fetchArtwork(objectNumber, 'da')
    const danishText = getDescription(danishArtwork)
    const isOfficialTranslation = requestedText && (
        normalizedRequestedLanguage
            ? normalizedRequestedLanguage === language
            : requestedText !== danishText
    )

    if (isOfficialTranslation) {
        const result = { text: requestedText, translated: false, fallback: false }
        artworkDescriptionCache.set(cacheKey, result)
        return result
    }

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