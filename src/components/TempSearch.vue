<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ArtworkAudioGuide from './ArtworkAudioGuide.vue'

const { locale, t } = useI18n()
const query = ref('KMS1')
const artwork = ref(null)
const loading = ref(false)
const error = ref('')

async function search() {
  const nr = query.value.trim()
  if (!nr) return

  loading.value = true
  error.value = ''
  artwork.value = null

  try {
    const res = await fetch(
      `https://api.smk.dk/api/v1/art/?object_number=${encodeURIComponent(nr)}&lang=${locale.value}`
    )
    if (!res.ok) throw new Error(`SMK API request failed with status ${res.status}`)
    const item = (await res.json()).items?.[0]
    if (!item) {
      error.value = t('search.notFound', { number: nr })
    } else {
      artwork.value = item
    }
  } catch {
    error.value = t('search.error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section style="padding: 16px">
    <label for="temp-search">{{ t('search.label') }}</label>
    <input id="temp-search" v-model="query" @keyup.enter="search" />
    <button type="button" :disabled="loading" @click="search">
      {{ loading ? t('search.loading') : t('search.search') }}
    </button>

    <p v-if="error">{{ error }}</p>

    <ArtworkAudioGuide v-if="artwork" :artwork="artwork" />
  </section>
</template>