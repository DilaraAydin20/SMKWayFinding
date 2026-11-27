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
        const locale = this.$i18n.locale
        const res = await fetch(
          `https://api.smk.dk/api/v1/art/?object_number=${encodeURIComponent(nr)}&lang=${locale}`
        )
        if (!res.ok) throw new Error(`SMK API request failed with status ${res.status}`)
        const item = (await res.json()).items?.[0]
        if (!item) {
          this.error = this.$t('search.notFound', { number: nr })
        } else {
          this.artwork = item
        }
      } catch {
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
