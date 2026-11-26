<script setup>
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getArtworks, rows } from '../data/smk-api.js'
import ArtworkAudioGuide from './ArtworkAudioGuide.vue'
import noImage from '../images/noimage.png'

const { t } = useI18n()
const artworks = ref([])
const offset = ref(0)
const isLoading = ref(false)
const hasMore = ref(true)
const loadError = ref(false)
const selectedArtwork = ref(null)

async function loadMore() {
  if (isLoading.value || !hasMore.value) return

  isLoading.value = true
  loadError.value = false

  try {
    const newArtworks = await getArtworks(offset.value)
    artworks.value.push(...newArtworks)
    offset.value += newArtworks.length
    hasMore.value = newArtworks.length === rows
  } catch (error) {
    console.error('Could not load more artworks:', error)
    loadError.value = true
  } finally {
    isLoading.value = false
  }
}

function artworkTitle(artwork) {
  const title = artwork.titles?.find(item => item?.title)?.title
  return title || artwork.object_number || ''
}

function artworkArtist(artwork) {
  return (artwork.artist || [])
    .map(artist => typeof artist === 'string' ? artist : artist?.name || artist?.artist || '')
    .filter(Boolean)
    .join(', ')
}

function artworkYear(artwork) {
  const date = artwork.production_date?.[0]
  if (typeof date === 'string') return date
  return date?.display || date?.date || date?.earliest || ''
}

onMounted(loadMore)
</script>

<template>
  <section class="banner" aria-labelledby="artwork-heading">
    <div>
      <p class="banner-eyebrow">{{ t('artwork.eyebrow') }}</p>
      <h2 id="artwork-heading">{{ t('artwork.title') }}</h2>
      <p class="banner-description">{{ t('artwork.intro') }}</p>
    </div>
  </section>

  <section id="artwork" :aria-label="t('artwork.ariaLabel')">
    <article v-for="(artwork, index) in artworks" :key="artwork.object_number || index" class="card">
      <img
        class="cardImage"
        :src="artwork.image_thumbnail || noImage"
        :alt="artworkTitle(artwork)"
        loading="lazy"
      />
      <h3 class="cardTitle">{{ artworkTitle(artwork) }}</h3>
      <p v-if="artworkArtist(artwork)" class="cardAuthor">{{ artworkArtist(artwork) }}</p>
      <span
        class="cardDisplay"
        :class="{ 'cardDisplay--on-display': artwork.on_display }"
      >{{ artwork.on_display ? t('artwork.inMuseum') : t('artwork.notOnDisplay') }}</span>
      <p v-if="artworkYear(artwork)" class="cardYear">{{ artworkYear(artwork) }}</p>
      <a
        v-if="artwork.frontend_url"
        class="cardBtn"
        :href="artwork.frontend_url"
        target="_blank"
        rel="noopener noreferrer"
      >{{ t('artwork.viewOnSmk') }}</a>
      <button class="cardDescBtn" type="button" @click="selectedArtwork = artwork">
        {{ t('artwork.viewDescription') }}
      </button>
    </article>
  </section>

  <p v-if="loadError" role="alert">{{ t('artwork.loadError') }}</p>
  <button type="button" @click="loadMore" :disabled="isLoading || !hasMore">
    {{ isLoading ? t('artwork.loading') : hasMore ? t('artwork.loadMore') : t('artwork.allLoaded') }}
  </button>

  <div v-if="selectedArtwork" class="modal-backdrop" @click.self="selectedArtwork = null">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="artwork-audio-title">
      <button
        type="button"
        class="modal-close"
        :aria-label="t('artwork.close')"
        @click="selectedArtwork = null"
      >✕</button>
      <ArtworkAudioGuide :artwork="selectedArtwork" />
    </div>
  </div>
</template>

<style scoped>
  .banner {
    position: relative;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    width: min(calc(100% - 32px), 1600px);
    min-height: 190px;
    margin: 40px auto 0;
    padding: clamp(24px, 5vw, 56px);
    overflow: hidden;
    border-left: 5px solid var(--smk-ink);
    background: var(--smk-surface);
  }

  .banner::before {
    display: none;
  }

  .banner::after {
    content: none;
  }

  .banner-eyebrow {
    margin: 0 0 8px;
    color: var(--smk-muted);
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .banner h2 {
    margin: 0;
    font-size: clamp(2rem, 5vw, 3.5rem);
    font-weight: 600;
    line-height: 1.05;
  }

  .banner-description {
    max-width: 38rem;
    margin: 12px 0 0;
    color: var(--smk-muted);
    font-size: 1rem;
    line-height: 1.55;
  }

  #artwork {
    display: grid;
    flex-shrink: 0;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
    gap: 16px;
    width: min(100% - 32px, 1600px);
    margin: 0 auto;
    padding: 24px 0;
  }

  #artwork :deep(.card) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-width: 0;
    max-width: none;
    height: 100%;
    padding: 12px;
    border: 1px solid var(--smk-line);
    border-radius: 0;
    background: var(--smk-paper);
    box-shadow: none;
    transition: border-color 180ms ease, background-color 180ms ease;
  }

  #artwork :deep(.card:hover) {
    border-color: var(--smk-ink);
    background: var(--smk-surface);
  }

  #artwork :deep(.cardImage) {
    order: -1;
    display: block;
    width: 100%;
    height: 240px;
    flex: 0 0 240px;
    margin-bottom: 16px;
    border-radius: 0;
    background: var(--smk-surface);
    object-fit: contain;
  }

  #artwork :deep(.cardTitle) {
    margin: 0 0 6px;
    color: var(--smk-ink);
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1.35;
  }

  #artwork :deep(.cardAuthor) {
    margin: 0 0 10px;
    color: var(--smk-muted);
    font-size: 0.92rem;
  }

  #artwork :deep(.cardYear) {
    order: 1;
    align-self: flex-start;
    margin: auto 0 0;
    padding: 5px 8px;
    border: 1px solid var(--smk-line);
    border-radius: 0;
    background: var(--smk-surface);
    color: var(--smk-ink);
    font-size: 0.75rem;
    font-weight: 700;
  }

  #artwork :deep(.cardDisplay) {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    width: fit-content;
    margin: 0 0 12px;
    padding: 6px 10px;
    border: 1px solid var(--smk-line);
    border-radius: 0;
    background: var(--smk-surface);
    color: var(--smk-ink);
    font-size: 0.78rem;
    font-weight: 700;
    line-height: 1;
  }

  #artwork :deep(.cardDisplay::before) {
    width: 7px;
    height: 7px;
    flex: 0 0 7px;
    border-radius: 50%;
    background: currentColor;
    content: "";
  }

  #artwork :deep(.cardDisplay--on-display) {
    border-color: #8d8d89;
    background: #e8e8e5;
    color: var(--smk-ink);
  }

  #artwork :deep(.cardDisplay:empty) {
    display: none;
  }

  #artwork :deep(.cardBtn) {
    order: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    margin-top: 8px;
    padding: 10px 14px;
    border: 1px solid var(--smk-ink);
    border-radius: 0;
    background: var(--smk-ink);
    color: #fff;
    font-size: 0.9rem;
    font-weight: 700;
    text-align: center;
    text-decoration: none;
    transition: background-color 180ms ease, transform 180ms ease;
  }

  #artwork :deep(.cardBtn:hover) {
    background: #333;
  }

  #artwork :deep(.cardBtn:focus-visible) {
    outline: 3px solid var(--smk-ink);
    outline-offset: 3px;
  }

  #artwork :deep(.cardBtn[aria-disabled="true"]) {
    background: #6b6b68;
    cursor: not-allowed;
    pointer-events: none;
  }

  @media (max-width: 520px) {
    .banner {
      width: min(calc(100% - 24px), 1600px);
      min-height: 100px;
      padding: 20px;
      margin-top: 24px;
    }

    #artwork {
      grid-template-columns: 1fr;
      gap: 12px;
      width: min(calc(100% - 24px), 1600px);
      padding: 16px 0;
    }

    #artwork :deep(.card) {
      max-width: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    #artwork :deep(.card) {
      transition: none;
    }
  }

    #artwork :deep(.cardDescBtn) {
    order: 2;
    min-height: 44px;
    margin-top: 8px;
    padding: 10px 14px;
    border: 1px solid var(--smk-ink);
    border-radius: 0;
    background: var(--smk-paper);
    color: var(--smk-ink);
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
  }

  #artwork :deep(.cardDescBtn:hover) {
    background: var(--smk-surface);
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 5000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(0, 0, 0, 0.68);
  }

  .modal {
    position: relative;
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    overflow-y: auto;
    padding: 12px;
    border: 1px solid var(--smk-line);
    border-radius: 0;
    background: var(--smk-paper);
  }

  .modal-close {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 36px;
    height: 36px;
    border: none;
    border: 1px solid var(--smk-ink);
    border-radius: 0;
    background: var(--smk-paper);
    cursor: pointer;
  }

  .modal-close:hover {
    background: var(--smk-ink);
    color: var(--smk-paper);
  }
</style>