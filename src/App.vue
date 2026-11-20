<script setup>
import OSMMap from './components/OSMMap.vue'
import VisitedRooms from './components/VisitedRooms.vue'
import Artwork from './components/Artwork.vue';

import ArtworkAudioGuide from './components/ArtworkAudioGuide.vue'

import { useMuseumwayfinding } from './stores/museumwayfinding.js'

const store = useMuseumwayfinding()
</script>

<template>
  <div id="app">
    <header class="app-header">
      <h1 class="header-title">SMK Museum</h1>
      <p class="header-subtitle">Wayfinding System</p>
    </header>
    
    <main class="app-main">
      <div class="content-section">
        <OSMMap />
      </div>
      
      <div class="sidebar">
        <!-- QR Scanner is accessed via the FAB button on the map (scan icon, bottom-right) -->


        <!-- wayfinding History -->
        <div class="history-panel">
          <h3>Visited Rooms</h3>
          <ul v-if="store.visitedRooms.length > 0">
            <li v-for="roomId in store.visitedRooms" :key="roomId">
              {{ store.getCurrentRoomName(roomId) }}
            </li>
          </ul>
          <p v-else>No rooms visited yet</p>
        </div>

        <ArtworkAudioGuide :artwork="store.selectedArtwork" />

      </div>
      
    </main>
    <Artwork/>
  </div>
</template>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
}

.app-header {
  background-color: #1a4d78;
  color: white;
  padding: 10px 16px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  flex-shrink: 0;
}

.header-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.3px;
}

.header-subtitle {
  margin: 2px 0 0 0;
  font-size: 11px;
  font-weight: 400;
  opacity: 0.85;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.app-main {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  overflow: visible;
}

.content-section {
  flex: 1 1 auto;
  padding: 0;
  overflow: visible;
  display: flex;
  flex-direction: column;
}

.sidebar {
  background-color: #f5f5f5;
  border-top: 1px solid #ddd;
  overflow-y: auto;
  /* Mobile: full width, desktop: fixed width */
  flex-shrink: 0;
}

/* Tablet and up: side-by-side layout */
@media (min-width: 768px) {
  .app-header {
    padding: 16px 24px;
  }

  .header-title {
    font-size: 22px;
  }

  .header-subtitle {
    font-size: 12px;
  }

  .app-main {
    flex-direction: row;
  }

  .content-section {
    padding: 20px;
  }

  .sidebar {
    flex-basis: 320px;
    border-top: none;
    border-left: 1px solid #ddd;
  }
}

/* Desktop: larger header and spacing */
@media (min-width: 1024px) {
  .header-title {
    font-size: 26px;
  }

  .sidebar {
    flex-basis: 360px;
  }
}
</style>