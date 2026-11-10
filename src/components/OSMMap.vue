<!--

OpenStreetMap Indoor Mapping Component for SMK Museum
=====================================================
This component queries the OpenStreetMap Overpass API to fetch and render real indoor mapping data.
It displays actual room polygons, corridors, doors, and other features mapped by OSM contributors.

Data Source: OpenStreetMap Overpass API (https://overpass-api.de/api/interpreter)
Query: Fetches all indoor=room, indoor=corridor, indoor=door ways around SMK building
Rendering: Uses Leaflet.js to render actual OSM way coordinates as polygons on the map
-->
<template>
  <div class="osm-map-container">
    <!-- Map Controls -->
    <div class="map-controls">
      <button @click="resetView" :disabled="!isMapLoaded" class="btn btn-primary">Reset View</button>
      <select v-model="currentLevel" @change="switchLevel" :disabled="!isMapLoaded">
        <option value="all">All Levels</option>
        <option value="-1">Basement (B1)</option>
        <option value="0">Ground Floor (G)</option>
        <option value="1">First Floor</option>
        <option value="2">Second Floor</option>
      </select>
    </div>

    <!-- Loading State Overlay -->
    <Transition name="fade">
      <div v-if="isLoading && !errorMessage" class="loading-overlay">
        <p>Loading OpenStreetMap data...</p>
      </div>
    </Transition>

    <!-- Map Display (wrapper for FAB positioning) -->
    <div class="map-wrapper">
      <!-- Scanner Toggle FAB (bottom-right of map area) -->
      <button
        @click="toggleScanner"
        class="fab-button"
        :class="{ 'is-active': drawerOpen }"
        title="Scan QR Code"
      >
        <svg v-if="!drawerOpen" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path :d="cameraIconPath"/>
        </svg>
        <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path :d="xIconPath"/>
        </svg>
      </button>

      <!-- Leaflet map container -->
      <div id="osm-map" :class="{ 'map-display': true, 'disabled': isLoading }"></div>

      <!-- Scanner Drawer Overlay � single Transition handles enter/leave phases declaratively -->
      <Transition name="drawer">
        <Teleport to="body">
          <div v-if="drawerOpen" class="scanner-drawer-overlay" @click.self="closeDrawer">
            <div class="drawer-backdrop"></div>
            <aside class="drawer-panel-inner">
              <!-- Drawer header -->
              <header class="drawer-header">
                <h3>QR Scanner</h3>
                <button type="button" @click.stop="closeDrawer" class="btn-close" aria-label="Close scanner">&times;</button>
              </header>

              <!-- Drawer body (actual scanner) -->
              <div class="drawer-body">
                <QRScanner />
              </div>
            </aside>
          </div>
        </Teleport>
      </Transition>
    </div>

    <!-- Error Message -->
    <div v-if="errorMessage" class="error-message">
      <p>{{ errorMessage }}</p>
      <button @click="loadOSMData" class="btn btn-secondary">Retry</button>
    </div>

    <!-- wayfinding Info Panel -->
    <div class="wayfinding-panel">
      <h3>Current Location: {{ currentRoomName }}</h3>
      
      <div v-if="!isInRoom">
        <p>Please scan a QR code in a room to set your location.</p>
        <p><strong>Museum Info:</strong></p>
        <ul>
          <li>SMK - Statens Museum for Kunst</li>
          <li>Copenhagen, Denmark</li>
          <li>Data Source: OpenStreetMap Indoor Mapping</li>
        </ul>
      </div>
      
      <div v-else>
        <p>You are currently in: {{ currentRoomName }}</p>
        
        <!-- wayfinding Route Display -->
        <div class="route-info" v-if="wayfindingRoute.length > 0">
          <h4>Next Steps:</h4>
          <ul>
            <li v-for="(room, index) in wayfindingRoute" :key="index">
              {{ room.name }} (Level {{ room.level }})
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const cameraIconPath = 'M3 7V5a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m0 10v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2'
const xIconPath = 'M6.25 6.3a.75.75 0 011.06 0L12 10.94l4.69-4.68a.75.75 0 011.06 1.06L13.06 12l4.69 4.69a.75.75 0 01-1.06 1.06L12 13.06l-4.69 4.69a.75.75 0 01-1.06-1.06L10.94 12 6.25 7.31a.75.75 0 010-1.06z'
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { useMuseumwayfinding } from '../stores/museumwayfinding.js'

// Store reference
const store = useMuseumwayfinding()

// Local state using Vue refs for reactivity
const currentLevel = ref('all')
let osmMapInstance = null
const isMapLoaded = ref(false)
const isLoading = ref(true)
const errorMessage = ref(null)

// Drawer � single boolean, no animation-phase tracking needed
const drawerOpen = ref(false)

// OSM Data storage (not reactive, used in callbacks)
let indoorWaysRef = [] // Array of { id, coordinates: [[lat,lon]], level, name }
let nodeCache = {}     // Cache for node lookups by ID
let indoorLayerGroup = null // Reference to the Leaflet layer group

// Computed properties
const currentRoomName = computed(() => {
  return store.getCurrentRoomName(store.currentLocation) || 'Unknown Room'
})

const wayfindingRoute = computed(() => {
  return store.wayfindingRoute
})

function toggleScanner() {
  drawerOpen.value = !drawerOpen.value
}

function closeDrawer() {
  drawerOpen.value = false
}

// Methods
function switchLevel() {
  if (!osmMapInstance) return;
  console.log('Switching to level:', currentLevel.value)
  updateBuildingDisplayForLevel(currentLevel.value)
}

function resetView() {
  if (osmMapInstance && osmMapInstance.map) {
    // Reset to initial view - centered at SMK entrance
    const center = [55.6887, 12.5783];
    osmMapInstance.map.setView(center, 19)
  }
}

// Initialize when component is mounted
onMounted(() => {
  loadOSMData()
})

async function loadOSMData() {
  isLoading.value = true
  errorMessage.value = null
  
  try {
    // Check if Leaflet is available
    if (typeof L === 'undefined' || !L) {
      throw new Error('Leaflet library not loaded')
    }
    
    // Initialize the map container with SMK coordinates from OSM node reference
    const center = [55.6887, 12.5783] // Based on real OSM Node: 13947795305 (the building entrance)
    
    osmMapInstance = {
      map: L.map('osm-map', {
        center: center,
        zoom: 19,
        minZoom: 17,
        maxZoom: 22
      })
    }
    
    // Add OpenStreetMap tiles with proper attribution - this is the key OSM integration!
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '� <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(osmMapInstance.map);

    // Add detailed SMK building information control - using OSM data approach
    const infoControl = L.control({ position: 'bottomleft' });
    infoControl.onAdd = function() {
      const div = L.DomUtil.create('div', 'building-info');
      div.innerHTML = `
        <div style="background:white; padding:10px; border-radius:5px; box-shadow: 0 0 10px rgba(0,0,0,0.2);">
          <h4>SMK Building</h4>
          <p><strong>Data Source:</strong> OpenStreetMap Indoor Mapping<br/>
             <strong>Note:</strong> Real room data from OSM contributors</p>
        </div>`;
      return div;
    };
    infoControl.addTo(osmMapInstance.map);

    // Add level control (updated for -1,0,1,2 levels)

    // Query Overpass API for indoor mapping data around SMK
    await fetchIndoorData()
    
    isMapLoaded.value = true
  }
  catch (error) {
    console.error('Error loading OpenStreetMap data:', error)
    errorMessage.value = `Failed to load OSM data: ${error.message}`
  }
  finally {
    isLoading.value = false
  }
}

async function fetchIndoorData() {
  // Overpass API query for indoor mapping around SMK (55.6887, 12.5783)
  // This queries all ways with indoor tags in the area
  const overpassQuery = `
    [out:json][timeout:25];
    
    // Find the building relation or way for SMK
    (
      // Query all indoor=room, indoor=corridor, indoor=door features around SMK
      way["indoor"](
        55.6870,12.5760,
        55.6900,12.5800
      );
    );
    
    // Get all nodes for these ways
    (._; >;);
    
    out body;
  `;

  console.log('Querying Overpass API:', overpassQuery)

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: overpassQuery,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  })

  if (!response.ok) {
    throw new Error(`Overpass API request failed with status ${response.status}`)
  }

  const data = await response.json()
  console.log('Received OSM data:', data)

  // Process the ways and nodes from OSM data
  processOSMData(data)
}

function processOSMData(osmData) {
  if (!osmData || !osmData.elements) {
    console.warn('No indoor mapping data found in Overpass response')
    // Still show the map even without indoor data
    return
  }

  // Cache all nodes by ID for later lookup
  osmData.elements.forEach(element => {
    if (element.type === 'node' && element.lat !== undefined) {
      nodeCache[element.id] = { lat: element.lat, lon: element.lon }
    }
  })

  // Process ways with indoor tags
  const indoorWaysFound = []
  osmData.elements.forEach(element => {
    if (element.type === 'way' && element.tags?.indoor) {
      const wayNodes = element.nodes || []
      
      // Convert node IDs to actual coordinates using our cache
      const coords = wayNodes.map(nodeId => {
        const node = nodeCache[nodeId]
        if (node) {
          return [node.lat, node.lon]  // Leaflet expects [lat, lon]
        }
        console.warn(`Node ${nodeId} not found in cache`)
        return null
      }).filter(coord => coord !== null)  // Remove any missing nodes

      if (coords.length >= 3) {  // Need at least 3 points for a polygon
        indoorWaysFound.push({
          id: element.id,
          coordinates: coords,
          level: parseInt(element.tags.level || '0'),
          name: element.tags.name || `Room ${element.id}`,
          type: element.tags.indoor,  // room, corridor, door
          otherTags: { ...element.tags }
        })
      } else {
        console.warn(`Way ${element.id} has insufficient nodes (${coords.length}) for a polygon`)
      }
    }
  })

  indoorWaysRef = indoorWaysFound
  console.log(`Processed ${indoorWaysFound.length} indoor ways from OSM data`)

  // Add entrance marker at the reference coordinate (Node 13947795305) - this is where your node points
  L.marker([55.6887, 12.5783])
    .addTo(osmMapInstance.map)
    .bindPopup('<b>Building Entrance</b><br>SMK Main Entry Point (OSM Node: 13947795305)')

  // Render the indoor features on the map
  renderIndoorFeatures()
}

function renderIndoorFeatures() {
  if (!osmMapInstance || !indoorWaysRef.length) return;

  const map = osmMapInstance.map

  // Create a layer group to hold all indoor features
  indoorLayerGroup = L.layerGroup()

  indoorWaysRef.forEach((way, index) => {
    let style = {}
    
    switch (way.type) {
      case 'room':
        style = {
          color: '#3388ff',
          fillColor: '#3388ff',
          fillOpacity: 0.15,
          weight: 2
        }
        break
      case 'corridor':
        style = {
          color: '#666666',
          fillColor: '#999999',
          fillOpacity: 0.1,
          weight: 1
        }
        break
      case 'door':
        // For doors, we might want to show them as points or small rectangles
        style = {
          color: '#ff6600',
          fillColor: '#ff9933',
          fillOpacity: 0.5,
          weight: 2
        }
        break
      default:
        style = {
          color: '#888888',
          fillColor: '#aaaaaa',
          fillOpacity: 0.1,
          weight: 1
        }
    }

    const polygon = L.polygon(way.coordinates, style)
      .addTo(indoorLayerGroup)
      .bindPopup(`
        <b>${way.name}</b><br/>
        Type: ${way.type}<br/>
        Level: ${way.level}
      `)

    // Add hover effect for better interactivity
    polygon.on('mouseover', function() {
      this.setStyle({ fillOpacity: 0.3, weight: 3 })
    })
    
    polygon.on('mouseout', function() {
      if (way.type === 'room') {
        this.setStyle({ fillOpacity: 0.15, weight: 2 })
      } else {
        this.setStyle(style)
      }
    })

    // Store reference to layer for filtering by level later
    way.layer = polygon
  })

  // Add the indoor features layer group to the map
  indoorLayerGroup.addTo(map)

  // Fit bounds to show all indoor features if we have any
  if (indoorWaysRef.length > 0) {
    const bounds = L.latLngBounds(indoorWaysRef.flatMap(way => way.coordinates))
    osmMapInstance.map.fitBounds(bounds, { padding: [50, 50] })
  }
}

function updateBuildingDisplayForLevel(level) {
  if (!osmMapInstance || !indoorLayerGroup) return;

  const map = osmMapInstance.map
  indoorLayerGroup.clearLayers()

  // Filter ways by selected level (or show all if 'all' is selected)
  const filteredWays = level === 'all'
    ? indoorWaysRef
    : indoorWaysRef.filter(way => way.level === parseInt(level))

  console.log(`Showing ${filteredWays.length} features for level: ${level}`)

  // Re-render the filtered ways
  filteredWays.forEach((way) => {
    let style = {}
    
    switch (way.type) {
      case 'room':
        style = { color: '#3388ff', fillColor: '#3388ff', fillOpacity: 0.15, weight: 2 }
        break
      case 'corridor':
        style = { color: '#666666', fillColor: '#999999', fillOpacity: 0.1, weight: 1 }
        break
      default:
        style = way._originalStyle || { color: '#888888', fillColor: '#aaaaaa', fillOpacity: 0.1, weight: 1 }
    }

    const polygon = L.polygon(way.coordinates, style)
      .addTo(indoorLayerGroup)
      .bindPopup(`
        <b>${way.name}</b><br/>
        Type: ${way.type}<br/>
        Level: ${way.level}
      `)
  })

  // Add entrance marker if showing all levels or ground floor
  if (level === 'all' || level === '0') {
    L.marker([55.6887, 12.5783])
      .addTo(indoorLayerGroup)
      .bindPopup('<b>Building Entrance</b><br>SMK Main Entry Point (OSM Node: 13947795305)')
  }
}

// Cleanup when component is unmounted
onUnmounted(() => {
  if (osmMapInstance && osmMapInstance.map) {
    try {
      osmMapInstance.map.remove();
    } catch(e) {
      console.log('Error removing map:', e);
    }
  }
})
</script>

<style scoped>
/* ===== Map Container & Containment ===== */
.osm-map-container {
  position: relative;
  width: 100%;
  overflow: hidden;
}

.map-wrapper {
  position: relative; /* Context for FAB absolute positioning */
  border-radius: 5px;
  overflow: hidden;
}

/* ===== FAB Button (Floating Action Button) ===== */
.fab-button {
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: 1000; /* Above map tiles but below drawer overlay */
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background-color: #1a4d78;
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}

.fab-button:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  background-color: #153e61;
}

.fab-button:active {
  transform: scale(0.95);
}

/* Active / open state */
.fab-button.is-active {
  background-color: #dc3545;
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
}

.fab-button.is-active:hover {
  background-color: #c82333;
}

/* SVG icon sizing */
.fab-button svg {
  pointer-events: none;
}

.map-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 5px;
}

.map-display {
  width: 100%;
  height: calc(80vh - 120px);
  border: 1px solid #ccc;
  border-radius: 5px;
  overflow: hidden; /* Critical: clips Leaflet's draggable tile layer */
}

.map-display.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.loading-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(255, 255, 255, 0.9);
  padding: 20px;
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  z-index: 5; /* Above tiles (z=4), below FAB (z=1000) */
}

.error-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(255, 240, 240, 0.95);
  padding: 20px;
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  text-align: center;
  z-index: 1000;
}

.error-message p {
  color: #721c24;
  margin-bottom: 15px;
}

.wayfinding-panel {
  margin-top: 20px;
  padding: 15px;
  background-color: #f9f9f9;
  border-radius: 5px;
  border: 1px solid #ddd;
}

.route-info {
  margin-top: 10px;
  padding: 10px;
  background-color: #e9f7fe;
  border-radius: 5px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-secondary {
  background-color: #dc3545;
  color: white;
}

.level-control select {
  padding: 5px;
  border-radius: 3px;
  border: 1px solid #ccc;
}

.building-info {
  font-size: small;
}

/* ===== Drawer Transition Hooks (Vue-managed) ===== */

/* Overlay � fades in/out behind the panel. Teleported to body so it spans full viewport. */
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.3s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

/* Backdrop � fades in/out alongside the overlay wrapper */
.scanner-drawer-overlay .drawer-backdrop,
.scanner-drawer-overlay {
  position: fixed; /* spans full viewport (Teleported to body) */
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 9998;
}

.drawer-enter-active .drawer-backdrop,
.drawer-leave-active .drawer-backdrop {
  transition: opacity 0.3s ease;
}

.drawer-enter-from .drawer-backdrop,
.drawer-leave-to .drawer-backdrop {
  opacity: 0;
}

/* Panel � slides in from the right on enter, slides back out on leave */
.scanner-drawer-overlay .drawer-panel-inner {
  position: fixed; /* spans full viewport (Teleported to body) */
  top: 0;
  right: 0;
  bottom: 0;
  width: 380px;
  max-width: 90vw;
  background-color: #fff;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  z-index: 9999; /* Above map tiles (z=400+) and backdrop */
}

.drawer-enter-active .drawer-panel-inner {
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease;
}

.drawer-leave-active .drawer-panel-inner {
  transition: transform 0.3s ease-in-out, opacity 0.3s ease;
}

/* Initial state for enter (panel off-screen right) */
.drawer-enter-from .drawer-panel-inner {
  transform: translateX(100%);
  opacity: 0;
}

/* Final state after enter completes � panel visible at right edge */
.drawer-enter-to .drawer-panel-inner {
  transform: translateX(0);
  opacity: 1;
}

/* Initial state for leave (panel currently visible) */
.drawer-leave-from .drawer-panel-inner {
  transform: translateX(0);
  opacity: 1;
}

/* Final state after leave completes � panel off-screen right */
.drawer-leave-to .drawer-panel-inner {
  transform: translateX(100%);
  opacity: 0;
}

/* Drawer header & body styles (shared by both scoped and non-scoped contexts) */
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background-color: #1a4d78;
  color: white;
  min-height: 56px;
}

.drawer-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.btn-close {
  background: none;
  border: none;
  color: white;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.btn-close:hover {
  opacity: 1;
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* ===== Fade Transition for loading overlay ===== */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
