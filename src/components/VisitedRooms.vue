<template>
  <div class="visited-rooms">
    <header class="visited-rooms-header" @click="toggleExpand">
      <h3 class="visited-rooms-title">
        <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        Visited Rooms
        <span class="room-count">{{ rooms.length }}</span>
      </h3>
      <svg class="expand-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline :points="isExpanded ? '6 9 12 15 18 9' : '6 15 12 9 18 15'"></polyline>
      </svg>
    </header>

    <Transition name="slide-down">
      <div v-if="isExpanded" class="visited-rooms-list">
        <ul v-if="rooms.length > 0" class="rooms-ul">
          <li v-for="(roomId, index) in rooms" :key="roomId" class="room-item">
            <span class="room-number">{{ index + 1 }}</span>
            <span class="room-name">{{ getRoomName(roomId) }}</span>
          </li>
        </ul>
        <div v-else class="empty-state">
          <svg class="empty-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
          <p>No rooms visited yet</p>
          <span class="empty-hint">Scan a QR code to start exploring</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useMuseumwayfinding } from '../stores/museumwayfinding.js'

const store = useMuseumwayfinding()
const isExpanded = ref(true)

const rooms = computed(() => store.visitedRooms)

function getRoomName(roomId) {
  return store.getCurrentRoomName(roomId) || 'Unknown Room'
}

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}
</script>

<style scoped>
.visited-rooms {
  width: 100%;
}

.visited-rooms-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background-color: #f9f9f9;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  min-height: 48px;
  transition: background-color 0.2s;
}

.visited-rooms-header:hover {
  background-color: #f0f0f0;
}

.visited-rooms-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1a4d78;
  flex: 1;
}

.icon {
  flex-shrink: 0;
}

.room-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  background-color: #1a4d78;
  color: white;
  border-radius: 11px;
  font-size: 12px;
  font-weight: 600;
}

.expand-icon {
  flex-shrink: 0;
  color: #666;
  transition: transform 0.3s ease;
}

.visited-rooms-list {
  background-color: white;
  border-bottom: 1px solid #eee;
}

.rooms-ul {
  list-style: none;
  margin: 0;
  padding: 8px 0;
}

.room-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  font-size: 14px;
  color: #333;
  transition: background-color 0.15s;
}

.room-item:hover {
  background-color: #f8f9fa;
}

.room-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  background-color: #e9f7fe;
  color: #1a4d78;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.room-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
}

.empty-icon {
  color: #ccc;
  margin-bottom: 12px;
}

.empty-state p {
  margin: 0 0 4px 0;
  font-size: 15px;
  color: #666;
  font-weight: 500;
}

.empty-hint {
  font-size: 13px;
  color: #999;
}

/* Slide-down transition */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
}

.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  max-height: 500px;
}

/* Tablet and up */
@media (min-width: 768px) {
  .visited-rooms-header {
    padding: 14px 20px;
  }

  .visited-rooms-title {
    font-size: 16px;
  }

  .room-item {
    padding: 12px 20px;
    font-size: 15px;
  }

  .empty-state {
    padding: 40px 20px;
  }
}
</style>
