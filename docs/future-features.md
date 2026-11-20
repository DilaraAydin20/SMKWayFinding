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

The SMK API (`https://api.smk.dk/api/v1/art/`) provides:

- ~200,000+ artworks with metadata (title, artist, date, image, description)
- **`current_location_name`**: Room where artwork is displayed (e.g., "Sal 205"). If absent → not currently on display.
- Each artwork has: `object_number` (KMS ID), `titles`, `creator`, `image_thumbnail`, `public_domain`, `period`, etc.
- Swagger docs: `https://api.smk.dk/api/v1/docs#/artworks/searchArt`

### API Endpoints & Access

| Detail | Value |
| -------- | ------- |
| Base URL | `https://api.smk.dk/api/v1/art/` |
| Search endpoint | `https://api.smk.dk/api/v1/art/search/?keys=*&offset=0&rows=2000` |
| Max rows per request | 2,000 |
| Rate limit | ~60 req/min (unauthenticated) |
| Full dataset download | ZIP (~50MB, nightly update) at `https://getallzip.open.smk.dk/` |

### Room Mapping: The Good News

**The room mapping is NOT a manual task.** The SMK API already provides `current_location_name` for each artwork. We just need to bridge SMK's room names (e.g., "Sal 205") with our OSM indoor feature IDs.

### Integration Approach

#### A. Get All Room Names from API

Query the API for all unique `current_location_name` values:

```text
https://api.smk.dk/api/v1/art/search/?keys=*&fields=current_location_name&rows=2000&offset=0
```

(Repeat with offset to paginate through all results, deduplicate location names.)

#### B. Map SMK Room Names → OSM Room IDs

- Cross-reference SMK `current_location_name` values (e.g., "Sal 205") with OSM way `name` tags from indoor mapping data
- Store this mapping in the store: `{ smkRoomName: 'Sal 205', osmRoomId: 42, level: 1 }`

#### C. Fetch Artworks by Room

```js
// Query cached/remote catalog for artworks in a room
fetchArtworksByRoom(smkRoomName) {
  return artworks.filter(a => a.current_location_name === smkRoomName)
}
```

#### D. Caching Strategy (Priority)

- **Preferred**: Download the nightly ZIP dataset (~50MB) and parse into local JSON/IndexedDB — no rate limits, instant access
- Alternative: Paginate via API with caching + debouncing
- Images: lazy-load only when artwork card is visible

### Suggested Data Model

```js
{
  smkId: 'KMS1',          // object_number from SMK API
  titles: ['Titanernes Fald'],
  creator: 'Cornelisz. van Haarlem, Cornelis',
  period: '1588-1590',
  image_thumbnail: 'https://iip-thumb.smk.dk/...',
  public_domain: true,
  current_location_name: 'Sal 205',  // → maps to OSM room ID
  osmRoomId: 42,              // Our internal room reference (after mapping)
  level: 1
}
```

### UX Ideas

- **Artwork waypoints**: Each room shows a list of associated artworks when the user enters
- **Wayfinding to art**: Navigate *to a specific artwork* — "Go to Room 42 → Van Gogh's Portrait"
- **QR codes on frames**: Each artwork gets a QR code linking to its SMK API detail page + wayfinding data
- **Collection filters**: Filter by artist, period, medium — then show all rooms containing works from that filter

### Suggested Implementation Order

1. **Build-time script**: Download nightly ZIP → parse → save as `public/smk-catalog.json`
2. Add `fetchArtworksByRoom(smkRoomName)` action to the store (reads from cached catalog)
3. Display artwork cards in the room info panel when user enters a room with artworks
4. Allow tapping an artwork to set it as the wayfinding destination
5. Add room name mapping layer: SMK `current_location_name` → OSM `osmRoomId`

---

## 3. Data Storage Architecture

### The Problem

Pinia stores data **in memory only** — everything is lost on page refresh or browser close. For a school project requiring a backend, we need to decide what lives where.

### Options Compared

| Approach | Persistence | Capacity | Best For |
| ---------- | ------------- | ---------- | ---------- |
| **Pinia** (current) | Lost on refresh | In-memory only | Reactive UI state (loading flags, selections) |
| **localStorage** | Survives refresh | ~5-10 MB | Small datasets: mappings, history, preferences |
| **IndexedDB** | Survives refresh | 50MB+ (with quota) | Full SMK catalog cache (~50MB) |
| **MySQL backend** | Permanent | Unlimited | School project requirement + user data + mappings |

### Recommended Architecture

```text
Frontend (Vue + Pinia)
    ├── Reactive UI state: currentLocation, isLoading, selectedArtwork
    ├── Local cache (IndexedDB or static JSON): full SMK catalog (~50MB)
    └── Backend calls (MySQL):
            ├── GET /api/rooms              → room list with names
            ├── GET /api/artworks?room=205   → artworks in a room (query MySQL mapping)
            ├── POST /api/visit              → log user visit
            └── GET /api/user/:id/history    → user's visited rooms
```

### Minimal MySQL Schema

```sql
CREATE TABLE rooms (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100),          -- "Sal 205"
    osm_id BIGINT,              -- links to OSM way ID
    level INT
);

CREATE TABLE artworks (
    smk_id VARCHAR(20) PRIMARY KEY,  -- "KMS1"
    title VARCHAR(500),
    creator VARCHAR(200),
    image_url TEXT,
    current_location_name VARCHAR(100)
);

CREATE TABLE artwork_room_mapping (
    artwork_smk_id VARCHAR(20),
    room_id INT,
    PRIMARY KEY (artwork_smk_id, room_id),
    FOREIGN KEY (artwork_smk_id) REFERENCES artworks(smk_id),
    FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE TABLE user_visits (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    room_name VARCHAR(100),
    visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### What Goes Where

| Data | Location | Reason |
| ------ | ---------- | -------- |
| Reactive UI state (isLoading, selectedArtwork) | Pinia | Fast, reactive, no persistence needed |
| Full SMK artwork catalog | IndexedDB or static JSON in `public/` | Too large for MySQL, rarely changes |
| Room ↔ artwork mapping | MySQL | Business logic data — the bridge between OSM and SMK |
| User visit history | MySQL | Personalized data tied to user accounts |
| QR code assignments (artwork ↔ room) | MySQL | Admin-managed mappings |

### Summary

- **Pinia alone is NOT enough** — data is lost on refresh. Use it only for reactive UI state.
- **localStorage** works for small datasets (mappings, history, preferences) but has a ~5-10MB limit.
- **IndexedDB** is the right choice for caching the full SMK catalog (~50MB).
- **MySQL backend** satisfies the school project requirement and handles what needs persistence: room-artwork mappings, user data, visit logs.

---

## Priority Summary

| Priority | Feature | Effort | Impact |
| ---------- | --------- | -------- | -------- |
| **P0** | Progressive map loading (show tiles first) | Low | High — immediate UX fix |
| **P1** | Cache Overpass response (IndexedDB/CacheStorage) | Medium | High — eliminates repeated waits |
| **P1** | Fetch artworks from SMK API per room | Medium | High — core content feature |
| **P2** | Artwork-as-wayfinding-destination | Low | Medium |
| **P2** | Build-time catalog sync script | Medium | Medium |
