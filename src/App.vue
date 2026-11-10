<script setup>
import OSMMap from './components/OSMMap.vue'
import { useMuseumwayfinding } from './stores/museumwayfinding.js'

const store = useMuseumwayfinding()
</script>

<template>
  <div id="app">
    <header class="app-header">
      <h1>SMK Museum wayfinding System</h1>
      <p>Interactive Indoor Guide for Statens Museum for Kunst, Copenhagen (Based on OSM Node: 13947795305)</p>
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
      </div>
    </main>
  </div>
</template>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}

.app-header {
  background-color: #1a4d78;
  color: white;
  padding: 20px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.app-main {
  display: flex;
  height: calc(100vh - 120px);
  overflow: hidden; /* Prevents child elements from overflowing the main layout */
}

.content-section {
  flex-grow: 3;
  padding: 20px;
  overflow: hidden; /* Critical containment for map container */
}

.sidebar {
  flex-basis: 300px;
  background-color: #f5f5f5;
  padding: 20px;
  overflow-y: auto;
}

.history-panel {
  margin-top: 30px;
  padding: 15px;
  background-color: white;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.history-panel h3 {
  margin-top: 0;
  color: #1a4d78;
}
</style>