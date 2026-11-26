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
      <!-- Info FAB (bottom-left of map area) -->
      <button
        @click="toggleBuildingInfo"
        class="fab-button fab-info"
        :class="{ 'is-active': showBuildingInfo }"
        title="Building Information"
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
        title="Scan QR Code"
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
            <h3>Building Information</h3>
            <button @click="showBuildingInfo = false" class="btn-close" aria-label="Close info">&times;</button>
          </div>
          <div class="info-popup-content">
            <p><strong>Museum:</strong> SMK - Statens Museum for Kunst</p>
            <p><strong>Location:</strong> Copenhagen, Denmark</p>
            <p><strong>Data Source:</strong> OpenStreetMap Indoor Mapping</p>
            <p><strong>Note:</strong> Real room data from OSM contributors shows actual room polygons, corridors, and doors mapped by the community.</p>
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

<script>
import QRScanner from './QRScanner.vue'
import { useMuseumwayfinding } from '../stores/museumWayfinding.js'
import stairsIconUrl from '../assets/icons/stairs.svg'
import elevatorIconUrl from '../assets/icons/elevator.svg'

export default {
  name: 'OSMMap',
  components: { QRScanner },
  data() {
    return {
      store: useMuseumwayfinding(),
      currentLevel: '1',
      pathfindingStep: 'idle',
      selectedStartRoom: null,
      selectedDestinationRoom: null,
      routeWarning: '',
      roomSearchQuery: '',
      roomSearchMessage: '',
      searchedRoom: null,
      isMapLoaded: false,
      isLoading: true,
      errorMessage: null,
      drawerOpen: false,
      showBuildingInfo: false,
      indoorWaysRef: [],
      nodeCache: {},
      indoorLayerGroup: null,
      pathfindingRouteLayer: null,
      plannedRouteSegments: [],
      osmMapInstance: null,
      nonInteractiveRoomIds: new Set(['1528606839', '1528606840', '1580154249']),
      levelOptions: [
        { value: '0', label: 'Basement' },
        { value: '1', label: 'Ground' },
        { value: '2', label: '1st Floor' },
        { value: '3', label: '2nd Floor' }
      ]
    }
  },
  computed: {
    cameraIconPath() {
      return 'M3 7V5a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m0 10v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2'
    },
    xIconPath() {
      return 'M6.25 6.3a.75.75 0 011.06 0L12 10.94l4.69-4.68a.75.75 0 011.06 1.06L13.06 12l4.69 4.69a.75.75 0 01-1.06 1.06L12 13.06l-4.69 4.69a.75.75 0 01-1.06-1.06L10.94 12 6.25 7.31a.75.75 0 010-1.06z'
    },
    currentRoomName() {
      return this.store.getCurrentRoomName(this.store.currentLocation) || 'Unknown Room'
    },
    wayfindingRoute() {
      return this.store.wayfindingRoute
    },
    pathfindingPrompt() {
      if (this.pathfindingStep === 'origin') return 'Select your current location'
      if (this.pathfindingStep === 'destination') return 'Where would you like to go?'
      if (this.pathfindingStep === 'complete') {
        const routeSummary = `Route selected: ${this.selectedStartRoom.name} → ${this.selectedDestinationRoom.name}`
        return this.routeWarning ? `${routeSummary}. ${this.routeWarning}` : routeSummary
      }
      return ''
    },
    isInRoom() {
      return this.store.isInRoom
    }
  },
  mounted() {
    this.loadOSMData()
  },
  beforeUnmount() {
    if (this.osmMapInstance && this.osmMapInstance.map) {
      try {
        this.osmMapInstance.map.remove()
      } catch(e) {
        console.log('Error removing map:', e)
      }
    }
  },
  methods: {
    toggleScanner() {
      this.drawerOpen = !this.drawerOpen
    },
    closeDrawer() {
      this.drawerOpen = false
    },
    toggleBuildingInfo() {
      this.showBuildingInfo = !this.showBuildingInfo
    },
    switchLevel() {
      if (!this.osmMapInstance) return
      console.log('Switching to level:', this.currentLevel)
      this.updateBuildingDisplayForLevel(this.currentLevel)
      this.renderPathfindingRoute()
    },
    selectLevel(level) {
      this.currentLevel = level
      this.switchLevel()
    },
    startPathfinding() {
      this.selectedStartRoom = null
      this.selectedDestinationRoom = null
      this.pathfindingStep = 'origin'
      this.clearPathfindingRoute()
      this.refreshPathfindingStyles()
    },
    cancelPathfinding() {
      this.pathfindingStep = 'idle'
      this.selectedStartRoom = null
      this.selectedDestinationRoom = null
      this.clearPathfindingRoute()
      this.refreshPathfindingStyles()
    },
    selectRoomForPathfinding(way) {
      if (way.type !== 'room') return

      if (this.pathfindingStep === 'origin') {
        this.selectedStartRoom = way
        this.pathfindingStep = 'destination'
      } else if (this.pathfindingStep === 'destination') {
        this.selectedDestinationRoom = way
        this.pathfindingStep = 'complete'
      } else {
        return
      }

      this.refreshPathfindingStyles()
      if (this.pathfindingStep === 'complete') {
        this.createPathfindingRoute()
      }
    },
    isPathfindingRoom(way) {
      return this.selectedStartRoom?.id === way.id || this.selectedDestinationRoom?.id === way.id
    },
    getWayStyle(way) {
      if (this.searchedRoom?.id === way.id) {
        return { color: '#d39e00', fillColor: '#ffc107', fillOpacity: 0.65, weight: 4 }
      }
      if (this.selectedDestinationRoom?.id === way.id) {
        return { color: '#c82333', fillColor: '#dc3545', fillOpacity: 0.55, weight: 4 }
      }
      if (this.selectedStartRoom?.id === way.id) {
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
    },
    createIndoorWayLayer(way) {
      const style = this.getWayStyle(way)
      const layerOptions = {
        ...style,
        interactive: !this.nonInteractiveRoomIds.has(String(way.id))
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
        const featureLabel = way.type === 'steps' ? 'Stairs' : 'Elevator'

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

      layer
        .addTo(this.indoorLayerGroup)
        .bindPopup(`
          <b>${way.name}</b><br/>
          Type: ${way.type}
        `)

      if (typeof layer.setStyle === 'function') {
        layer.on('mouseover', function() {
          if (!this.isPathfindingRoom(way)) {
            this.setStyle({ fillOpacity: 0.3, weight: 3 })
          }
        }.bind(this))
        layer.on('mouseout', function() {
          this.setStyle(this.getWayStyle(way))
        }.bind(this))
      }
      layer.on('click', () => this.selectRoomForPathfinding(way))
      way.layer = layer
    },
    refreshPathfindingStyles() {
      this.indoorWaysRef.forEach(way => {
        if (way.layer && typeof way.layer.setStyle === 'function') {
          way.layer.setStyle(this.getWayStyle(way))
        }
      })
    },
    getFeaturePosition(feature) {
      if (feature.geometry === 'point') return feature.coordinates[0]

      return feature.coordinates.reduce(
        ([lat, lon], [nextLat, nextLon]) => [
          lat + nextLat / feature.coordinates.length,
          lon + nextLon / feature.coordinates.length
        ],
        [0, 0]
      )
    },
    getDistance(firstPosition, secondPosition) {
      return L.latLng(firstPosition[0], firstPosition[1])
        .distanceTo(L.latLng(secondPosition[0], secondPosition[1]))
    },
    findNearestFeature(features, position) {
      if (!features || features.length === 0) return null
      let nearest = null
      for (const feature of features) {
        const distance = this.getDistance(position, this.getFeaturePosition(feature))
        if (!nearest || distance < nearest.distance) {
          nearest = { feature, distance }
        }
      }
      return nearest?.feature || null
    },
    findNearestDoor(level, position) {
      const doors = this.indoorWaysRef.filter(way => way.type === 'door' && this.isFeatureOnLevel(way, level))
      return this.findNearestFeature(doors, position)
    },
    getLevelsBetween(startLevel, destinationLevel) {
      const direction = destinationLevel > startLevel ? 1 : -1
      const levels = []

      for (let level = startLevel; ; level += direction) {
        levels.push(level)
        if (level === destinationLevel) return levels
      }
    },
    findConnectorChain(levels, originPosition) {
      const connectorsOnStartingLevel = this.indoorWaysRef.filter(
        way => ['steps', 'elevator'].includes(way.type) && this.isFeatureOnLevel(way, levels[0])
      )
      const startingConnector = this.findNearestFeature(connectorsOnStartingLevel, originPosition)
      if (!startingConnector) return null

      const chain = [{
        feature: startingConnector,
        level: levels[0],
        position: this.getFeaturePosition(startingConnector),
        type: startingConnector.type
      }]

      for (const level of levels.slice(1)) {
        const previousConnector = chain[chain.length - 1]
        const connectors = this.indoorWaysRef.filter(
          way => ['steps', 'elevator'].includes(way.type) && this.isFeatureOnLevel(way, level)
        )
        const matchingTypeConnectors = connectors.filter(way => way.type === previousConnector.type)
        const connectorCandidates = matchingTypeConnectors.length ? matchingTypeConnectors : connectors
        const connector = this.findNearestFeature(connectorCandidates, previousConnector.position)

        if (!matchingTypeConnectors.length && connectors.length) {
          this.addRouteWarning('The same stair or elevator is not mapped on every floor; using the nearest connector.')
        } else if (!connector) {
          this.addRouteWarning('A floor has no mapped stairs or elevator; continuing at the nearest mapped connector position.')
        }

        chain.push(connector
          ? {
              feature: connector,
              level,
              position: this.getFeaturePosition(connector),
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
    },
    addRouteWarning(message) {
      this.routeWarning = [this.routeWarning, message].filter(Boolean).join(' ')
    },
    addPathfindingSegment(level, points) {
      const coordinates = points.filter(Boolean).filter((point, index, allPoints) =>
        index === 0 || this.getDistance(allPoints[index - 1], point) > 0.25
      )
      if (coordinates.length > 1) {
        this.plannedRouteSegments.push({ level, coordinates })
      }
    },
    clearPathfindingRoute() {
      this.plannedRouteSegments = []
      this.routeWarning = ''
      if (this.pathfindingRouteLayer) this.pathfindingRouteLayer.clearLayers()
    },
    renderPathfindingRoute() {
      if (!this.pathfindingRouteLayer || !this.osmMapInstance) return

      this.pathfindingRouteLayer.clearLayers()
      const visibleSegments = this.plannedRouteSegments.filter(
        segment => segment.level === parseInt(this.currentLevel, 10)
      )

      visibleSegments.forEach(segment => {
        L.polyline(segment.coordinates, {
          color: '#ffffff',
          weight: 9,
          opacity: 0.95,
          interactive: false
        }).addTo(this.pathfindingRouteLayer)

        L.polyline(segment.coordinates, {
          className: 'planned-route-line',
          color: '#0759e8',
          weight: 5,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false
        }).addTo(this.pathfindingRouteLayer).bringToFront()
      })

      if (visibleSegments.length) {
        const routePoints = visibleSegments.flatMap(segment => segment.coordinates)
        this.osmMapInstance.map.fitBounds(L.latLngBounds(routePoints), {
          padding: [50, 50],
          maxZoom: 21
        })
      }
    },
    async createPathfindingRoute() {
      const startRoom = this.selectedStartRoom
      const destinationRoom = this.selectedDestinationRoom
      if (!startRoom || !destinationRoom) return

      this.clearPathfindingRoute()
      this.addRouteWarning('Route is estimated using nearby mapped doors and connectors.')
      const startLevel = startRoom.level
      const destinationLevel = destinationRoom.level
      const startPosition = this.getFeaturePosition(startRoom)
      const destinationPosition = this.getFeaturePosition(destinationRoom)
      const startDoor = this.findNearestDoor(startLevel, startPosition)
      const destinationDoor = this.findNearestDoor(destinationLevel, destinationPosition)

      if (!startDoor || !destinationDoor) {
        this.addRouteWarning('Some room doors are not mapped; using direct links where needed.')
      }

      if (startLevel === destinationLevel) {
        this.addPathfindingSegment(startLevel, [
          startPosition,
          startDoor && this.getFeaturePosition(startDoor),
          destinationDoor && this.getFeaturePosition(destinationDoor),
          destinationPosition
        ])
      } else {
        const levels = this.getLevelsBetween(startLevel, destinationLevel)
        const originAnchor = startDoor ? this.getFeaturePosition(startDoor) : startPosition
        const connectorChain = this.findConnectorChain(levels, originAnchor)

        if (!connectorChain) {
          this.addPathfindingSegment(startLevel, [
            startPosition,
            startDoor && this.getFeaturePosition(startDoor)
          ])
          this.addPathfindingSegment(destinationLevel, [
            destinationDoor && this.getFeaturePosition(destinationDoor),
            destinationPosition
          ])
          this.addRouteWarning('No stairs or elevators are mapped on the starting floor, so the floor change cannot be routed.')
        } else {
          connectorChain.forEach((connector, index) => {
            const previousConnector = connectorChain[index - 1]
            const nextConnector = connectorChain[index + 1]
            const connectorDoor = this.findNearestDoor(connector.level, connector.position)

            if (index === 0) {
              this.addPathfindingSegment(connector.level, [
                startPosition,
                startDoor && this.getFeaturePosition(startDoor),
                connectorDoor && this.getFeaturePosition(connectorDoor),
                connector.position
              ])
            } else if (index === connectorChain.length - 1) {
              this.addPathfindingSegment(connector.level, [
                connector.position,
                connectorDoor && this.getFeaturePosition(connectorDoor),
                destinationDoor && this.getFeaturePosition(destinationDoor),
                destinationPosition
              ])
            } else {
              const nextConnectorDoor = this.findNearestDoor(connector.level, nextConnector.position)
              this.addPathfindingSegment(connector.level, [
                previousConnector.position,
                connectorDoor && this.getFeaturePosition(connectorDoor),
                nextConnectorDoor && this.getFeaturePosition(nextConnectorDoor),
                nextConnector.position
              ])
            }
          })
        }
      }

      this.selectLevel(String(startLevel))
    },
    clearRoomHighlight() {
      this.searchedRoom = null
      this.roomSearchMessage = ''
      this.refreshPathfindingStyles()
    },
    searchRoom() {
      const query = this.roomSearchQuery.trim().toLocaleLowerCase()
      if (!query) {
        this.roomSearchMessage = 'Enter a room name or ref.'
        return
      }

      const rooms = this.indoorWaysRef.filter(way => way.type === 'room')
      const getSearchValues = (room) => [room.otherTags?.name, room.otherTags?.ref]
        .filter(Boolean)
        .map(value => String(value).trim().toLocaleLowerCase())
      const exactMatch = rooms.find(room => getSearchValues(room).includes(query))
      const matchedRoom = exactMatch || rooms.find(room =>
        getSearchValues(room).some(value => value.includes(query))
      )

      if (!matchedRoom) {
        this.searchedRoom = null
        this.roomSearchMessage = `No room found for "${this.roomSearchQuery.trim()}".`
        this.refreshPathfindingStyles()
        return
      }

      this.searchedRoom = matchedRoom
      this.roomSearchMessage = `Found ${matchedRoom.name} on floor ${matchedRoom.level}.`
      this.selectLevel(String(matchedRoom.level))
      this.osmMapInstance.map.fitBounds(L.latLngBounds(matchedRoom.coordinates), {
        padding: [50, 50],
        maxZoom: 21
      })
    },
    resetView() {
      if (this.osmMapInstance && this.osmMapInstance.map) {
        const center = [55.6887, 12.5783]
        this.osmMapInstance.map.setView(center, 19)
      }
    },
    async loadOSMData() {
      this.isLoading = true
      this.errorMessage = null

      try {
        if (typeof L === 'undefined' || !L) {
          throw new Error('Leaflet library not loaded')
        }

        const center = [55.6887, 12.5783]

        if (this.osmMapInstance?.map) {
          this.osmMapInstance.map.remove()
          this.osmMapInstance = null
        }

        this.osmMapInstance = {
          map: L.map('osm-map', {
            center,
            zoom: 19,
            minZoom: 17,
            maxZoom: 22,
            scrollWheelZoom: false
          })
        }

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.osmMapInstance.map)

        const infoControl = L.control({ position: 'bottomleft' })
        infoControl.onAdd = () => {
          const div = L.DomUtil.create('div', 'building-info')
          div.innerHTML = `
            <div style="background:white; padding:10px; border-radius:5px; box-shadow: 0 0 10px rgba(0,0,0,0.2);">
              <h4>SMK Building</h4>
              <p><strong>Data Source:</strong> OpenStreetMap Indoor Mapping<br/>
                 <strong>Note:</strong> Real room data from OSM contributors</p>
            </div>`
          return div
        }
        infoControl.addTo(this.osmMapInstance.map)

        await this.fetchIndoorData()
        this.pathfindingRouteLayer = L.layerGroup().addTo(this.osmMapInstance.map)

        this.isMapLoaded = true
      } catch (error) {
        console.error('Error loading OpenStreetMap data:', error)
        this.errorMessage = `Failed to load OSM data: ${error.message}`
      } finally {
        this.isLoading = false
      }
    },
    async fetchIndoorData() {
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
      `

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

      this.processOSMData(data)
    },
    processOSMData(osmData) {
      if (!osmData || !osmData.elements) {
        console.warn('No indoor mapping data found in Overpass response')
        return
      }

      osmData.elements.forEach(element => {
        if (element.type === 'node' && element.lat !== undefined) {
          this.nodeCache[element.id] = { lat: element.lat, lon: element.lon }
        }
      })

      const indoorWaysFound = []
      osmData.elements.forEach(element => {
        const featureType = this.getFeatureType(element.tags || {})
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
            name: this.getFeatureName(element.tags, featureType, element.id),
            type: featureType,
            otherTags: { ...element.tags }
          })
        } else if (element.type === 'way' && featureType) {
          const wayNodes = element.nodes || []

          const coords = wayNodes.map(nodeId => {
            const node = this.nodeCache[nodeId]
            if (node) {
              return [node.lat, node.lon]
            }
            console.warn(`Node ${nodeId} not found in cache`)
            return null
          }).filter(coord => coord !== null)

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
              name: this.getFeatureName(element.tags, featureType, element.id),
              type: featureType,
              otherTags: { ...element.tags }
            })
          } else if (featureType === 'steps' && coords.length >= 2) {
            indoorWaysFound.push({
              id: element.id,
              geometry: 'line',
              coordinates: coords,
              level: parseInt(element.tags.level || '0'),
              name: this.getFeatureName(element.tags, featureType, element.id),
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
              type: element.tags.indoor,
              otherTags: { ...element.tags }
            })
          } else {
            console.warn(`Way ${element.id} has insufficient nodes (${coords.length}) for an indoor feature`)
          }
        }
      })

      this.indoorWaysRef = indoorWaysFound
      console.log(`Processed ${indoorWaysFound.length} indoor ways from OSM data`)

      this.renderIndoorFeatures()
    },
    getFeatureType(tags) {
      if (tags.door || tags.indoor === 'door') return 'door'
      if (tags.highway === 'steps' || tags.indoor === 'steps' || tags.indoor === 'stairs') return 'steps'
      if (
        tags.highway === 'elevator' ||
        tags.indoor === 'elevator' ||
        (!tags.indoor && tags.elevator && tags.elevator !== 'no')
      ) return 'elevator'
      return tags.indoor || null
    },
    getFeatureName(tags, type, id) {
      if (tags.name) return tags.name
      if (tags.ref) return tags.ref
      if (type === 'room' || type === 'area') return 'Unnamed Room'
      if (type === 'steps') return 'Steps'
      if (type === 'elevator') return 'Elevator'
      return `Door ${id}`
    },
    getFeatureLevels(feature) {
      return String(feature.otherTags?.level || feature.level || 0)
        .split(';')
        .map(value => parseInt(value.trim(), 10))
        .filter(Number.isFinite)
    },
    isFeatureOnLevel(feature, level) {
      return this.getFeatureLevels(feature).includes(parseInt(level, 10))
    },
    renderIndoorFeatures() {
      if (!this.osmMapInstance || !this.indoorWaysRef.length) return

      const map = this.osmMapInstance.map

      this.indoorLayerGroup = L.layerGroup()
      const visibleWays = this.indoorWaysRef.filter(way => this.isFeatureOnLevel(way, this.currentLevel))

      visibleWays.forEach((way) => this.createIndoorWayLayer(way))

      this.indoorLayerGroup.addTo(map)

      if (visibleWays.length > 0) {
        const bounds = L.latLngBounds(visibleWays.flatMap(way => way.coordinates))
        this.osmMapInstance.map.fitBounds(bounds, { padding: [50, 50] })
      }
    },
    updateBuildingDisplayForLevel(level) {
      if (!this.osmMapInstance || !this.indoorLayerGroup) return

      this.indoorLayerGroup.clearLayers()

      const filteredWays = this.indoorWaysRef.filter(way => this.isFeatureOnLevel(way, level))

      console.log(`Showing ${filteredWays.length} features for level: ${level}`)

      filteredWays.forEach((way) => this.createIndoorWayLayer(way))

      if (filteredWays.length > 0) {
        const bounds = L.latLngBounds(filteredWays.flatMap(way => way.coordinates))
        this.osmMapInstance.map.fitBounds(bounds, { padding: [50, 50] })
      }
    }
  }
}
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
</style>
