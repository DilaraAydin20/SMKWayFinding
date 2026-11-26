<script setup>
import { useI18n } from 'vue-i18n'
import OSMMap from '../components/OSMMap.vue'
import ArtworkAudioGuide from '../components/ArtworkAudioGuide.vue'
import { useMuseumwayfinding } from '../stores/museumWayfinding.js'

const store = useMuseumwayfinding()
const { t } = useI18n()

function getRoomName(roomId) {
  const roomName = store.getCurrentRoomName(roomId)
  return roomName === 'Unknown Room' ? t('map.unknownRoom') : roomName
}

</script>

<template>
  <main class="app-main">
    <section id="map" class="content-section" :aria-label="t('app.map')">
      <OSMMap />
    </section>

    <aside class="sidebar" :aria-label="t('app.visitInformation')">
      <!-- QR Scanner is accessed via the FAB button on the map (scan icon, bottom-right) -->
      <div class="history-panel">
        <h2>{{ t('app.visitedRooms') }}</h2>
        <ul v-if="store.visitedRooms.length > 0">
          <li v-for="roomId in store.visitedRooms" :key="roomId">
            {{ getRoomName(roomId) }}
          </li>
        </ul>
        <p v-else class="empty-history">{{ t('app.noRoomsVisited') }}</p>
      </div>

      <ArtworkAudioGuide :artwork="store.selectedArtwork" />
    </aside>
  </main>
</template>

<style>
.site-shell {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.app-main {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: min(calc(100% - 32px), 1600px);
  margin: 20px auto 0;
}

.content-section {
  min-width: 0;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.history-panel {
  padding: 20px;
  border: 1px solid var(--smk-line);
  background: var(--smk-surface);
}

.history-panel h2 {
  margin: 0 0 14px;
  font-size: 1.2rem;
  font-weight: 600;
}

.history-panel ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.history-panel li {
  padding: 10px 12px;
  border-left: 2px solid var(--smk-ink);
  background: var(--smk-paper);
}

.empty-history {
  margin: 0;
  color: var(--smk-muted);
  line-height: 1.5;
}

@media (max-width: 480px) {
  .app-main {
    width: min(calc(100% - 24px), 1600px);
    margin-top: 12px;
  }

  .history-panel {
    padding: 16px;
  }
}

@media (min-width: 1024px) {
  .app-main {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 340px);
    align-items: start;
    gap: 24px;
    margin-top: 24px;
  }

  .sidebar {
    position: sticky;
    top: 100px;
  }
}
</style>