# SMK Wayfinding — Future Features Discussion

## 1. Map Initialization Performance

### Current Problem
`loadOSMData()` → `fetchIndoorData()` does a **synchronous POST to Overpass API** with a 25-second timeout. The user sees a blank map + "Loading OpenStreetMap data..." overlay until the entire query completes.

### Alternative Approaches (ranked by practicality)

#### A. Cache & Service Worker
- Pre-fetch and cache the Overpass response in `IndexedDB` or `CacheStorage`
- On first visit: still wait for Overpass, but store the result
- On subsequent visits: show cached data immediately, then background-refresh
- Reduces perceived wait from ~10–25s to <1s after first load

#### B. Pre-bundle / Embed Floor Plan Data
- Run a build-step script that queries Overpass once and saves the result as static JSON in `public/`
- Ship this file with the app — no network call at runtime
- Trade-off: data becomes stale until re-run. Add a "last updated" timestamp

#### C. Progressive Loading (Recommended Phase 1)
- Reverse current order: initialize Leaflet + tile layer → show map immediately → query Overpass in background → render indoor polygons when ready
- User sees something useful instantly, then rooms appear progressively
- **Simplest change with immediate impact** — remove `await fetchIndoorData()` from before `isMapLoaded.value = true`

#### D. Hybrid: Embed + Runtime Fetch
- Embed a baseline floor plan as static GeoJSON in the bundle
- At runtime, optionally fetch Overpass for new/changed data and merge

### Recommendation
Start with **C (progressive loading)** — a quick win. Then layer on **A or B** for long-term performance. The Overpass API is also rate-limited and unreliable, so caching/embedding is valuable regardless.

---

## 2. Fetching Artworks from the SMK API

### What the SMK API Offers
The SMK API (`https://api.smk.dk`) provides:
- ~90,000+ artworks with metadata (title, artist, date, image, description)
- Each artwork has an `id`, `title`, `description`, `image` (multiple resolutions), `creator`, `date`, `materials`, etc.
- **Artworks are not geolocated in the API** — no room/position data

### Key Integration Challenges

#### A. No Spatial Data in SMK API
The SMK API tells you *what* artworks exist, but **not where they're hung**. You'd need to manually or semi-automatically map artwork IDs to room IDs from OSM data.

#### B. Suggested Data Model Extension
```js
{
  smkId: 12345,       // SMK API ID
  title: 'Starry Night...',
  imageUrl: '...',
  artist: 'Van Gogh',
  roomId: 42,         // Your OSM room ID (manually curated)
  level: 1
}
```

#### C. Caching Strategy
- SMK API has rate limits (~60 req/min unauthenticated). **Cache the full catalog locally** (IndexedDB or static JSON)
- Fetch images lazily — only download when an artwork card is visible
- Consider paginated fetching: load artworks room-by-room instead of all 90k at once

#### D. UX Ideas
- **Artwork waypoints**: Each room shows a list of associated artworks when the user enters
- **Wayfinding to art**: Navigate *to a specific artwork* — "Go to Room 42 → Van Gogh's Portrait"
- **QR codes on frames**: Each artwork gets a QR code linking to its SMK API detail page + wayfinding data
- **Collection filters**: Filter by artist, period, medium — then show all rooms containing works from that filter

### Suggested Implementation Order
1. Add `fetchArtworksByRoom(roomId)` action to the store (queries SMK API or cached data)
2. Display artwork cards in the room info panel when user enters a room with artworks
3. Allow tapping an artwork to set it as the wayfinding destination
4. Add a build-time script to sync the full SMK catalog into a local JSON cache

---

## Priority Summary

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| **P0** | Progressive map loading (show tiles first) | Low | High — immediate UX fix |
| **P1** | Cache Overpass response (IndexedDB/CacheStorage) | Medium | High — eliminates repeated waits |
| **P1** | Fetch artworks from SMK API per room | Medium | High — core content feature |
| **P2** | Artwork-as-wayfinding-destination | Low | Medium |
| **P2** | Build-time catalog sync script | Medium | Medium |
