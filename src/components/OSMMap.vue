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
      <button
        @click="startPathfinding"
        :disabled="!isMapLoaded || pathfindingStep === 'origin' || pathfindingStep === 'destination'"
        class="btn btn-primary"
      >
        {{ pathfindingStep === 'complete' ? 'Plan Another Route' : 'Plan Route' }}
      </button>
      <button
        v-if="selectedStartRoom || selectedDestinationRoom"
        @click="cancelPathfinding"
        class="btn btn-secondary"
      >
        Reset Route
      </button>
      <form class="room-search-form" role="search" @submit.prevent="searchRoom">
        <input
          v-model="roomSearchQuery"
          class="room-search-input"
          type="search"
          aria-label="Search room name or reference"
          placeholder="Search room name or ref"
          :disabled="!isMapLoaded"
        />
        <button type="submit" class="btn btn-primary" :disabled="!isMapLoaded">
          Search
        </button>
        <button
          v-if="searchedRoom"
          type="button"
          class="btn btn-secondary"
          @click="clearRoomHighlight"
        >
          Clear Highlight
        </button>
      </form>
    </div>
    <p v-if="roomSearchMessage" class="room-search-message" role="status">
      {{ roomSearchMessage }}
    </p>

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

      <div v-if="pathfindingStep !== 'idle'" class="route-prompt" role="status" aria-live="polite">
        <p>{{ pathfindingPrompt }}</p>
        <button
          v-if="pathfindingStep === 'origin' || pathfindingStep === 'destination'"
          type="button"
          class="route-prompt-button"
          @click="cancelPathfinding"
        >
          Cancel
        </button>
      </div>

      <div class="level-buttons" role="group" aria-label="Select floor" :aria-disabled="!isMapLoaded">
        <button
          v-for="option in levelOptions"
          :key="option.value"
          type="button"
          class="level-button"
          :class="{ 'is-selected': currentLevel === option.value }"
          :aria-pressed="currentLevel === option.value"
          :disabled="!isMapLoaded"
          @click="selectLevel(option.value)"
        >
          {{ option.label }}
        </button>
      </div>

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
import QRScanner from './QRScanner.vue'
import { useMuseumwayfinding } from '../stores/museumwayfinding.js'

// Store reference
const store = useMuseumwayfinding()

// Local state using Vue refs for reactivity
const currentLevel = ref('1')
const pathfindingStep = ref('idle')
const selectedStartRoom = ref(null)
const selectedDestinationRoom = ref(null)
const roomSearchQuery = ref('')
const roomSearchMessage = ref('')
const searchedRoom = ref(null)
const nonInteractiveRoomIds = new Set(['1528606839', '1528606840', '1580154249'])
const levelOptions = [
  { value: '0', label: 'Basement' },
  { value: '1', label: 'Ground' },
  { value: '2', label: '1st Floor' },
  { value: '3', label: '2nd Floor' }
]
let osmMapInstance = null
const isMapLoaded = ref(false)
const isLoading = ref(true)
const errorMessage = ref(null)

// Drawer � single boolean, no animation-phase tracking needed
const drawerOpen = ref(false)

// OSM Data storage (not reactive, used in callbacks)
let indoorWaysRef = [] // Indoor features with geometry, level, and name
let nodeCache = {}     // Cache for node lookups by ID
let indoorLayerGroup = null // Reference to the Leaflet layer group

// Computed properties
const currentRoomName = computed(() => {
  return store.getCurrentRoomName(store.currentLocation) || 'Unknown Room'
})

const wayfindingRoute = computed(() => {
  return store.wayfindingRoute
})

const pathfindingPrompt = computed(() => {
  if (pathfindingStep.value === 'origin') return 'Select your current location'
  if (pathfindingStep.value === 'destination') return 'Where would you like to go?'
  if (pathfindingStep.value === 'complete') {
    return `Route selected: ${selectedStartRoom.value.name} → ${selectedDestinationRoom.value.name}`
  }
  return ''
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

function selectLevel(level) {
  currentLevel.value = level
  switchLevel()
}

function startPathfinding() {
  selectedStartRoom.value = null
  selectedDestinationRoom.value = null
  pathfindingStep.value = 'origin'
  refreshPathfindingStyles()
}

function cancelPathfinding() {
  pathfindingStep.value = 'idle'
  selectedStartRoom.value = null
  selectedDestinationRoom.value = null
  refreshPathfindingStyles()
}

function selectRoomForPathfinding(way) {
  if (way.type !== 'room') return

  if (pathfindingStep.value === 'origin') {
    selectedStartRoom.value = way
    pathfindingStep.value = 'destination'
  } else if (pathfindingStep.value === 'destination') {
    selectedDestinationRoom.value = way
    pathfindingStep.value = 'complete'
  } else {
    return
  }

  refreshPathfindingStyles()
}

function isPathfindingRoom(way) {
  return selectedStartRoom.value?.id === way.id || selectedDestinationRoom.value?.id === way.id
}

function getWayStyle(way) {
  if (searchedRoom.value?.id === way.id) {
    return { color: '#d39e00', fillColor: '#ffc107', fillOpacity: 0.65, weight: 4 }
  }
  if (selectedDestinationRoom.value?.id === way.id) {
    return { color: '#c82333', fillColor: '#dc3545', fillOpacity: 0.55, weight: 4 }
  }
  if (selectedStartRoom.value?.id === way.id) {
    return { color: '#218838', fillColor: '#28a745', fillOpacity: 0.55, weight: 4 }
  }

  switch (way.type) {
    case 'room':
      return { color: '#3388ff', fillColor: '#3388ff', fillOpacity: 0.15, weight: 2 }
    case 'corridor':
      return { color: '#666666', fillColor: '#999999', fillOpacity: 0.1, weight: 1 }
    case 'door':
      return { color: '#ff6600', fillColor: '#ff9933', fillOpacity: 0.5, weight: 2 }
    case 'steps':
      return { color: '#6f42c1', weight: 4, opacity: 0.9 }
    case 'elevator':
      return { color: '#20a4a8', fillColor: '#20a4a8', fillOpacity: 0.9, weight: 3 }
    default:
      return { color: '#888888', fillColor: '#aaaaaa', fillOpacity: 0.1, weight: 1 }
  }
}

function createIndoorWayLayer(way) {
  const style = getWayStyle(way)
  const layerOptions = {
    ...style,
    interactive: !nonInteractiveRoomIds.has(String(way.id))
  }
  const layer = way.geometry === 'point'
    ? L.circleMarker(way.coordinates[0], { ...layerOptions, radius: 6 })
    : way.geometry === 'line'
      ? L.polyline(way.coordinates, layerOptions)
      : L.polygon(way.coordinates, layerOptions)
  layer
    .addTo(indoorLayerGroup)
    .bindPopup(`
      <b>${way.name}</b><br/>
      Type: ${way.type}
    `)

  layer.on('mouseover', function() {
    if (!isPathfindingRoom(way)) {
      this.setStyle({ fillOpacity: 0.3, weight: 3 })
    }
  })
  layer.on('mouseout', function() {
    this.setStyle(getWayStyle(way))
  })
  layer.on('click', () => selectRoomForPathfinding(way))
  way.layer = layer
}

function refreshPathfindingStyles() {
  indoorWaysRef.forEach(way => {
    if (way.layer) way.layer.setStyle(getWayStyle(way))
  })
}

function clearRoomHighlight() {
  searchedRoom.value = null
  roomSearchMessage.value = ''
  refreshPathfindingStyles()
}

function searchRoom() {
  const query = roomSearchQuery.value.trim().toLocaleLowerCase()
  if (!query) {
    roomSearchMessage.value = 'Enter a room name or ref.'
    return
  }

  const rooms = indoorWaysRef.filter(way => way.type === 'room')
  const getSearchValues = room => [room.otherTags?.name, room.otherTags?.ref]
    .filter(Boolean)
    .map(value => String(value).trim().toLocaleLowerCase())
  const exactMatch = rooms.find(room => getSearchValues(room).includes(query))
  const matchedRoom = exactMatch || rooms.find(room =>
    getSearchValues(room).some(value => value.includes(query))
  )

  if (!matchedRoom) {
    searchedRoom.value = null
    roomSearchMessage.value = `No room found for "${roomSearchQuery.value.trim()}".`
    refreshPathfindingStyles()
    return
  }

  searchedRoom.value = matchedRoom
  roomSearchMessage.value = `Found ${matchedRoom.name} on floor ${matchedRoom.level}.`
  selectLevel(String(matchedRoom.level))
  osmMapInstance.map.fitBounds(L.latLngBounds(matchedRoom.coordinates), {
    padding: [50, 50],
    maxZoom: 21
  })
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

    // Floor buttons are displayed over the map.

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
    
    // Fetch indoor features, stairs, and elevators, including point features
    (
      way["indoor"](
        55.6870,12.5760,
        55.6900,12.5800
      );
      way["door"](
        55.6870,12.5760,
        55.6900,12.5800
      );
      way["highway"~"^(steps|elevator)$"](
        55.6870,12.5760,
        55.6900,12.5800
      );
      way["indoor"~"^(stairs|steps|elevator)$"](
        55.6870,12.5760,
        55.6900,12.5800
      );
      way["elevator"](
        55.6870,12.5760,
        55.6900,12.5800
      );
      node["door"](
        55.6870,12.5760,
        55.6900,12.5800
      );
      node["indoor"="door"](
        55.6870,12.5760,
        55.6900,12.5800
      );
      node["highway"="elevator"](
        55.6870,12.5760,
        55.6900,12.5800
      );
      node["highway"="steps"](
        55.6870,12.5760,
        55.6900,12.5800
      );
      node["indoor"~"^(stairs|steps|elevator)$"](
        55.6870,12.5760,
        55.6900,12.5800
      );
      node["elevator"](
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

  // Process indoor ways and door nodes
  const indoorWaysFound = []
  osmData.elements.forEach(element => {
    const featureType = getFeatureType(element.tags || {})
    if (
      element.type === 'node' &&
      ['door', 'steps', 'elevator'].includes(featureType) &&
      element.lat !== undefined
    ) {
      indoorWaysFound.push({
        id: element.id,
        geometry: 'point',
        coordinates: [[element.lat, element.lon]],
        level: parseInt(element.tags.level || '0'),
        name: getFeatureName(element.tags, featureType, element.id),
        type: featureType,
        otherTags: { ...element.tags }
      })
    } else if (element.type === 'way' && featureType) {
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

      if ((featureType === 'door' || featureType === 'elevator') && coords.length > 0) {
        const center = coords.reduce(
          ([lat, lon], [nextLat, nextLon]) => [lat + nextLat / coords.length, lon + nextLon / coords.length],
          [0, 0]
        )
        indoorWaysFound.push({
          id: element.id,
          geometry: 'point',
          coordinates: [center],
          level: parseInt(element.tags.level || '0'),
          name: getFeatureName(element.tags, featureType, element.id),
          type: featureType,
          otherTags: { ...element.tags }
        })
      } else if (featureType === 'steps' && coords.length >= 2) {
        indoorWaysFound.push({
          id: element.id,
          geometry: 'line',
          coordinates: coords,
          level: parseInt(element.tags.level || '0'),
          name: getFeatureName(element.tags, featureType, element.id),
          type: featureType,
          otherTags: { ...element.tags }
        })
      } else if (coords.length >= 3) {
        const isRoomOrArea = element.tags.indoor === 'room' || element.tags.indoor === 'area'
        indoorWaysFound.push({
          id: element.id,
          geometry: 'polygon',
          coordinates: coords,
          level: parseInt(element.tags.level || '0'),
          name: element.tags.name || (
            isRoomOrArea ? element.tags.ref || 'Unnamed Room' : `${element.tags.indoor} ${element.id}`
          ),
          type: element.tags.indoor,  // room, corridor, door
          otherTags: { ...element.tags }
        })
      } else {
        console.warn(`Way ${element.id} has insufficient nodes (${coords.length}) for an indoor feature`)
      }
    }
  })

  indoorWaysRef = indoorWaysFound
  console.log(`Processed ${indoorWaysFound.length} indoor ways from OSM data`)

  // Render the indoor features on the map
  renderIndoorFeatures()
}

function getFeatureType(tags) {
  if (tags.door || tags.indoor === 'door') return 'door'
  if (tags.highway === 'steps' || tags.indoor === 'steps' || tags.indoor === 'stairs') return 'steps'
  if (
    tags.highway === 'elevator' ||
    tags.indoor === 'elevator' ||
    (!tags.indoor && tags.elevator && tags.elevator !== 'no')
  ) return 'elevator'
  return tags.indoor || null
}

function getFeatureName(tags, type, id) {
  if (tags.name) return tags.name
  if (tags.ref) return tags.ref
  if (type === 'room' || type === 'area') return 'Unnamed Room'
  if (type === 'steps') return 'Steps'
  if (type === 'elevator') return 'Elevator'
  return `Door ${id}`
}

function isFeatureOnLevel(feature, level) {
  const featureLevels = String(feature.otherTags?.level || feature.level || 0)
    .split(';')
    .map(value => parseInt(value.trim(), 10))
    .filter(Number.isFinite)
  return featureLevels.includes(parseInt(level, 10))
}

function renderIndoorFeatures() {
  if (!osmMapInstance || !indoorWaysRef.length) return;

  const map = osmMapInstance.map

  // Create a layer group to hold all indoor features
  indoorLayerGroup = L.layerGroup()
  const visibleWays = indoorWaysRef.filter(way => isFeatureOnLevel(way, currentLevel.value))

  visibleWays.forEach(createIndoorWayLayer)

  // Add the indoor features layer group to the map
  indoorLayerGroup.addTo(map)

  // Fit bounds to show all indoor features if we have any
  if (visibleWays.length > 0) {
    const bounds = L.latLngBounds(visibleWays.flatMap(way => way.coordinates))
    osmMapInstance.map.fitBounds(bounds, { padding: [50, 50] })
  }
}

function updateBuildingDisplayForLevel(level) {
  if (!osmMapInstance || !indoorLayerGroup) return;

  indoorLayerGroup.clearLayers()

  const filteredWays = indoorWaysRef.filter(way => isFeatureOnLevel(way, level))

  console.log(`Showing ${filteredWays.length} features for level: ${level}`)

  // Re-render the filtered ways
  filteredWays.forEach(createIndoorWayLayer)

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

.level-buttons {
  position: absolute;
  left: 12px;
  right: 88px;
  bottom: 14px;
  z-index: 1000;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px;
  border-radius: 6px;
  background-color: rgba(255, 255, 255, 0.94);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.level-button {
  padding: 7px 10px;
  border: 1px solid #1a4d78;
  border-radius: 4px;
  background-color: white;
  color: #1a4d78;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.level-button:hover:not(:disabled),
.level-button.is-selected {
  background-color: #1a4d78;
  color: white;
}

.level-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
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
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 5px;
}

.room-search-form {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

.room-search-input {
  width: 220px;
  max-width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

.room-search-message {
  margin: 0 10px 10px;
}

.route-prompt {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1001;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: calc(100% - 32px);
  padding: 10px 14px;
  border-radius: 6px;
  background-color: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.route-prompt p {
  margin: 0;
  font-weight: 600;
}

.route-prompt-button {
  padding: 5px 9px;
  border: 1px solid #1a4d78;
  border-radius: 4px;
  background-color: white;
  color: #1a4d78;
  cursor: pointer;
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
