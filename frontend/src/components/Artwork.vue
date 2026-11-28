<script>
import { artworksPerPage, getArtworkCounts, getArtworkLocations, getArtworks } from '../data/smk-api.js'
import ArtworkAudioGuide from './ArtworkAudioGuide.vue'
import noImage from '../images/noimage.png'

export default {
  name: 'Artwork',
  components: { ArtworkAudioGuide },
  data() {
    return {
      artworks: [],
      currentPage: 1,
      retryPage: 1,
      totalArtworkCount: 0,
      countsLoaded: false,
      countedRoom: null,
      roomLocations: [],
      roomLocationsLoaded: false,
      roomLocationsError: false,
      selectedRoom: '',
      isLoading: false,
      loadError: false,
      selectedArtwork: null
    }
  },
  computed: {
    totalPages() {
      return Math.ceil(this.totalArtworkCount / artworksPerPage)
    },
    visiblePages() {
      const firstPage = Math.max(1, this.currentPage - 1)
      const lastPage = Math.min(this.totalPages, this.currentPage + 1)
      const pages = []

      if (firstPage > 1) pages.push(1)
      if (firstPage > 2) pages.push(null)
      for (let page = firstPage; page <= lastPage; page += 1) pages.push(page)
      if (lastPage < this.totalPages - 1) pages.push(null)
      if (lastPage < this.totalPages) pages.push(this.totalPages)

      return pages
    }
  },
  methods: {
    t(key, params) {
      return this.$t(key, params)
    },
    async getPageArtworks(page) {
      const pageOffset = (page - 1) * artworksPerPage
      return getArtworks(pageOffset, artworksPerPage, this.selectedRoom)
    },
    async loadPage(page) {
      if (this.isLoading) return
      if (!Number.isInteger(page) || page < 1) return

      this.isLoading = true
      this.loadError = false

      try {
        if (!this.roomLocationsLoaded) {
          try {
            this.roomLocations = await getArtworkLocations()
            this.roomLocationsLoaded = true
            this.roomLocationsError = false
          } catch (error) {
            console.error('Could not load artwork room choices:', error)
            this.roomLocationsError = true
          }
        }

        if (!this.countsLoaded || this.countedRoom !== this.selectedRoom) {
          const counts = await getArtworkCounts(this.selectedRoom)
          this.totalArtworkCount = counts.roomAssigned
          this.countedRoom = this.selectedRoom
          this.countsLoaded = true
        }

        if (this.totalPages === 0) {
          this.artworks = []
          this.currentPage = 1
          return
        }

        const requestedPage = Math.min(Math.max(page, 1), this.totalPages)
        this.retryPage = requestedPage
        this.artworks = await this.getPageArtworks(requestedPage)
        this.currentPage = requestedPage
      } catch (error) {
        console.error('Could not load artworks:', error)
        this.loadError = true
      } finally {
        this.isLoading = false
      }
    },

    filterByRoom() {
      this.currentPage = 1
      this.artworks = []
      this.loadPage(1)
    },

    artworkTitle(artwork) {
      const title = artwork.titles?.find(item => item?.title)?.title
      return title || artwork.object_number || ''
    },

    artworkArtist(artwork) {
      return (artwork.artist || [])
        .map(artist => typeof artist === 'string' ? artist : artist?.name || artist?.artist || '')
        .filter(Boolean)
        .join(', ')
    },

    artworkYear(artwork) {
      const date = artwork.production_date?.[0]
      if (typeof date === 'string') return date
      return date?.display || date?.date || date?.earliest || ''
    },
    handleImageError(event) {
      event.target.src = noImage
    }
  },
  mounted() {
    this.loadPage(1)
  }
}
</script>

<template>
  <section class="banner" aria-labelledby="artwork-heading">
    <div>
      <p class="banner-eyebrow">{{ t('artwork.eyebrow') }}</p>
      <h2 id="artwork-heading">{{ t('artwork.title') }}</h2>
      <p class="banner-description">{{ t('artwork.intro') }}</p>
    </div>
  </section>

  <div class="artwork-filters">
    <label for="artwork-room-filter">{{ t('artwork.roomFilter') }}</label>
    <select
      id="artwork-room-filter"
      v-model="selectedRoom"
      :disabled="isLoading || roomLocations.length === 0"
      @change="filterByRoom"
    >
      <option value="">{{ t('artwork.allRooms') }}</option>
      <option v-for="room in roomLocations" :key="room" :value="room">{{ room }}</option>
    </select>
  </div>
  <p v-if="roomLocationsError" class="room-filter-error" role="alert">
    {{ t('artwork.roomFilterError') }}
    <button type="button" :disabled="isLoading" @click="loadPage(currentPage)">
      {{ t('artwork.retry') }}
    </button>
  </p>

  <section id="artwork" :aria-label="t('artwork.ariaLabel')">
    <article v-for="(artwork, index) in artworks" :key="artwork.object_number || index" class="card"> 

      <img
        class="cardImage"
        :src="artwork.image_thumbnail || noImage"
        :alt="artworkTitle(artwork)"
        loading="lazy"
        @error="handleImageError"
      />
      <div class="cardContent">
        <h3 class="cardTitle">{{ artworkTitle(artwork) }}</h3>
        <p class="cardAuthor">{{ artworkArtist(artwork) }}</p>
        <p v-if="artwork.room_name" class="cardRoom">
          {{ t('artwork.roomLabel', { room: artwork.room_name }) }}
        </p>
        <p
          class="cardYear"
          :class="{ 'cardYear--empty': !artworkYear(artwork) }"
        >{{ artworkYear(artwork) }}</p>
      </div>
      <div class="cardActions">
        <a
          v-if="artwork.frontend_url"
          class="cardBtn"
          :href="artwork.frontend_url"
          target="_blank"
          rel="noopener noreferrer"
        >{{ t('artwork.viewOnSmk') }}</a>
        <button
          v-if="artwork.hasDescription"
          class="cardDescBtn"
          type="button"
          @click="selectedArtwork = artwork"
        >
          {{ t('artwork.viewDescription') }}
        </button>
      </div>
    </article>
  </section>

  <p
    v-if="!isLoading && !loadError && countsLoaded && artworks.length === 0"
    class="pagination-status"
    role="status"
  >{{ selectedRoom ? t('artwork.noRoomResults', { room: selectedRoom }) : t('artwork.noResults') }}</p>

  <p v-if="isLoading" class="pagination-status" role="status">{{ t('artwork.loading') }}</p>
  <div v-if="loadError" class="pagination-status" role="alert">
    <p>{{ t('artwork.loadError') }}</p>
    <button type="button" :disabled="isLoading" @click="loadPage(retryPage)">
      {{ t('artwork.retry') }}
    </button>
  </div>

  <p v-if="totalPages > 0" class="pagination-status" aria-live="polite">
    {{ t('artwork.pageStatus', { page: currentPage, totalPages }) }}
  </p>
  <nav v-if="totalPages > 1" class="pagination" :aria-label="t('artwork.paginationLabel')">
    <button type="button" :disabled="isLoading || currentPage === 1" @click="loadPage(currentPage - 1)">
      {{ t('artwork.previousPage') }}
    </button>
    <template v-for="(page, index) in visiblePages" :key="`${page}-${index}`">
      <span v-if="page === null" class="pagination-ellipsis" aria-hidden="true">…</span>
      <button
        v-else
        type="button"
        :aria-label="t('artwork.pageNumber', { page })"
        :aria-current="page === currentPage ? 'page' : undefined"
        :disabled="isLoading"
        @click="loadPage(page)"
      >{{ page }}</button>
    </template>
    <button
      type="button"
      :disabled="isLoading || currentPage === totalPages"
      @click="loadPage(currentPage + 1)"
    >
      {{ t('artwork.nextPage') }}
    </button>
  </nav>

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

  .artwork-filters {
    display: flex;
    align-items: center;
    gap: 12px;
    width: min(calc(100% - 32px), 1600px);
    margin: 24px auto 0;
  }

  .artwork-filters label {
    color: var(--smk-ink);
    font-weight: 700;
  }

  .artwork-filters select {
    min-width: 220px;
    min-height: 44px;
    padding: 8px 36px 8px 12px;
    border: 1px solid var(--smk-line);
    border-radius: 0;
    background: var(--smk-paper);
    color: var(--smk-ink);
    font: inherit;
  }

  .room-filter-error {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px;
    width: min(calc(100% - 32px), 1600px);
    margin: 12px auto 0;
    color: var(--smk-muted);
    text-align: center;
  }

  .room-filter-error button {
    min-height: 36px;
    padding: 6px 12px;
    border: 1px solid var(--smk-line);
    border-radius: 0;
    background: var(--smk-paper);
    color: var(--smk-ink);
    cursor: pointer;
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
    box-sizing: border-box;
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

  #artwork :deep(.cardContent) {
    display: flex;
    flex-direction: column;
    flex: 1;
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
    display: -webkit-box;
    min-height: 2.7em;
    max-height: 2.7em;
    margin: 0 0 6px;
    overflow: hidden;
    color: var(--smk-ink);
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  #artwork :deep(.cardAuthor) {
    display: -webkit-box;
    min-height: 2.6em;
    max-height: 2.6em;
    margin: 0 0 10px;
    overflow: hidden;
    color: var(--smk-muted);
    font-size: 0.92rem;
    line-height: 1.3;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  #artwork :deep(.cardYear) {
    align-self: flex-start;
    box-sizing: border-box;
    min-height: 27px;
    margin: 0 0 12px;
    padding: 5px 8px;
    border: 1px solid var(--smk-line);
    border-radius: 0;
    background: var(--smk-surface);
    color: var(--smk-ink);
    font-size: 0.75rem;
    font-weight: 700;
  }

  #artwork :deep(.cardYear--empty) {
    visibility: hidden;
  }

  #artwork :deep(.cardRoom) {
    align-self: flex-start;
    display: flex;
    align-items: center;
    width: fit-content;
    min-height: 32px;
    box-sizing: border-box;
    margin: 0 0 12px;
    padding: 6px 10px;
    border: 1px solid var(--smk-line);
    border-radius: 0;
    background: var(--smk-surface);
    color: var(--smk-ink);
    font-size: 0.78rem;
    font-weight: 700;
    line-height: 1.2;
  }

  #artwork :deep(.cardBtn) {
    text-decoration: none;
  }

  #artwork :deep(.cardActions) {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: auto;
  }

  #artwork :deep(.cardBtn),
  #artwork :deep(.cardDescBtn) {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 48px;
    min-height: 48px;
    margin: 0;
    padding: 10px 14px;
    border: 1px solid var(--smk-ink);
    border-radius: 0;
    background: var(--smk-ink);
    color: #fff;
    font-size: 0.9rem;
    font-weight: 700;
    line-height: 1.2;
    text-align: center;
    cursor: pointer;
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

    .artwork-filters {
      align-items: stretch;
      flex-direction: column;
      gap: 8px;
      width: min(calc(100% - 24px), 1600px);
      margin-top: 16px;
    }

    .artwork-filters select {
      width: 100%;
    }

    .room-filter-error {
      width: min(calc(100% - 24px), 1600px);
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

  #artwork :deep(.cardDescBtn:hover) {
    background: #333;
  }

  .pagination-status {
    width: min(calc(100% - 32px), 1600px);
    margin: 0 auto 16px;
    color: var(--smk-muted);
    text-align: center;
  }

  .pagination-status p {
    margin: 0 0 8px;
  }

  .pagination {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: min(calc(100% - 32px), 1600px);
    margin: 0 auto 24px;
  }

  .pagination button {
    min-width: 40px;
    min-height: 40px;
    padding: 8px 12px;
    border: 1px solid var(--smk-line);
    border-radius: 0;
    background: var(--smk-paper);
    color: var(--smk-ink);
    cursor: pointer;
  }

  .pagination button[aria-current="page"] {
    border-color: var(--smk-ink);
    background: var(--smk-ink);
    color: var(--smk-paper);
  }

  .pagination button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .pagination-ellipsis {
    padding: 0 4px;
    color: var(--smk-muted);
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
