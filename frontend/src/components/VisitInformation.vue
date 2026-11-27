<script>
import ArtworkAudioGuide from './ArtworkAudioGuide.vue'
import { useMuseumwayfinding } from '../stores/museumWayfinding.js'

export default {
  name: 'VisitInformation',
  components: { ArtworkAudioGuide },
  data() {
    return {
      store: useMuseumwayfinding()
    }
  },
  computed: {
    visitedRooms() {
      return this.store.visitedRooms
    },
    selectedArtwork() {
      return this.store.selectedArtworkId ? this.store.selectedArtwork : null
    }
  },
  methods: {
    getRoomName(roomId) {
      const roomName = this.store.getCurrentRoomName(roomId)
      return roomName === 'Unknown Room' ? this.$t('map.unknownRoom') : roomName
    }
  }
}
</script>

<template>
  <aside class="sidebar" :aria-label="$t('app.visitInformation')">
    <div class="history-panel">
      <h2>{{ $t('app.visitedRooms') }}</h2>
      <ul v-if="store.visitedRooms.length > 0">
        <li v-for="roomId in store.visitedRooms" :key="roomId">
          {{ getRoomName(roomId) }}
        </li>
      </ul>
      <p v-else class="empty-history">{{ $t('app.noRoomsVisited') }}</p>
    </div>

    <ArtworkAudioGuide v-if="selectedArtwork" :artwork="selectedArtwork" />
  </aside>
</template>

<style scoped>
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
  .history-panel {
    padding: 16px;
  }
}

@media (min-width: 1024px) {
  .sidebar {
    position: sticky;
    top: 100px;
  }
}
</style>
