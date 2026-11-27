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
      <button @click="resetView" :disabled="!isMapLoaded" class="btn" :aria-label="$t('map.resetView')">{{ $t('map.resetView') }}</button>
      <button
        @click="startPathfinding"
        :disabled="!isMapLoaded || pathfindingStep === 'origin' || pathfindingStep === 'destination'"
        class="btn"
      >
        {{ pathfindingStep === 'complete' ? $t('map.planAnotherRoute') : $t('map.planRoute') }}
      </button>
      <button
        v-if="selectedStartRoom || selectedDestinationRoom"
        @click="cancelPathfinding"
        class="btn btn-secondary"
      >
        {{ $t('map.resetRoute') }}
      </button>
      <form class="room-search-form" role="search" @submit.prevent="searchRoom">
        <input
          v-model="roomSearchQuery"
          class="room-search-input"
          type="search"
          :aria-label="$t('map.roomSearchLabel')"
          :placeholder="$t('map.roomSearchPlaceholder')"
          :disabled="!isMapLoaded"
        />
        <button type="submit" class="btn btn-primary" :disabled="!isMapLoaded">
          {{ $t('map.search') }}
        </button>
        <button
          v-if="searchedRoom"
          type="button"
          class="btn btn-secondary"
          @click="clearRoomHighlight"
        >
          {{ $t('map.clearHighlight') }}
        </button>
      </form>
    </div>
    <p v-if="roomSearchMessage" class="room-search-message" role="status">
      {{ roomSearchMessage }}
    </p>

    <!-- Loading State Overlay -->
    <Transition name="fade">
      <div v-if="isLoading && !errorMessage" class="loading-overlay">
        <p>{{ $t('map.loading') }}</p>
      </div>
    </Transition>

    <!-- Map Display (wrapper for FAB positioning) -->
    <div class="map-wrapper">
      <!-- Building Info Popup -->
      <Transition name="slide-up">
        <div v-if="showBuildingInfo" class="building-info-popup">
          <div class="info-popup-header">
            <h3>{{ $t('map.buildingInformation') }}</h3>
            <button @click="showBuildingInfo = false" class="btn-close" :aria-label="$t('map.closeInfo')">&times;</button>
          </div>
          <div class="info-popup-content">
            <p><strong>{{ $t('map.museum') }}:</strong> SMK - Statens Museum for Kunst</p>
            <p><strong>{{ $t('map.location') }}:</strong> {{ $t('map.city') }}</p>
            <p><strong>{{ $t('map.dataSource') }}:</strong> {{ $t('map.osmIndoor') }}</p>
            <p><strong>{{ $t('map.note') }}:</strong> {{ $t('map.mapNote') }}</p>
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
          {{ $t('map.cancel') }}
        </button>
      </div>

      <!-- Floor Picker: compact vertical strip on the left -->
      <div class="level-buttons" role="group" :aria-label="$t('map.selectFloor')" :aria-disabled="!isMapLoaded">
        <span class="level-label">{{ $t('app.map') }}</span>
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

      <!-- FAB buttons: stacked on the right -->
      <div class="fab-stack">
        <button
          @click="toggleBuildingInfo"
          class="fab-button fab-info"
          :class="{ 'is-active': showBuildingInfo }"
          :title="$t('map.buildingInformation')"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </button>

        <button
          @click="toggleScanner"
          class="fab-button fab-scanner"
          :class="{ 'is-active': drawerOpen }"
          :title="$t('map.scanQr')"
        >
          <svg v-if="!drawerOpen" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path :d="cameraIconPath"/>
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path :d="xIconPath"/>
          </svg>
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
                <h3>{{ $t('map.qrScanner') }}</h3>
                <button type="button" @click.stop="closeDrawer" class="btn-close" :aria-label="$t('map.closeScanner')">&times;</button>
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
      <button @click="loadOSMData" class="btn btn-secondary">{{ $t('map.retry') }}</button>
    </div>

    <!-- wayfinding Info Panel -->
    <div class="wayfinding-panel">
      <h3>{{ $t('map.currentLocation', { room: currentRoomName }) }}</h3>

      <div v-if="!isInRoom">
        <p>{{ $t('map.scanToSetLocation') }}</p>
        <p><strong>{{ $t('map.museumInfo') }}</strong></p>
        <ul>
          <li>SMK - Statens Museum for Kunst</li>
          <li>{{ $t('map.city') }}</li>
          <li>{{ $t('map.osmIndoor') }}</li>
        </ul>
      </div>

      <div v-else>
        <p>{{ $t('map.youAreHere', { room: currentRoomName }) }}</p>

        <!-- wayfinding Route Display -->
        <div class="route-info" v-if="wayfindingRoute.length > 0">
          <h4>{{ $t('map.nextSteps') }}</h4>
          <ul>
            <li v-for="(room, index) in wayfindingRoute" :key="index">
              {{ room.name }} ({{ $t('map.levelLabel') }} {{ room.level }})
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
        { value: '-1', label: '-1' },
        { value: '0', label: '0' },
        { value: '1', label: '1' },
        { value: '2', label: '2' }
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
      return this.store.getCurrentRoomName(this.store.currentLocation) || this.$t('map.unknownRoom')
    },
    wayfindingRoute() {
      return this.store.wayfindingRoute
    },
    pathfindingPrompt() {
      if (this.pathfindingStep === 'origin') return this.$t('map.promptOrigin')
      if (this.pathfindingStep === 'destination') return this.$t('map.promptDestination')
      if (this.pathfindingStep === 'complete') {
        const routeSummary = this.$t('map.routeSelected', { start: this.selectedStartRoom.name, destination: this.selectedDestinationRoom.name })
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
        return { color: 'var(--smk-ink)', fillColor: 'var(--smk-ink)', fillOpacity: 0.4, weight: 4 }
      }
      if (this.selectedDestinationRoom?.id === way.id) {
        return { color: 'var(--smk-ink)', fillColor: 'var(--smk-ink)', fillOpacity: 0.55, weight: 4 }
      }
      if (this.selectedStartRoom?.id === way.id) {
        return { color: 'var(--smk-ink)', fillColor: 'var(--smk-ink)', fillOpacity: 0.35, weight: 4 }
      }

      switch (way.type) {
        case 'room':
          return { color: 'var(--smk-ink)', fillColor: 'var(--smk-ink)', fillOpacity: 0.12, weight: 2 }
        case 'corridor':
          return { color: 'var(--smk-muted)', fillColor: 'var(--smk-surface)', fillOpacity: 0.15, weight: 1 }
        case 'door':
          return { color: 'var(--smk-ink)', fillColor: 'var(--smk-ink)', fillOpacity: 0.35, weight: 2 }
        default:
          return { color: 'var(--smk-line)', fillColor: 'var(--smk-surface)', fillOpacity: 0.1, weight: 1 }
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
        const featureLabel = way.type === 'steps' ? this.$t('map.featureTypes.steps') : this.$t('map.featureTypes.elevator')

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
          ${this.$t('map.featureType')}: ${this.$t(`map.featureTypes.${way.type}`, { defaultValue: way.type })}
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
      const osmCurrentLevel = parseInt(this.currentLevel, 10) + 1
      const visibleSegments = this.plannedRouteSegments.filter(
        segment => segment.level === osmCurrentLevel
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
          color: '#111',
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
        this.roomSearchMessage = this.$t('map.enterRoomSearch')
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
        this.roomSearchMessage = this.$t('map.roomNotFound', { query: this.roomSearchQuery.trim() })
        this.refreshPathfindingStyles()
        return
      }

      this.searchedRoom = matchedRoom
      this.roomSearchMessage = this.$t('map.roomFound', { room: matchedRoom.name, level: matchedRoom.level })
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
            <div style="background:white; padding:10px; border: 1px solid #d8d8d5;">
              <h4>SMK Building</h4>
              <p><strong>Data Source:</strong> OpenStreetMap Indoor Mapping<br/>
                 <strong>Note:</strong> Real room data from OSM contributors</p>
            </div>`
          return div
        }
        infoControl.addTo(this.osmMapInstance.map)

        // Try fetching indoor data once; fall back to mock data if it fails
        let fetchFailed = false
        try {
          const data = await this.fetchIndoorDataRaw()
          this.processOSMData(data)
        } catch (err) {
          fetchFailed = true
          console.warn('Overpass API failed, loading fallback data:', err.message)
        }

        if (fetchFailed) {
          this.errorMessage = null
          this.processFallbackData()
        }

        this.pathfindingRouteLayer = L.layerGroup().addTo(this.osmMapInstance.map)

        this.isMapLoaded = true
      } catch (error) {
        console.error('Error loading OpenStreetMap data:', error)
      } finally {
        this.isLoading = false
      }
    },
    processFallbackData() {
      // Generate mock indoor mapping data for SMK building when Overpass is unreachable
      console.log('[OSMMap] Loading fallback indoor data...')
      const centerLat = 55.6887
      const centerLon = 12.5783
      const latStep = 0.00005
      const lonStep = 0.00008

      const nodes = {}
      let nodeId = 10000
      const ways = []
      let wayId = 20000

      const createRectRoom = (id, name, latCenter, lonCenter, level, type = 'room') => {
        const hwLat = latStep * 0.8 // half-width lat
        const hwLon = lonStep * 1.2 // half-width lon
        const corners = [
          [latCenter - hwLat, lonCenter - hwLon],
          [latCenter - hwLat, lonCenter + hwLon],
          [latCenter + hwLat, lonCenter + hwLon],
          [latCenter + hwLat, lonCenter - hwLon]
        ]

        const nodeIds = corners.map(() => nodeId++)
        nodeIds.forEach((nid, i) => {
          nodes[nid] = { lat: corners[i][0], lon: corners[i][1] }
        })

        ways.push({
          id: id,
          type: 'way',
          tags: { indoor: type, name, level: String(level), ref: `room-${id}` },
          nodes: nodeIds
        })

        return {
          id: `fallback-${id}`,
          geometry: 'polygon',
          coordinates: corners,
          level,
          name,
          type,
          otherTags: { name, level: String(level), ref: `room-${id}` }
        }
      }

      const createDoor = (id, lat, lon, level) => {
        const nid = nodeId++
        nodes[nid] = { lat, lon }
        ways.push({
          id, type: 'way', tags: { indoor: 'door', level: String(level) }, nodes: [nid]
        })
        return {
          id: `fallback-${id}`, geometry: 'point', coordinates: [[lat, lon]],
          level, name: `Door ${id}`, type: 'door',
          otherTags: { indoor: 'door', level: String(level) }
        }
      }

      const createStairs = (id, lat, lon, level) => {
        const nid1 = nodeId++
        const nid2 = nodeId++
        nodes[nid1] = { lat: lat - latStep * 0.3, lon }
        nodes[nid2] = { lat: lat + latStep * 0.3, lon }
        ways.push({
          id, type: 'way', tags: { indoor: 'stairs', level: String(level) }, nodes: [nid1, nid2]
        })
        return {
          id: `fallback-${id}`, geometry: 'line', coordinates: [[lat - latStep * 0.3, lon], [lat + latStep * 0.3, lon]],
          level, name: `Stairs ${id}`, type: 'stairs',
          otherTags: { indoor: 'stairs', level: String(level) }
        }
      }

      const createElevator = (id, lat, lon, level) => {
        const nid = nodeId++
        nodes[nid] = { lat, lon }
        ways.push({
          id, type: 'way', tags: { indoor: 'elevator', level: String(level) }, nodes: [nid]
        })
        return {
          id: `fallback-${id}`, geometry: 'point', coordinates: [[lat, lon]],
          level, name: `Elevator ${id}`, type: 'elevator',
          otherTags: { indoor: 'elevator', level: String(level) }
        }
      }

      const fallbackElements = []

      // Level -1 (Basement)
      fallbackElements.push(
        createRectRoom(30001, 'Storage Room A', centerLat + 0.00015, centerLon - 0.0002, -1),
        createRectRoom(30002, 'Storage Room B', centerLat - 0.00015, centerLon - 0.0002, -1),
        createRectRoom(30003, 'Mechanical Room', centerLat, centerLon + 0.0002, -1),
        createDoor(40001, centerLat, centerLon - 0.0005, -1),
        createStairs(50001, centerLat + 0.0003, centerLon + 0.0005, -1),
        createElevator(60001, centerLat - 0.0003, centerLon + 0.0005, -1)
      )

      // Level 0 (Ground Floor)
      fallbackElements.push(
        createRectRoom(30010, 'Main Hall', centerLat, centerLon, 0),
        createRectRoom(30011, 'Gallery 1', centerLat + 0.0002, centerLon - 0.0004, 0),
        createRectRoom(30012, 'Gallery 2', centerLat - 0.0002, centerLon - 0.0004, 0),
        createRectRoom(30013, 'Gallery 3', centerLat + 0.0002, centerLon + 0.0004, 0),
        createRectRoom(30014, 'Gallery 4', centerLat - 0.0002, centerLon + 0.0004, 0),
        createDoor(40010, centerLat, centerLon - 0.0006, 0),
        createDoor(40011, centerLat + 0.0004, centerLon, 0),
        createStairs(50010, centerLat + 0.0003, centerLon + 0.0005, 0),
        createElevator(60010, centerLat - 0.0003, centerLon + 0.0005, 0)
      )

      // Level 1 (First Floor)
      fallbackElements.push(
        createRectRoom(30020, 'Painting Hall A', centerLat + 0.0001, centerLon - 0.0003, 1),
        createRectRoom(30021, 'Painting Hall B', centerLat - 0.0001, centerLon - 0.0003, 1),
        createRectRoom(30022, 'Sculpture Gallery', centerLat, centerLon + 0.0003, 1),
        createDoor(40020, centerLat, centerLon - 0.0006, 1),
        createStairs(50020, centerLat + 0.0003, centerLon + 0.0005, 1),
        createElevator(60020, centerLat - 0.0003, centerLon + 0.0005, 1)
      )

      // Level 2 (Second Floor)
      fallbackElements.push(
        createRectRoom(30030, 'Print Room A', centerLat + 0.0001, centerLon - 0.0003, 2),
        createRectRoom(30031, 'Print Room B', centerLat - 0.0001, centerLon - 0.0003, 2),
        createRectRoom(30032, 'Drawing Gallery', centerLat, centerLon + 0.0003, 2),
        createDoor(40030, centerLat, centerLon - 0.0006, 2),
        createStairs(50030, centerLat + 0.0003, centerLon + 0.0005, 2),
        createElevator(60030, centerLat - 0.0003, centerLon + 0.0005, 2)
      )

      // Build elements array in Overpass format
      const osmData = { elements: [] }

      Object.entries(nodes).forEach(([id, node]) => {
        osmData.elements.push({ id: parseInt(id), type: 'node', lat: node.lat, lon: node.lon })
      })

      ways.forEach(way => {
        osmData.elements.push({ ...way })
      })

      fallbackElements.forEach(feature => {
        // Store in nodeCache for way rendering
        feature.coordinates.forEach(([lat, lon]) => {
          const nid = nodeId++
          nodes[nid] = { lat, lon }
          osmData.elements.push({ id: nid, type: 'node', lat, lon })
        })
      })

      this.nodeCache = { ...this.nodeCache, ...nodes }
      this.indoorWaysRef = [...this.indoorWaysRef, ...fallbackElements]

      console.log(`[OSMMap] Loaded ${fallbackElements.length} fallback features`)
    },
    async fetchIndoorDataRaw() {
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

      console.log('Querying Overpass API...')

      const endpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter'
      ]
      const requestBody = new URLSearchParams({ data: overpassQuery }).toString()
      let lastError = null

      for (const endpoint of endpoints) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            body: requestBody,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json'
            },
            signal: controller.signal
          })

          clearTimeout(timeoutId)

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }

          const data = await response.json()
          console.log('Received OSM data:', data)
          return data
        } catch (err) {
          clearTimeout(timeoutId)
          lastError = err.name === 'AbortError'
            ? new Error(`Overpass API timed out after 10 seconds`)
            : err
          console.warn(`Overpass endpoint failed (${endpoint}):`, lastError.message)
        }
      }

      throw lastError || new Error('Overpass API is unavailable')
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
                isRoomOrArea ? element.tags.ref || this.$t('map.unknownRoom') : `${element.tags.indoor} ${element.id}`
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

      const levelsPresent = new Set(indoorWaysFound.map(w => w.level))
      console.log(`Processed ${indoorWaysFound.length} indoor ways from OSM data. Levels present:`, [...levelsPresent].sort((a, b) => a - b))

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
      if (type === 'room' || type === 'area') return this.$t('map.unknownRoom')
      if (type === 'steps') return this.$t('map.featureTypes.steps')
      if (type === 'elevator') return this.$t('map.featureTypes.elevator')
      return `${this.$t('map.featureTypes.door')} ${id}`
    },
    getFeatureLevels(feature) {
      return String(feature.otherTags?.level || feature.level || 0)
        .split(';')
        .map(value => parseInt(value.trim(), 10))
        .filter(Number.isFinite)
    },
    isFeatureOnLevel(feature, level) {
      // Visual floor labels are offset by +1 from actual OSM level tags.
      // e.g. user selects "-1" → OSM level 0, "0" → OSM level 1, etc.
      const osmLevel = parseInt(level, 10) + 1
      return this.getFeatureLevels(feature).includes(osmLevel)
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
        if (bounds.isValid() && bounds.getSouthWest().lat !== undefined) {
          this.osmMapInstance.map.fitBounds(bounds, { padding: [50, 50] })
        }
      }
    },
    updateBuildingDisplayForLevel(level) {
      if (!this.osmMapInstance || !this.indoorLayerGroup) return

      this.indoorLayerGroup.clearLayers()

      const totalFeatures = this.indoorWaysRef.length
      const filteredWays = this.indoorWaysRef.filter(way => this.isFeatureOnLevel(way, level))

      console.log(`Level ${level}: showing ${filteredWays.length}/${totalFeatures} features (raw level tags:`, this.indoorWaysRef.slice(0, 5).map(w => w.otherTags?.level ?? w.level), ')')

      filteredWays.forEach((way) => this.createIndoorWayLayer(way))

      if (filteredWays.length > 0) {
        const bounds = L.latLngBounds(filteredWays.flatMap(way => way.coordinates))
        if (bounds.isValid() && bounds.getSouthWest().lat !== undefined) {
          this.osmMapInstance.map.fitBounds(bounds, { padding: [50, 50] })
        }
      } else {
        console.warn(`No features found for level ${level} in OSM data.`)
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
  z-index: 10;
  height: calc(100vh - 240px);
}

.level-buttons {
  position: absolute;
  left: 12px;
  bottom: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column-reverse;
  gap: 4px;
  padding: 8px;
  border-radius: 0;
  background-color: rgba(255, 255, 255, 0.95);
  border: 1px solid var(--smk-line);
  min-width: 52px;
}

.level-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--smk-ink);
  text-align: center;
  letter-spacing: 0.5px;
  padding-bottom: 6px;
  margin-bottom: 4px;
  border-bottom: 2px solid var(--smk-ink);
}

.level-button {
  width: 36px;
  height: 36px !important;
  padding: 0 !important;
  border: 1px solid var(--smk-ink);
  border-radius: 0;
  background-color: var(--smk-paper);
  color: var(--smk-ink);
  font-size: 14px !important;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s, color 0.15s;
}

.level-button:hover:not(:disabled),
.level-button.is-selected {
  background-color: var(--smk-ink);
  color: var(--smk-paper);
}

.level-button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

/* ===== FAB Stack (right side vertical stack) ===== */
.fab-stack {
  position: absolute;
  right: 12px;
  bottom: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ===== FAB Button (Floating Action Button) ===== */
.fab-button {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background-color: var(--smk-ink);
  color: var(--smk-paper);
  border: 2px solid var(--smk-ink);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease, border-color 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.fab-button:hover {
  background-color: #333;
}

.fab-button:active {
  transform: scale(0.95);
}

/* Active / open state */
.fab-button.is-active {
  background-color: var(--smk-paper);
  color: var(--smk-ink);
  border-color: var(--smk-ink);
}

/* SVG icon sizing */
.fab-button svg {
  pointer-events: none;
  stroke: var(--smk-paper);
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
  background-color: var(--smk-surface);
  border-radius: 0;
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
  border: 1px solid var(--smk-line);
  border-radius: 0;
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
  border: 2px solid var(--smk-ink);
  border-radius: 50%;
  background-color: var(--smk-paper);
}

:deep(.indoor-facility-marker img) {
  display: block;
  width: 24px;
  height: 24px;
}

:deep(.indoor-facility-marker--steps) {
  border-color: var(--smk-ink);
}

:deep(.indoor-facility-marker--elevator) {
  border-color: var(--smk-ink);
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
  border-radius: 0;
  background-color: var(--smk-paper);
  border: 1px solid var(--smk-ink);
}

.route-prompt p {
  margin: 0;
  font-weight: 600;
}

.route-prompt-button {
  padding: 5px 9px;
  border: 1px solid var(--smk-ink);
  border-radius: 0;
  background-color: var(--smk-paper);
  color: var(--smk-ink);
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
  background-color: var(--smk-paper);
  padding: 24px;
  border-radius: 0;
  border: 1px solid var(--smk-ink);
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

.error-message .btn {
  min-height: 44px;
  padding: 12px 24px;
  font-size: 16px;
}

/* ===== Mobile-First Wayfinding Panel ===== */
.wayfinding-panel {
  margin: 0;
  padding: 16px;
  background-color: var(--smk-surface);
  border-radius: 0;
  border-top: 1px solid var(--smk-line);
}

.wayfinding-panel h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--smk-ink);
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
  background-color: var(--smk-surface);
  border-radius: 0;
  border: 1px solid var(--smk-line);
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

.building-info {
  font-size: small;
}

/* ===== Drawer Transition Hooks (Vue-managed) ===== */
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
  background-color: var(--smk-paper);
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
  background-color: var(--smk-ink);
  color: var(--smk-paper);
  min-height: 56px;
  flex-shrink: 0;
}

.drawer-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--smk-paper);
}

.btn-close {
  background: none;
  border: none;
  color: var(--smk-paper);
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
  background: var(--smk-paper);
  border-radius: 0;
  border: 1px solid var(--smk-ink);
  max-width: calc(100vw - 32px);
  overflow: hidden;
}

.info-popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background-color: var(--smk-ink);
  color: var(--smk-paper);
}

.info-popup-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  flex: 1;
  color: var(--smk-paper);
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

/* ===== Small Mobile (≤400px): Stack controls to avoid overlap ===== */
@media (max-width: 400px) {
  .map-wrapper {
    height: calc(100vh - 260px);
  }

  /* Move floor picker up so it doesn't overlap popup */
  .level-buttons {
    bottom: auto;
    top: 10px;
    left: 10px;
    padding: 5px;
    gap: 3px;
    min-width: 44px;
  }

  .level-button {
    width: 28px !important;
    height: 28px !important;
    font-size: 12px !important;
  }

  .level-label {
    font-size: 7px;
    padding-bottom: 3px;
  }

  /* Move FAB stack up to top-right */
  .fab-stack {
    bottom: auto;
    top: 10px;
    right: 10px;
    gap: 6px;
  }

  .fab-button {
    width: 36px;
    height: 36px;
  }

  /* Popup moves above controls */
  .building-info-popup {
    bottom: auto;
    top: 80px;
    left: 10px;
    right: 10px;
    max-width: calc(100vw - 20px);
  }

  /* Route prompt stays at top but doesn't overlap floor picker */
  .route-prompt {
    left: 56px;
    right: 56px;
    transform: none;
    max-width: calc(100% - 112px);
  }

  .route-prompt p {
    font-size: 13px;
  }
}

/* ===== Mobile ≤480px: Compact controls ===== */
@media (max-width: 480px) {
  .map-controls {
    flex-wrap: nowrap;
    gap: 6px;
    padding: 6px 8px;
    margin-bottom: 0;
  }

  .map-controls .btn {
    padding: 6px 10px;
    font-size: 12px;
    min-height: 32px;
    white-space: nowrap;
  }

  /* Hide secondary buttons on very small screens */
  .map-controls .btn:nth-child(3) {
    display: none;
  }

  .room-search-form {
    display: none;
  }

  .room-search-message {
    font-size: 12px;
    padding: 4px 8px;
  }

  .wayfinding-panel h3 {
    font-size: 14px;
  }

  .wayfinding-panel p,
  .wayfinding-panel li {
    font-size: 12px;
  }

  .map-wrapper {
    height: calc(100vh - 180px);
  }
}

/* ===== Tablet and Up: Side-by-side Layout ===== */
@media (min-width: 768px) {
  .map-wrapper {
    border-radius: 0;
  }

  .map-controls {
    border-radius: 0;
    margin-bottom: 12px;
  }

  .map-display {
    border: 1px solid var(--smk-line);
    border-radius: 0;
    height: calc(80vh - 120px);
  }

  .wayfinding-panel {
    margin-top: 12px;
    border-radius: 0;
    border: 1px solid var(--smk-line);
  }

  /* Desktop drawer: slide from right */
  .scanner-drawer-overlay .drawer-panel-inner {
    width: 400px;
    max-width: 90vw;
    left: auto;
    right: 0;
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
    width: 52px;
    height: 52px;
  }

  .level-button {
    width: 44px !important;
    height: 44px !important;
  }

  .fab-stack {
    bottom: 20px;
    right: 16px;
    gap: 10px;
  }

  .level-buttons {
    bottom: 20px;
    left: 16px;
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
    width: 40px;
    height: 40px;
  }

  .level-button {
    width: 32px !important;
    height: 32px !important;
    font-size: 12px !important;
  }

  .level-buttons {
    padding: 6px;
    gap: 3px;
  }

  .fab-stack {
    gap: 6px;
  }

  .building-info-popup {
    left: 12px;
    right: 12px;
    bottom: 70px;
  }
}
</style>
