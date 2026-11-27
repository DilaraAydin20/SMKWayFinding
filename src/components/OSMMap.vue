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
      <button @click="resetView" :disabled="!isMapLoaded" class="btn btn-primary">{{ t('map.resetView') }}</button>
      <button
        @click="startPathfinding"
        :disabled="!isMapLoaded || pathfindingStep === 'origin' || pathfindingStep === 'destination'"
        class="btn btn-primary"
      >
        {{ t(pathfindingStep === 'complete' ? 'map.planAnotherRoute' : 'map.planRoute') }}
      </button>
      <button
        v-if="selectedStartRoom || selectedDestinationRoom"
        @click="cancelPathfinding"
        class="btn btn-secondary"
      >
        {{ t('map.resetRoute') }}
      </button>
      <form class="room-search-form" role="search" @submit.prevent="searchRoom">
        <input
          v-model="roomSearchQuery"
          class="room-search-input"
          type="search"
          :aria-label="t('map.roomSearchLabel')"
          :placeholder="t('map.roomSearchPlaceholder')"
          :disabled="!isMapLoaded"
        />
        <button type="submit" class="btn btn-primary" :disabled="!isMapLoaded">
          {{ t('map.search') }}
        </button>
        <button
          v-if="searchedRoom"
          type="button"
          class="btn btn-secondary"
          @click="clearRoomHighlight"
        >
          {{ t('map.clearHighlight') }}
        </button>
      </form>
    </div>
    <p v-if="roomSearchMessage" class="room-search-message" role="status">
      {{ roomSearchMessage }}
    </p>

    <!-- Loading State Overlay -->
    <Transition name="fade">
      <div v-if="isLoading && !errorMessage" class="loading-overlay">
        <p>{{ t('map.loading') }}</p>
      </div>
    </Transition>

    <!-- Map Display (wrapper for FAB positioning) -->
    <div class="map-wrapper">
      <!-- Info FAB (bottom-left of map area) -->
      <button
        @click="toggleBuildingInfo"
        class="fab-button fab-info"
        :class="{ 'is-active': showBuildingInfo }"
        :title="t('map.buildingInformation')"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      </button>

      <!-- Scanner Toggle FAB (bottom-right of map area) -->
      <button
        @click="toggleScanner"
        class="fab-button"
        :class="{ 'is-active': drawerOpen }"
        :title="t('map.scanQr')"
      >
        <svg v-if="!drawerOpen" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path :d="cameraIconPath"/>
        </svg>
        <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path :d="xIconPath"/>
        </svg>
      </button>

      <!-- Building Info Popup -->
      <Transition name="slide-up">
        <div v-if="showBuildingInfo" class="building-info-popup">
          <div class="info-popup-header">
            <h3>{{ t('map.buildingInformation') }}</h3>
            <button @click="showBuildingInfo = false" class="btn-close" :aria-label="t('map.closeInfo')">&times;</button>
          </div>
          <div class="info-popup-content">
            <p><strong>{{ t('map.museum') }}:</strong> SMK - Statens Museum for Kunst</p>
            <p><strong>{{ t('map.location') }}:</strong> {{ t('map.city') }}</p>
            <p><strong>{{ t('map.dataSource') }}:</strong> {{ t('map.osmIndoor') }}</p>
            <p><strong>{{ t('map.note') }}:</strong> {{ t('map.mapNote') }}</p>
          </div>
        </div>
      </Transition>

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
          {{ t('map.cancel') }}
        </button>
      </div>

      <div class="level-buttons" role="group" :aria-label="t('map.selectFloor')" :aria-disabled="!isMapLoaded">
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
                <h3>{{ t('map.qrScanner') }}</h3>
                <button type="button" @click.stop="closeDrawer" class="btn-close" :aria-label="t('map.closeScanner')">&times;</button>
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
    <div v-if="errorMessage" class="error-message" role="status">
      <p>{{ t('map.loadError') }}</p>
      <p>{{ t('map.retryingAutomatically') }}</p>
    </div>

    <!-- wayfinding Info Panel -->
    <div class="wayfinding-panel">
      <h3>{{ t('map.currentLocation', { room: currentRoomName }) }}</h3>
      
      <div v-if="!isInRoom">
        <p>{{ t('map.scanToSetLocation') }}</p>
        <p><strong>{{ t('map.museumInfo') }}</strong></p>
        <ul>
          <li>SMK - Statens Museum for Kunst</li>
          <li>{{ t('map.city') }}</li>
          <li>{{ t('map.dataSource') }}: {{ t('map.osmIndoor') }}</li>
        </ul>
      </div>
      
      <div v-else>
        <p>{{ t('map.youAreHere', { room: currentRoomName }) }}</p>
        
        <!-- wayfinding Route Display -->
        <div class="route-info" v-if="wayfindingRoute.length > 0">
          <h4>{{ t('map.nextSteps') }}:</h4>
          <ul>
            <li v-for="(room, index) in wayfindingRoute" :key="index">
              {{ room.name }} ({{ t('map.floorNumber', { level: room.level }) }})
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
import { createApp, defineComponent, h, ref, onMounted, computed, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import QRScanner from './QRScanner.vue'
import { useMuseumwayfinding } from '../store/museumWayfinding.js'
import stairsIconUrl from '../assets/icons/stairs.svg'
import elevatorIconUrl from '../assets/icons/elevator.svg'
import { i18n } from '../i18n/index.js'

// Store reference
const store = useMuseumwayfinding()
const { t, locale } = useI18n()
const isInRoom = computed(() => store.isInRoom)

const BuildingInfoContent = defineComponent({
  setup() {
    const { t } = useI18n()
    return () => h('div', { class: 'building-info-content' }, [
      h('h4', t('map.buildingTitle')),
      h('p', [
        h('strong', `${t('map.dataSource')}: `),
        t('map.osmIndoor'),
        h('br'),
        h('strong', `${t('map.note')}: `),
        t('map.mapNote')
      ])
    ])
  }
})

// Local state using Vue refs for reactivity
const currentLevel = ref('1')
const pathfindingStep = ref('idle')
const selectedStartRoom = ref(null)
const selectedDestinationRoom = ref(null)
const routeWarnings = ref([])
const roomSearchQuery = ref('')
const roomSearchMessage = ref('')
const searchedRoom = ref(null)
const nonInteractiveRoomIds = new Set(['1528606839', '1528606840', '1580154249'])
const levelOptions = computed(() => [
  { value: '0', label: t('map.basement') },
  { value: '1', label: t('map.ground') },
  { value: '2', label: t('map.firstFloor') },
  { value: '3', label: t('map.secondFloor') }
])
let osmMapInstance = null
const isMapLoaded = ref(false)
const isLoading = ref(false)
const errorMessage = ref(null)
let infoControlApp = null
const initialRetryDelayMs = 2000
const maximumRetryDelayMs = 30000
let retryDelayMs = initialRetryDelayMs
let retryTimer = null
let mapComponentMounted = false
let activeRequestController = null

// Drawer � single boolean, no animation-phase tracking needed
const drawerOpen = ref(false)

// Building info popup visibility
const showBuildingInfo = ref(false)

// OSM Data storage (not reactive, used in callbacks)
let indoorWaysRef = [] // Indoor features with geometry, level, and name
let nodeCache = {}     // Cache for node lookups by ID
let indoorLayerGroup = null // Reference to the Leaflet layer group
let pathfindingRouteLayer = null
let plannedRouteSegments = []

// Computed properties
const currentRoomName = computed(() => {
  if (!store.currentLocation) return t('map.unknownRoom')
  const roomName = store.getCurrentRoomName(store.currentLocation)
  return roomName === 'Unknown Room' ? t('map.unknownRoom') : roomName
})

const wayfindingRoute = computed(() => {
  return store.wayfindingRoute
})

const pathfindingPrompt = computed(() => {
  if (pathfindingStep.value === 'origin') return t('map.promptOrigin')
  if (pathfindingStep.value === 'destination') return t('map.promptDestination')
  if (pathfindingStep.value === 'complete') {
    const routeSummary = t('map.routeSelected', {
      start: selectedStartRoom.value.name,
      destination: selectedDestinationRoom.value.name
    })
    const warnings = routeWarnings.value.map(key => t(`map.${key}`)).join(' ')
    return warnings ? `${routeSummary}. ${warnings}` : routeSummary
  }
  return ''
})

function toggleScanner() {
  drawerOpen.value = !drawerOpen.value
}

function closeDrawer() {
  drawerOpen.value = false
}

function toggleBuildingInfo() {
  showBuildingInfo.value = !showBuildingInfo.value
}

// Methods
function switchLevel() {
  if (!osmMapInstance) return;
  console.log('Switching to level:', currentLevel.value)
  updateBuildingDisplayForLevel(currentLevel.value)
  renderPathfindingRoute()
}

function selectLevel(level) {
  currentLevel.value = level
  switchLevel()
}

function startPathfinding() {
  selectedStartRoom.value = null
  selectedDestinationRoom.value = null
  pathfindingStep.value = 'origin'
  clearPathfindingRoute()
  refreshPathfindingStyles()
}

function cancelPathfinding() {
  pathfindingStep.value = 'idle'
  selectedStartRoom.value = null
  selectedDestinationRoom.value = null
  clearPathfindingRoute()
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
  if (pathfindingStep.value === 'complete') {
    createPathfindingRoute()
  }
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
  let layer

  if (way.type === 'steps' || way.type === 'elevator') {
    const position = way.geometry === 'point'
      ? way.coordinates[0]
      : way.coordinates.reduce(
        ([lat, lon], [nextLat, nextLon]) => [lat + nextLat / way.coordinates.length, lon + nextLon / way.coordinates.length],
        [0, 0]
      )
    const iconUrl = way.type === 'steps' ? stairsIconUrl : elevatorIconUrl
    const featureLabel = t(`map.featureTypes.${way.type}`)

    layer = L.marker(position, {
      interactive: layerOptions.interactive,
      title: way.name,
      alt: featureLabel,
      icon: L.divIcon({
        className: `leaflet-div-icon indoor-facility-marker indoor-facility-marker--${way.type}`,
        html: `<img src="${iconUrl}" alt="" />`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18]
      })
    })
  } else {
    layer = way.geometry === 'point'
      ? L.circleMarker(way.coordinates[0], { ...layerOptions, radius: 6 })
      : way.geometry === 'line'
        ? L.polyline(way.coordinates, layerOptions)
        : L.polygon(way.coordinates, layerOptions)
  }

  way.layer = layer
  layer
    .addTo(indoorLayerGroup)
    .bindPopup(getIndoorPopupContent(way))

  if (typeof layer.setStyle === 'function') {
    layer.on('mouseover', function() {
      if (!isPathfindingRoom(way)) {
        this.setStyle({ fillOpacity: 0.3, weight: 3 })
      }
    })
    layer.on('mouseout', function() {
      this.setStyle(getWayStyle(way))
    })
  }
  layer.on('click', () => selectRoomForPathfinding(way))
}

function getIndoorPopupContent(way) {
  return `
    <b>${way.name}</b><br/>
    ${t('map.featureType')}: ${t(`map.featureTypes.${way.type}`)}
  `
  way.layer = layer
}

function refreshPathfindingStyles() {
  indoorWaysRef.forEach(way => {
    if (way.layer && typeof way.layer.setStyle === 'function') {
      way.layer.setStyle(getWayStyle(way))
    }
  })
}

function getFeaturePosition(feature) {
  if (feature.geometry === 'point') return feature.coordinates[0]

  return feature.coordinates.reduce(
    ([lat, lon], [nextLat, nextLon]) => [
      lat + nextLat / feature.coordinates.length,
      lon + nextLon / feature.coordinates.length
    ],
    [0, 0]
  )
}

function getDistance(firstPosition, secondPosition) {
  return L.latLng(firstPosition[0], firstPosition[1])
    .distanceTo(L.latLng(secondPosition[0], secondPosition[1]))
}

function findNearestFeature(features, position) {
  return features.reduce((nearest, feature) => {
    const distance = getDistance(position, getFeaturePosition(feature))
    return !nearest || distance < nearest.distance ? { feature, distance } : nearest
  }, null)?.feature || null
}

function findNearestDoor(level, position) {
  const doors = indoorWaysRef.filter(way => way.type === 'door' && isFeatureOnLevel(way, level))
  return findNearestFeature(doors, position)
}

function getLevelsBetween(startLevel, destinationLevel) {
  const direction = destinationLevel > startLevel ? 1 : -1
  const levels = []

  for (let level = startLevel; ; level += direction) {
    levels.push(level)
    if (level === destinationLevel) return levels
  }
}

function findConnectorChain(levels, originPosition) {
  const connectorsOnStartingLevel = indoorWaysRef.filter(
    way => ['steps', 'elevator'].includes(way.type) && isFeatureOnLevel(way, levels[0])
  )
  const startingConnector = findNearestFeature(connectorsOnStartingLevel, originPosition)
  if (!startingConnector) return null

  const chain = [{
    feature: startingConnector,
    level: levels[0],
    position: getFeaturePosition(startingConnector),
    type: startingConnector.type
  }]

  for (const level of levels.slice(1)) {
    const previousConnector = chain[chain.length - 1]
    const connectors = indoorWaysRef.filter(
      way => ['steps', 'elevator'].includes(way.type) && isFeatureOnLevel(way, level)
    )
    const matchingTypeConnectors = connectors.filter(way => way.type === previousConnector.type)
    const connectorCandidates = matchingTypeConnectors.length ? matchingTypeConnectors : connectors
    const connector = findNearestFeature(connectorCandidates, previousConnector.position)

    if (!matchingTypeConnectors.length && connectors.length) {
      addRouteWarning('missingLevelConnector')
    } else if (!connector) {
      addRouteWarning('missingConnectors')
    }

    chain.push(connector
      ? {
          feature: connector,
          level,
          position: getFeaturePosition(connector),
          type: connector.type
        }
      : {
          feature: null,
          level,
          position: previousConnector.position,
          type: previousConnector.type
        })
  }

  return chain
}

function addRouteWarning(message) {
  if (!routeWarnings.value.includes(message)) routeWarnings.value.push(message)
}

function addPathfindingSegment(level, points) {
  const coordinates = points.filter(Boolean).filter((point, index, allPoints) =>
    index === 0 || getDistance(allPoints[index - 1], point) > 0.25
  )
  if (coordinates.length > 1) {
    plannedRouteSegments.push({ level, coordinates })
  }
}

function clearPathfindingRoute() {
  plannedRouteSegments = []
  routeWarnings.value = []
  if (pathfindingRouteLayer) pathfindingRouteLayer.clearLayers()
}

function renderPathfindingRoute() {
  if (!pathfindingRouteLayer || !osmMapInstance) return

  pathfindingRouteLayer.clearLayers()
  const visibleSegments = plannedRouteSegments.filter(
    segment => segment.level === parseInt(currentLevel.value, 10)
  )

  visibleSegments.forEach(segment => {
    L.polyline(segment.coordinates, {
      color: '#ffffff',
      weight: 9,
      opacity: 0.95,
      interactive: false
    }).addTo(pathfindingRouteLayer)

    L.polyline(segment.coordinates, {
      className: 'planned-route-line',
      color: '#0759e8',
      weight: 5,
      opacity: 1,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false
    }).addTo(pathfindingRouteLayer).bringToFront()
  })

  if (visibleSegments.length) {
    const routePoints = visibleSegments.flatMap(segment => segment.coordinates)
    osmMapInstance.map.fitBounds(L.latLngBounds(routePoints), {
      padding: [50, 50],
      maxZoom: 21
    })
  }
}

function createPathfindingRoute() {
  const startRoom = selectedStartRoom.value
  const destinationRoom = selectedDestinationRoom.value
  if (!startRoom || !destinationRoom) return

  clearPathfindingRoute()
  addRouteWarning('estimatedRoute')
  const startLevel = startRoom.level
  const destinationLevel = destinationRoom.level
  const startPosition = getFeaturePosition(startRoom)
  const destinationPosition = getFeaturePosition(destinationRoom)
  const startDoor = findNearestDoor(startLevel, startPosition)
  const destinationDoor = findNearestDoor(destinationLevel, destinationPosition)

  if (!startDoor || !destinationDoor) {
    addRouteWarning('missingRoomDoors')
  }

  if (startLevel === destinationLevel) {
    addPathfindingSegment(startLevel, [
      startPosition,
      startDoor && getFeaturePosition(startDoor),
      destinationDoor && getFeaturePosition(destinationDoor),
      destinationPosition
    ])
  } else {
    const levels = getLevelsBetween(startLevel, destinationLevel)
    const originAnchor = startDoor ? getFeaturePosition(startDoor) : startPosition
    const connectorChain = findConnectorChain(levels, originAnchor)

    if (!connectorChain) {
      addPathfindingSegment(startLevel, [
        startPosition,
        startDoor && getFeaturePosition(startDoor)
      ])
      addPathfindingSegment(destinationLevel, [
        destinationDoor && getFeaturePosition(destinationDoor),
        destinationPosition
      ])
      addRouteWarning('missingStartingConnectors')
    } else {
      connectorChain.forEach((connector, index) => {
        const previousConnector = connectorChain[index - 1]
        const nextConnector = connectorChain[index + 1]
        const connectorDoor = findNearestDoor(connector.level, connector.position)

        if (index === 0) {
          addPathfindingSegment(connector.level, [
            startPosition,
            startDoor && getFeaturePosition(startDoor),
            connectorDoor && getFeaturePosition(connectorDoor),
            connector.position
          ])
        } else if (index === connectorChain.length - 1) {
          addPathfindingSegment(connector.level, [
            connector.position,
            connectorDoor && getFeaturePosition(connectorDoor),
            destinationDoor && getFeaturePosition(destinationDoor),
            destinationPosition
          ])
        } else {
          const nextConnectorDoor = findNearestDoor(connector.level, nextConnector.position)
          addPathfindingSegment(connector.level, [
            previousConnector.position,
            connectorDoor && getFeaturePosition(connectorDoor),
            nextConnectorDoor && getFeaturePosition(nextConnectorDoor),
            nextConnector.position
          ])
        }
      })
    }
  }

  selectLevel(String(startLevel))
}

function clearRoomHighlight() {
  searchedRoom.value = null
  roomSearchMessage.value = ''
  refreshPathfindingStyles()
}

function searchRoom() {
  const query = roomSearchQuery.value.trim().toLocaleLowerCase()
  if (!query) {
    roomSearchMessage.value = t('map.enterRoomSearch')
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
    roomSearchMessage.value = t('map.roomNotFound', { query: roomSearchQuery.value.trim() })
    refreshPathfindingStyles()
    return
  }

  searchedRoom.value = matchedRoom
  roomSearchMessage.value = t('map.roomFound', {
    room: matchedRoom.name,
    level: matchedRoom.level
  })
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
  mapComponentMounted = true
  loadOSMData()
})

async function loadOSMData() {
  if (!mapComponentMounted || isLoading.value) return

  isLoading.value = true
  errorMessage.value = null
  const controller = new AbortController()
  activeRequestController = controller
  const requestTimeout = setTimeout(() => controller.abort(), 35000)
  
  try {
    // Check if Leaflet is available
    if (typeof L === 'undefined' || !L) {
      throw new Error('Leaflet library not loaded')
    }
    
    // Initialize the map container with SMK coordinates from OSM node reference
    const center = [55.6887, 12.5783] // Based on real OSM Node: 13947795305 (the building entrance)
    
// Initialize map only if it does not exist
if (!osmMapInstance?.map) {
    osmMapInstance = {
      map: L.map('osm-map', {
        center: center,
        zoom: 19,
        minZoom: 17,
        maxZoom: 22,
        scrollWheelZoom: true
      })
    }
    
    // Add OpenStreetMap tiles with proper attribution - this is the key OSM integration!
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(osmMapInstance.map);

    // Add detailed SMK building information control - using OSM data approach
    const infoControl = L.control({ position: 'bottomleft' });
    infoControl.onAdd = function() {
      const div = L.DomUtil.create('div', 'building-info');
      infoControlApp = createApp(BuildingInfoContent)
      infoControlApp.use(i18n)
      infoControlApp.mount(div)
      return div;
    };
    infoControl.onRemove = function() {
      infoControlApp?.unmount()
      infoControlApp = null
    }
    infoControl.addTo(osmMapInstance.map);
}
    // Floor buttons are displayed over the map.

    // Query Overpass API for indoor mapping data around SMK
    await fetchIndoorData(controller.signal)
    if (!mapComponentMounted) return

    pathfindingRouteLayer = L.layerGroup().addTo(osmMapInstance.map)
    
    isMapLoaded.value = true
    retryDelayMs = initialRetryDelayMs
  }
  catch (error) {
    if (!mapComponentMounted) return

    const loadError = controller.signal.aborted
      ? new Error('Overpass API request timed out')
      : error
    console.error('Error loading OpenStreetMap data:', loadError)
    errorMessage.value = loadError.message
    scheduleRetry()
  }
  finally {
    clearTimeout(requestTimeout)
    if (activeRequestController === controller) activeRequestController = null
    if (mapComponentMounted) isLoading.value = false
  }
}

function scheduleRetry() {
  if (!mapComponentMounted || retryTimer !== null) return

  const delay = retryDelayMs
  retryDelayMs = Math.min(retryDelayMs * 2, maximumRetryDelayMs)
  retryTimer = setTimeout(() => {
    retryTimer = null
    loadOSMData()
  }, delay)
}

async function fetchIndoorData(signal) {

  const cacheKey = 'smk-indoor-data'
const cacheDuration = 24 * 60 * 60 * 1000

try {
  const cachedData = JSON.parse(localStorage.getItem(cacheKey))

  if (
    cachedData &&
    Array.isArray(cachedData.data?.elements) &&
    Date.now() - cachedData.timestamp < cacheDuration
  ) {
    console.log('Loading indoor data from cache')
    processOSMData(cachedData.data)
    return
  }
} catch (error) {
  console.warn('Could not load cached indoor data:', error)
}
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
    signal,
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

  // Save indoor data to cache
  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      data: data,
      timestamp: Date.now()
    }))
  } catch (error) {
    console.warn('Could not cache indoor data:', error)
  }
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

function getFeatureLevels(feature) {
  return String(feature.otherTags?.level || feature.level || 0)
    .split(';')
    .map(value => parseInt(value.trim(), 10))
    .filter(Number.isFinite)
}

function isFeatureOnLevel(feature, level) {
  return getFeatureLevels(feature).includes(parseInt(level, 10))
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

  if (filteredWays.length > 0) {
    const bounds = L.latLngBounds(filteredWays.flatMap(way => way.coordinates))
    osmMapInstance.map.fitBounds(bounds, { padding: [50, 50] })
  }

}

// Cleanup when component is unmounted
onUnmounted(() => {
  mapComponentMounted = false
  if (retryTimer !== null) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  activeRequestController?.abort()

  if (osmMapInstance && osmMapInstance.map) {
    try {
      osmMapInstance.map.remove();
    } catch(e) {
      console.log('Error removing map:', e);
    }
  }
})

watch(locale, () => {
  indoorWaysRef.forEach(way => {
    way.layer?.setPopupContent(getIndoorPopupContent(way))
  })
})
</script>

<style scoped>
/* ===== Mobile-First Map Container & Containment ===== */
.osm-map-container {
  position: relative;
  width: 100%;
  overflow: hidden;
}

.map-wrapper {
  position: relative;
  border-radius: 0;
  overflow: hidden;
  z-index: 10; /* Ensure FABs are above map tiles */
  height: calc(100vh - 240px); /* Account for header, controls, and wayfinding panel */
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
  bottom: 16px;
  right: 16px;
  z-index: 1000;
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
  /* Touch-friendly */
  -webkit-tap-highlight-color: transparent;
}

.fab-button:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  background-color: #153e61;
}

.fab-button:active {
  transform: scale(0.95);
}

/* Info FAB - positioned on the left */
.fab-button.fab-info {
  right: 82px;
}

/* Active / open state */
.fab-button.is-active {
  background-color: #dc3545;
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4);
}

.fab-button.is-active:hover {
  background-color: #c82333;
}

/* Info FAB active state - different color */
.fab-button.fab-info.is-active {
  background-color: #1a4d78;
  box-shadow: 0 4px 12px rgba(26, 77, 120, 0.5);
}

.fab-button.fab-info.is-active:hover {
  background-color: #153e61;
}

/* SVG icon sizing */
.fab-button svg {
  pointer-events: none;
}

/* ===== Mobile-First Map Controls ===== */
.map-controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 0;
  /* Touch-friendly controls */
}

.map-controls .btn,
.map-controls select {
  min-height: 44px;
  min-width: 44px;
  padding: 10px 16px;
  font-size: 16px; /* Prevents zoom on iOS */
  border-radius: 8px;
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

:deep(.indoor-facility-marker) {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid;
  border-radius: 50%;
  background-color: white;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.45);
}

:deep(.indoor-facility-marker img) {
  display: block;
  width: 24px;
  height: 24px;
}

:deep(.indoor-facility-marker--steps) {
  border-color: #6f42c1;
}

:deep(.indoor-facility-marker--elevator) {
  border-color: #20a4a8;
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
  height: 100%;
  border: none;
  border-radius: 0;
  overflow: hidden;
}

/* Ensure Leaflet map tiles don't cover FABs */
.map-display .leaflet-container {
  z-index: 1;
}

.map-display.disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* Loading and error overlays - mobile optimized */
.loading-overlay,
.error-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(255, 255, 255, 0.95);
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.2);
  z-index: 1000;
  max-width: calc(100vw - 48px);
  min-width: 280px;
  text-align: center;
}

.loading-overlay p,
.error-message p {
  margin: 0 0 16px 0;
  font-size: 16px;
  line-height: 1.5;
}

.error-message p {
  color: #721c24;
}

.error-message .btn {
  min-height: 44px;
  padding: 12px 24px;
  font-size: 16px;
}

/* ===== Mobile-First Wayfinding Panel ===== */
.wayfinding-panel {
  margin: 0;
  padding: 16px;
  background-color: #f9f9f9;
  border-radius: 0;
  border-top: 1px solid #ddd;
}

.wayfinding-panel h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1a4d78;
  margin-bottom: 12px;
}

.wayfinding-panel p {
  font-size: 15px;
  line-height: 1.5;
  margin: 8px 0;
}

.route-info {
  margin-top: 12px;
  padding: 12px;
  background-color: #e9f7fe;
  border-radius: 8px;
}

.route-info h4 {
  margin: 0 0 8px 0;
  font-size: 15px;
  font-weight: 600;
}

.route-info ul {
  margin: 0;
  padding-left: 20px;
}

.route-info li {
  padding: 6px 0;
  font-size: 14px;
}

/* ===== Mobile-First Buttons ===== */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  min-height: 44px;
  /* Touch-friendly */
  -webkit-tap-highlight-color: transparent;
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

.scanner-drawer-overlay .drawer-backdrop,
.scanner-drawer-overlay {
  position: fixed;
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

/* Panel - full screen on mobile, slide-in on desktop */
.scanner-drawer-overlay .drawer-panel-inner {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  background-color: #fff;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  z-index: 9999;
}

.drawer-enter-active .drawer-panel-inner,
.drawer-leave-active .drawer-panel-inner {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Mobile: slide up from bottom */
.drawer-enter-from .drawer-panel-inner,
.drawer-leave-to .drawer-panel-inner {
  transform: translateY(100%);
}

.drawer-enter-to .drawer-panel-inner,
.drawer-leave-from .drawer-panel-inner {
  transform: translateY(0);
}

/* Drawer header */
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background-color: #1a4d78;
  color: white;
  min-height: 56px;
  flex-shrink: 0;
}

.drawer-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.btn-close {
  background: none;
  border: none;
  color: white;
  font-size: 32px;
  line-height: 1;
  cursor: pointer;
  padding: 8px;
  opacity: 0.7;
  transition: opacity 0.2s;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-close:hover {
  opacity: 1;
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  min-height: 0;
}

/* ===== Building Info Popup - Mobile Optimized ===== */
.building-info-popup {
  position: absolute;
  bottom: 80px;
  left: 16px;
  right: 16px;
  z-index: 1001;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  max-width: calc(100vw - 32px);
  overflow: hidden;
}

.info-popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background-color: #1a4d78;
  color: white;
}

.info-popup-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  flex: 1;
}

.info-popup-content {
  padding: 16px;
}

.info-popup-content p {
  margin: 8px 0;
  font-size: 15px;
  line-height: 1.5;
}

/* ===== Fade Transition ===== */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ===== Slide-up Transition ===== */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.slide-up-enter-to,
.slide-up-leave-from {
  opacity: 1;
  transform: translateY(0);
}

/* ===== Tablet and Up: Side-by-side Layout ===== */
@media (min-width: 768px) {
  .map-wrapper {
    border-radius: 8px;
  }

  .map-controls {
    border-radius: 8px;
    margin-bottom: 12px;
  }

  .map-display {
    border: 1px solid #ccc;
    border-radius: 8px;
    height: calc(80vh - 120px);
  }

  .wayfinding-panel {
    margin-top: 12px;
    border-radius: 8px;
    border: 1px solid #ddd;
  }

  /* Desktop drawer: slide from right */
  .scanner-drawer-overlay .drawer-panel-inner {
    width: 400px;
    max-width: 90vw;
    left: auto;
    right: 0;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.2);
  }

  .drawer-enter-active .drawer-panel-inner,
  .drawer-leave-active .drawer-panel-inner {
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .drawer-enter-from .drawer-panel-inner {
    transform: translateX(100%);
  }

  .drawer-leave-to .drawer-panel-inner {
    transform: translateX(100%);
  }

  .drawer-enter-to .drawer-panel-inner,
  .drawer-leave-from .drawer-panel-inner {
    transform: translateX(0);
  }

  /* Building info popup - fixed width on desktop */
  .building-info-popup {
    right: auto;
    max-width: 340px;
    bottom: 90px;
    left: 20px;
  }

  /* Larger FABs on desktop */
  .fab-button {
    width: 56px;
    height: 56px;
  }

  .fab-button.fab-info {
    right: 86px;
  }
}

/* ===== Desktop: Larger Screens ===== */
@media (min-width: 1024px) {
  .map-controls {
    padding: 12px 16px;
  }

  .wayfinding-panel {
    padding: 20px;
  }

  .building-info-popup {
    max-width: 360px;
  }
}

/* ===== Small Mobile Optimization ===== */
@media (max-width: 360px) {
  .map-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .map-controls .btn,
  .map-controls select {
    width: 100%;
  }

  .fab-button {
    width: 50px;
    height: 50px;
    bottom: 12px;
    right: 12px;
  }

  .fab-button.fab-info {
    right: 72px;
  }

  .building-info-popup {
    left: 12px;
    right: 12px;
    bottom: 70px;
  }
}

/* ===== Small Mobile Optimization ===== */
@media (max-width: 360px) {
  .map-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .map-controls .btn,
  .map-controls select {
    width: 100%;
  }

  .fab-button {
    width: 50px;
    height: 50px;
    bottom: 12px;
    right: 12px;
  }

  .fab-button.fab-info {
    right: 72px;
  }

  .building-info-popup {
    left: 12px;
    right: 12px;
    bottom: 70px;
  }
}

.osm-map-container {
  color: var(--smk-ink);
}

.map-controls {
  gap: 8px;
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid var(--smk-line);
  border-radius: 0;
  background: var(--smk-surface);
}

.map-controls .btn,
.room-search-form .btn,
.error-message .btn,
.route-prompt-button {
  border: 1px solid var(--smk-ink);
  border-radius: 0;
  background: var(--smk-ink);
  color: var(--smk-paper);
  font-weight: 600;
}

.map-controls .btn:hover:not(:disabled),
.room-search-form .btn:hover:not(:disabled),
.error-message .btn:hover:not(:disabled) {
  background: #333;
}

.map-controls .btn-secondary,
.room-search-form .btn-secondary,
.route-prompt-button {
  background: var(--smk-paper);
  color: var(--smk-ink);
}

.map-controls .btn-secondary:hover:not(:disabled),
.room-search-form .btn-secondary:hover:not(:disabled),
.route-prompt-button:hover {
  background: #e8e8e5;
}

.room-search-form {
  gap: 8px;
}

.room-search-input {
  min-width: 0;
  min-height: 44px;
  padding: 9px 12px;
  border: 1px solid #858581;
  border-radius: 0;
  background: var(--smk-paper);
  color: var(--smk-ink);
  font-size: 16px;
}

.room-search-message {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-left: 3px solid var(--smk-ink);
  background: var(--smk-surface);
}

.map-wrapper {
  height: clamp(24rem, 58dvh, 44rem);
  border: 1px solid var(--smk-line);
  border-radius: 0;
  background: var(--smk-surface);
}

.map-display {
  height: 100%;
  border: 0;
  border-radius: 0;
}

.level-buttons {
  right: 86px;
  bottom: 14px;
  gap: 6px;
  padding: 6px;
  border: 1px solid var(--smk-line);
  border-radius: 0;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}

.level-button {
  min-height: 40px;
  padding: 7px 11px;
  border: 1px solid var(--smk-ink);
  border-radius: 0;
  background: var(--smk-paper);
  color: var(--smk-ink);
  font-weight: 600;
}

.level-button:hover:not(:disabled),
.level-button.is-selected {
  background: var(--smk-ink);
  color: var(--smk-paper);
}

.fab-button {
  width: 52px;
  height: 52px;
  border: 1px solid var(--smk-paper);
  border-radius: 50%;
  background: var(--smk-ink);
  color: var(--smk-paper);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.24);
}

.fab-button:hover {
  background: #333;
}

.fab-button.is-active,
.fab-button.is-active:hover {
  background: #333;
}

.fab-button.fab-info {
  right: 78px;
}

.route-prompt {
  max-width: calc(100% - 24px);
  border: 1px solid var(--smk-line);
  border-radius: 0;
}

.route-prompt p {
  line-height: 1.4;
}

.route-prompt-button {
  min-height: 40px;
  padding: 6px 10px;
}

.wayfinding-panel {
  margin-top: 12px;
  padding: 18px;
  border: 1px solid var(--smk-line);
  border-radius: 0;
  background: var(--smk-surface);
}

.wayfinding-panel h3 {
  margin: 0 0 10px;
  color: var(--smk-ink);
  font-size: 1.05rem;
  font-weight: 600;
}

.wayfinding-panel p {
  line-height: 1.55;
}

.route-info {
  border: 1px solid var(--smk-line);
  border-radius: 0;
  background: var(--smk-paper);
}

.loading-overlay,
.error-message,
.building-info-popup {
  border: 1px solid var(--smk-line);
  border-radius: 0;
  background: var(--smk-paper);
  color: var(--smk-ink);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
}

.error-message p {
  color: var(--smk-ink);
}

.drawer-header,
.info-popup-header {
  border-bottom: 1px solid var(--smk-line);
  background: var(--smk-paper);
  color: var(--smk-ink);
}

.drawer-header h3,
.info-popup-header h3 {
  font-weight: 600;
}

.drawer-header .btn-close,
.info-popup-header .btn-close {
  color: var(--smk-ink);
}

.drawer-body {
  padding: 20px;
  background: var(--smk-paper);
}

.info-popup-content {
  background: var(--smk-paper);
}

@media (min-width: 768px) {
  .map-controls {
    border-radius: 0;
  }

  .map-wrapper {
    height: clamp(32rem, 68vh, 50rem);
    border-radius: 0;
  }

  .map-display {
    height: 100%;
    border: 0;
    border-radius: 0;
  }

  .wayfinding-panel {
    border-radius: 0;
  }

  .fab-button.fab-info {
    right: 78px;
  }
}

@media (max-width: 520px) {
  .map-controls {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .map-controls .btn {
    width: 100%;
    min-width: 0;
    padding-inline: 10px;
  }

  .room-search-form {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    width: 100%;
    margin: 0;
  }

  .room-search-input {
    width: 100%;
  }

  .room-search-form .btn-secondary {
    grid-column: 1 / -1;
  }

  .map-wrapper {
    height: clamp(22rem, 54dvh, 36rem);
    min-height: 22rem;
  }

  .wayfinding-panel {
    padding: 15px;
  }
}

@media (max-width: 360px) {
  .map-controls {
    grid-template-columns: 1fr;
  }

  .room-search-form {
    grid-column: auto;
    grid-template-columns: 1fr;
  }

  .room-search-form .btn-secondary {
    grid-column: auto;
  }
}
</style>
