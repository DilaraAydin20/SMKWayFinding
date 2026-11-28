# Museum Wayfinding App for SMK (Statens Museum for Kunst)

Vue 3 + Leaflet indoor wayfinding system for Statens Museum for Kunst, Copenhagen. Uses real OpenStreetMap data to render the museum's floor plan with multi-level support and QR-based room/artwork identification.

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Vue 3 |
| **State Management** | Pinia |
| **Map Rendering** | Leaflet.js + OpenStreetMap tiles |
| **Build Tool** | Vite 5 |

## Project Structure

```
frontend/src/
  App.vue                        # Root layout (header, map area, sidebar)
  main.js                        # Vue app entry point
  components/
    ArtworkAudioGuide.vue       # Multilingual artwork description playback
    OSMMap.vue                  # Active Options API map with Overpass integration
    QRScanner.vue              # Camera-based QR code scanner for location/artwork detection
  stores/
    museumwayfinding.js        # Pinia store (current location, wayfinding route, history)
backend/
  server.js                     # Express API and secure ElevenLabs integration
```

## Features

- **Live OSM Floor Plan** - Fetches real indoor mapping data from the Overpass API and renders rooms, corridors, and doors as colored polygons on a Leaflet map.
- **Multi-Level wayfinding** - Filter by floor: Basement (B1), Ground (G), First Floor, Second Floor.
- **QR Code Scanner** - Open the scanner via the FAB button (bottom-right). Scan `room_*` or `artwork_*` QR codes to set your current location or destination.
- **Artwork Text-to-Speech** - Listen to artwork descriptions in Danish, English, German, French, Swedish, or Italian. The ElevenLabs key stays on the backend.
- **Multilingual interface** - Choose Danish, English, German, French, Swedish, or Italian; the selection is remembered in the browser and shared by the interface, artwork descriptions, and speech.
- **Artwork description translations** - SMK descriptions are used when available. Otherwise, the backend translates the Danish text with DeepL and caches successful translations in memory. If translation is unavailable, the Danish original is shown with a notice.
- **Route Guidance** - After setting a destination, step-by-step wayfinding is displayed in the sidebar panel.
- **Visit History** - Tracks all rooms you've scanned into during the session.

## How It Works

1. On mount, `OSMMap.vue` queries the Overpass API for indoor features around SMK (coordinates 55.6887, 12.5783).
2. Indoor ways (`indoor=room`, `indoor=corridor`, etc.) are parsed into Leaflet polygons and rendered on the map with level-based filtering.
3. The user opens the QR scanner via the FAB button in the bottom-right corner of the map.
4. Scanning a `room_XX` code sets your current location; scanning an `artwork_YY` code sets it as your destination.
5. A wayfinding route is calculated and displayed in the sidebar, with step-by-step directions to reach the target room or artwork.

## Getting Started

```bash
npm install
npx -y @elevenlabs/cli@latest onboard init
npm run dev
```

Run these commands from the repository root. `npm install` installs dependencies for both workspaces, and `npm run dev` starts Vite and the Express backend together; open http://localhost:3000. The onboarding command stores `ELEVENLABS_API_KEY` in the ignored `.env.local` file. Do not expose it through a `VITE_` variable or commit it.

To enable artwork-description translations in development, add the DeepL key to the ignored `.env.local` file:

```env
DEEPL_API_KEY=your-deepl-api-key
DEEPL_API_URL=https://api-free.deepl.com/v2/translate
```

Keep both keys on the backend; do not use `VITE_` variables or commit secrets. If `DEEPL_API_KEY` is not configured, the app continues to show the Danish original and an unavailable-translation notice.

For production, build the frontend with `npm run build`, set `ELEVENLABS_API_KEY` and (optionally) `DEEPL_API_KEY` in the server's environment, and run `npm start`. The Express server serves the built frontend and the `/api/tts` and `/api/translate` endpoints. Use `https://api.deepl.com/v2/translate` for a DeepL Pro account.

## QR Code Format

| Prefix | Meaning | Example |
|---|---|---|
| `room_` | Sets current location (e.g., "Skulpturhaven") | Scan in a room to know where you are |
| `artwork_` | Sets wayfinding destination (e.g., "The_Scream") | Scan an artwork tag to navigate toward it |

## OSM Data Source

Indoor data is fetched live from the Overpass API using this query:

```
way["indoor"](55.6870,12.5760,55.6900,12.5800);
(._; >;); out body;
```

This returns all ways tagged with `indoor` within the SMK building footprint. The data is rendered in real time - no hardcoded floor plans are used.

## Known Limitations

- Indoor OSM coverage for SMK may be incomplete depending on contributor mapping activity. If no rooms appear, check your browser console for Overpass API results.
- QR scanner requires HTTPS or localhost (camera permission restriction).
