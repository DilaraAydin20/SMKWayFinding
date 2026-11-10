# Museum Wayfinding App for SMK (Statens Museum for Kunst)

Vue 3 + Leaflet indoor wayfinding system for Statens Museum for Kunst, Copenhagen. Uses real OpenStreetMap data to render the museum's floor plan with multi-level support and QR-based room/artwork identification.

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Vue 3 (Composition API + `<script setup>`) |
| **State Management** | Pinia |
| **Map Rendering** | Leaflet.js + OpenStreetMap tiles |
| **Build Tool** | Vite 5 |

## Project Structure

```
src/
  App.vue                        # Root layout (header, map area, sidebar)
  main.js                        # Vue app entry point
  components/
    OSMMap.vue                 # Interactive floor plan with Overpass API integration
    QRScanner.vue              # Camera-based QR code scanner for location/artwork detection
  stores/
    museumwayfinding.js        # Pinia store (current location, wayfinding route, history)
```

## Features

- **Live OSM Floor Plan** - Fetches real indoor mapping data from the Overpass API and renders rooms, corridors, and doors as colored polygons on a Leaflet map.
- **Multi-Level wayfinding** - Filter by floor: Basement (B1), Ground (G), First Floor, Second Floor.
- **QR Code Scanner** - Open the scanner via the FAB button (bottom-right). Scan `room_*` or `artwork_*` QR codes to set your current location or destination.
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
npm run dev
```

Open http://localhost:3000

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
