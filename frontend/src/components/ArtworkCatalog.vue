<script>
import { useMuseumwayfinding } from '../stores/museumWayfinding.js'

export default {
  name: 'ArtworkCatalog',
  data() {
    return {
      store: useMuseumwayfinding(),
      searchQuery: '',
      artworks: [],
      isLoading: false,
      errorMessage: '',
      hasSearched: false,
      selectedArtwork: null
    }
  },
  computed: {
    displayArtworks() {
      return this.artworks
    }
  },
  methods: {
    async searchArtworks() {
      const query = this.searchQuery.trim()

      if (!query) {
        this.hasSearched = false
        this.artworks = []
        this.errorMessage = ''
        return
      }

      this.isLoading = true
      this.errorMessage = ''
      this.hasSearched = true

      try {
        const response = await fetch(`/api/artworks?q=${encodeURIComponent(query)}`)
        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`)
        }
        const data = await response.json()
        this.artworks = data.results || []
      } catch (error) {
        console.error('Artwork search failed:', error)
        this.errorMessage = `Search failed: ${error.message}`
        this.artworks = []
      } finally {
        this.isLoading = false
      }
    },
    async selectArtwork(artwork) {
      try {
        const response = await fetch(`/api/artworks/${artwork.smk_id}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch artwork details: ${response.status}`)
        }
        const detail = await response.json()

        // Set as destination via store
        this.store.selectedArtworkId = detail.smk_id || artwork.smk_id
        this.selectedArtwork = detail || artwork

        // Emit event for audio guide
        this.$emit('artwork-selected', this.selectedArtwork)
      } catch (error) {
        console.error('Failed to load artwork details:', error)
        this.errorMessage = `Could not load artwork: ${error.message}`
        this.selectedArtwork = artwork
      }
    },
    handleImageError(event) {
      event.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNGNUY1RjUiLz48cGF0aCBkPSJNMTAwIDYwQzc4LjkgNjAgNjAgNzguOSA2MCAxMDBDNjAgMTIxLjEgNzguOSAxNDAgMTAwIDE0MEMxMjEuMSAxNDAgMTQwIDEyMS4xIDE0MCAxMDBDMTQwIDc4LjkgMTIxLjEgNjAgMTAwIDYwWiIgZmlsbD0iI0NDQyIvPjxwYXRoIGQ9Ik03NSAxMDVMODUgOTVMOTUgMTE1TDEwNSAxMDVMMTI1IDg1TDE0NSAxMDUiIHN0cm9rZT0iIzk5OSIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+PC9zdmc+'
    }
  }
}
</script>

<template>
  <div class="artwork-catalog">
    <h3>Artwork Catalog</h3>

    <!-- Search Form -->
    <form class="search-form" @submit.prevent="searchArtworks">
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Search by title, artist, or keyword..."
        class="search-input"
        aria-label="Search artworks"
      />
      <button type="submit" class="btn btn-primary" :disabled="isLoading">
        {{ isLoading ? 'Searching...' : 'Search' }}
      </button>
    </form>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <p>Searching artworks...</p>
    </div>

    <!-- Error State -->
    <div v-if="errorMessage" class="error-state">
      <p>{{ errorMessage }}</p>
    </div>

    <!-- Empty State (no search yet) -->
    <div v-if="!hasSearched && !isLoading" class="empty-state">
      <p>Search for artworks in the SMK collection.</p>
    </div>

    <!-- Results Grid -->
    <div v-if="hasSearched && !isLoading && displayArtworks.length > 0" class="results-grid">
      <div
        v-for="artwork in displayArtworks"
        :key="artwork.smk_id"
        class="artwork-card"
        @click="selectArtwork(artwork)"
      >
        <div class="artwork-image-wrapper">
          <img
            :src="`/api/artworks/${artwork.smk_id}/image`"
            :alt="artwork.title || 'Artwork'"
            class="artwork-image"
            @error="handleImageError"
            loading="lazy"
          />
        </div>
        <div class="artwork-info">
          <h4 class="artwork-title">{{ artwork.title || 'Untitled' }}</h4>
          <p class="artwork-artist">{{ artwork.artist || 'Unknown Artist' }}</p>
          <p v-if="artwork.year" class="artwork-year">{{ artwork.year }}</p>
        </div>
      </div>
    </div>

    <!-- No Results -->
    <div v-if="hasSearched && !isLoading && displayArtworks.length === 0 && !errorMessage" class="no-results">
      <p>No artworks found for "{{ searchQuery }}".</p>
      <p>Try searching with different keywords.</p>
    </div>
  </div>
</template>

<style scoped>
.artwork-catalog {
  width: 100%;
}

.artwork-catalog h3 {
  margin: 0 0 12px;
  font-size: 16px;
  color: #1a4d78;
  font-weight: 600;
}

.search-form {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.search-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 14px;
  min-height: 44px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  min-height: 44px;
  -webkit-tap-highlight-color: transparent;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-state,
.empty-state,
.no-results {
  text-align: center;
  padding: 24px 16px;
  color: #666;
  font-size: 14px;
}

.error-state {
  padding: 16px;
  background-color: #fff3f3;
  border-radius: 8px;
  margin-bottom: 16px;
}

.error-state p {
  margin: 0;
  color: #dc3545;
  font-size: 14px;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.artwork-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  background: white;
}

.artwork-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.artwork-image-wrapper {
  width: 100%;
  aspect-ratio: 1;
  background-color: #f5f5f5;
  overflow: hidden;
}

.artwork-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.artwork-info {
  padding: 8px 10px;
}

.artwork-title {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 600;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artwork-artist {
  margin: 0 0 2px;
  font-size: 12px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artwork-year {
  margin: 0;
  font-size: 11px;
  color: #999;
}

/* Tablet and up */
@media (min-width: 768px) {
  .results-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    max-height: 500px;
  }

  .artwork-title {
    font-size: 14px;
  }

  .artwork-artist {
    font-size: 13px;
  }
}
</style>
