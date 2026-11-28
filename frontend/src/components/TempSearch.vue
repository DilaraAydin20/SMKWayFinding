<script>
import ArtworkAudioGuide from './ArtworkAudioGuide.vue'

export default {
  name: 'TempSearch',
  components: { ArtworkAudioGuide },
  data() {
    return {
      query: 'KMS1',
      artwork: null,
      loading: false,
      error: ''
    }
  },
  methods: {
    async search() {
      const nr = this.query.trim()
      if (!nr) return

      this.loading = true
      this.error = ''
      this.artwork = null

      try {
        const response = await fetch(`/api/artworks/${encodeURIComponent(nr)}`)
        if (response.status === 404) {
          this.error = this.$t('search.notFound', { number: nr })
          return
        }
        if (!response.ok) {
          throw new Error(`Artwork request failed with status ${response.status}`)
        }

        const item = await response.json()
        this.artwork = {
          id: item.smk_id,
          object_number: item.smk_id,
          name: item.title,
          descriptions: {
            da: item.description_da || '',
            en: item.description_en || ''
          }
        }
      } catch (error) {
        console.error('Artwork search failed:', error)
        this.error = this.$t('search.error')
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<template>
  <section class="temp-search-section">
    <label for="temp-search">{{ $t('search.label') }}</label>
    <input id="temp-search" v-model="query" @keyup.enter="search" />
    <button type="button" :disabled="loading" @click="search">
      {{ loading ? $t('search.loading') : $t('search.search') }}
    </button>

    <p v-if="error">{{ error }}</p>

    <ArtworkAudioGuide v-if="artwork" :artwork="artwork" />
  </section>
</template>

<style scoped>
.temp-search-section {
  padding: 16px;
}

.temp-search-section label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
}

.temp-search-section input {
  width: 100%;
  margin-bottom: 8px;
}

.temp-search-section button {
  margin-bottom: 12px;
}
</style>
