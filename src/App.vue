<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import OSMMap from './components/OSMMap.vue'
import Artwork from './components/Artwork.vue';

import ArtworkAudioGuide from './components/ArtworkAudioGuide.vue'

import { useMuseumwayfinding } from './stores/museumwayfinding.js'
import { languageOptions, languageStorageKey, isSupportedLanguage } from './i18n/index.js'

const store = useMuseumwayfinding()
const { locale, t } = useI18n()
const languageDialogOpen = ref(!isSupportedLanguage(localStorage.getItem(languageStorageKey)))
const pendingLanguage = ref(locale.value)

function getRoomName(roomId) {
  const roomName = store.getCurrentRoomName(roomId)
  return roomName === 'Unknown Room' ? t('map.unknownRoom') : roomName
}

function setLanguage(language) {
  if (!isSupportedLanguage(language)) return

  locale.value = language
  document.documentElement.lang = language
  localStorage.setItem(languageStorageKey, language)
  languageDialogOpen.value = false
}
</script>

<template>
  <div id="app" class="site-shell">
    <header class="app-header">
      <a class="brand" href="#map" :aria-label="`${t('app.brand')} — ${t('app.map')}`">
        <img src="./assets/brand/smk-primary-logo-da.svg" alt="Statens Museum for Kunst" />
        <span class="brand-name">{{ t('app.brand') }}</span>
      </a>
      <nav class="primary-navigation" :aria-label="t('app.navigation')">
        <a href="#map">{{ t('app.map') }}</a>
        <a href="#artwork">{{ t('app.artworks') }}</a>
      </nav>
      <label class="language-switcher">
        <span>{{ t('app.language') }}</span>
        <select :value="locale" :aria-label="t('app.language')" @change="setLanguage($event.target.value)">
          <option v-for="language in languageOptions" :key="language.code" :value="language.code">
            {{ language.name }}
          </option>
        </select>
      </label>
    </header>
    
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
    <Artwork/>

    <Teleport to="body">
      <div v-if="languageDialogOpen" class="language-dialog-backdrop">
        <section
          class="language-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="language-dialog-title"
        >
          <h2 id="language-dialog-title">{{ t('app.chooseLanguage') }}</h2>
          <p>{{ t('app.languageIntro') }}</p>
          <label for="initial-language">{{ t('app.language') }}</label>
          <select id="initial-language" v-model="pendingLanguage">
            <option v-for="language in languageOptions" :key="language.code" :value="language.code">
              {{ language.name }}
            </option>
          </select>
          <button type="button" class="language-confirm" @click="setLanguage(pendingLanguage)">
            {{ t('app.continue') }}
          </button>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style>
#app {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 76px;
  padding: 10px clamp(16px, 4vw, 56px);
  border-bottom: 1px solid var(--smk-line);
  background: var(--smk-paper);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  color: var(--smk-ink);
  text-decoration: none;
}

.brand img {
  display: block;
  width: 78px;
  height: auto;
}

.brand-name {
  padding-left: 14px;
  border-left: 1px solid var(--smk-line);
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.primary-navigation {
  display: flex;
  align-items: center;
  gap: clamp(14px, 3vw, 32px);
}

.primary-navigation a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--smk-ink);
  font-size: 0.95rem;
  font-weight: 600;
  text-decoration: none;
  text-underline-offset: 5px;
}

.primary-navigation a:hover {
  text-decoration: underline;
}

.language-switcher {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--smk-muted);
  font-size: 0.85rem;
  font-weight: 600;
}

.language-switcher select {
  min-height: 40px;
  padding: 6px 30px 6px 10px;
  font-size: 0.9rem;
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

.language-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(0 0 0 / 65%);
}

.language-dialog {
  display: grid;
  gap: 14px;
  width: min(100%, 440px);
  padding: clamp(24px, 6vw, 40px);
  border: 1px solid var(--smk-line);
  background: var(--smk-paper);
}

.language-dialog h2,
.language-dialog p {
  margin: 0;
}

.language-dialog h2 {
  font-size: clamp(1.6rem, 5vw, 2rem);
}

.language-dialog p {
  color: var(--smk-muted);
  line-height: 1.5;
}

.language-dialog label {
  margin-top: 6px;
  font-weight: 600;
}

.language-dialog select {
  width: 100%;
  min-height: 48px;
  padding: 10px 36px 10px 12px;
}

.language-confirm {
  min-height: 48px;
  border: 1px solid var(--smk-ink);
  border-radius: 0;
  background: var(--smk-ink);
  color: var(--smk-paper);
  font-weight: 600;
}

.language-confirm:hover {
  background: #333;
}

@media (max-width: 480px) {
  .app-header {
    flex-wrap: wrap;
    gap: 4px 10px;
    min-height: 64px;
    padding: 8px 14px;
  }

  .brand {
    gap: 9px;
  }

  .brand img {
    width: 60px;
  }

  .brand-name {
    padding-left: 9px;
    font-size: 0.8rem;
  }

  .primary-navigation {
    gap: 10px;
  }

  .primary-navigation a {
    font-size: 0.85rem;
  }

  .language-switcher {
    gap: 5px;
    margin-left: auto;
    font-size: 0.75rem;
  }

  .language-switcher select {
    min-height: 36px;
    padding: 5px 25px 5px 8px;
    font-size: 0.85rem;
  }

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