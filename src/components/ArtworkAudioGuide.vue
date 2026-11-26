<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getArtworkText } from '../data/smk-api.js'

const props = defineProps({
  artwork: {
    type: Object,
    default: null
  }
})

const { locale, t } = useI18n()
const description = ref('')
const translationError = ref(false)
const audioUrl = ref(null)
const audioElement = ref(null)
const isLoading = ref(false)
const isDescriptionLoading = ref(false)
const errorMessage = ref('')
let requestController = null
let descriptionRequestId = 0

const artworkName = computed(
  () => props.artwork?.titles?.[0]?.title || props.artwork?.object_number || ''
)

function clearAudio() {
  requestController?.abort()
  requestController = null
  if (audioUrl.value) URL.revokeObjectURL(audioUrl.value)
  audioUrl.value = null
}

watch(
  [() => props.artwork, locale],
  async () => {
    const requestId = ++descriptionRequestId
    clearAudio()
    errorMessage.value = ''
    description.value = ''
    translationError.value = false

    const nr = props.artwork?.object_number
    if (!nr) {
      isDescriptionLoading.value = false
      return
    }

    isDescriptionLoading.value = true
    try {
      const result = await getArtworkText(nr, locale.value)
      if (requestId !== descriptionRequestId) return
      description.value = result.text
      translationError.value = result.fallback
      if (!result.text) {
        errorMessage.value = t('audio.noDescription')
      }
    } catch (err) {
      if (requestId !== descriptionRequestId) return
      console.error('Could not load artwork description:', err)
      errorMessage.value = t('audio.loadError')
    } finally {
      if (requestId === descriptionRequestId) isDescriptionLoading.value = false
    }
  },
  { immediate: true }
)

watch(description, () => {
  clearAudio()
})

async function generateSpeech() {
  if (!props.artwork || !description.value.trim() || isLoading.value) return

  clearAudio()
  errorMessage.value = ''
  isLoading.value = true
  requestController = new AbortController()

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: description.value.trim(),
        language: locale.value
      }),
      signal: requestController.signal
    })

    if (!response.ok) {
      throw new Error(`Speech generation failed (${response.status}).`)
    }

    audioUrl.value = URL.createObjectURL(await response.blob())
    await nextTick()

    try {
      await audioElement.value?.play()
    } catch {
      errorMessage.value = t('audio.audioReady')
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      errorMessage.value = t('audio.speechError')
    }
  } finally {
    isLoading.value = false
    requestController = null
  }
}

onBeforeUnmount(() => {
  requestController?.abort()
  clearAudio()
})
</script>

<template>
  <section class="artwork-audio-panel" aria-labelledby="artwork-audio-title">
    <h3 id="artwork-audio-title">{{ t('audio.title') }}</h3>

    <p v-if="!artwork">{{ t('audio.scanPrompt') }}</p>
    <template v-else>
      <h4>{{ artworkName }}</h4>

      <label for="artwork-audio-description">{{ t('audio.description') }}</label>
      <textarea
        id="artwork-audio-description"
        v-model="description"
        :disabled="isLoading || isDescriptionLoading"
        maxlength="5000"
        rows="5"
        :placeholder="t('audio.placeholder')"
      ></textarea>
      <p v-if="isDescriptionLoading" role="status">{{ t('audio.loading') }}</p>
      <p v-if="translationError" class="audio-error" role="alert">
        {{ t('audio.translationError') }}
      </p>

      <button
        type="button"
        class="btn btn-primary"
        :disabled="isLoading || isDescriptionLoading || !description.trim()"
        @click="generateSpeech"
      >
        {{ isLoading ? t('audio.generatingAudio') : t('audio.generateAudio') }}
      </button>

      <audio v-if="audioUrl" ref="audioElement" :src="audioUrl" controls>
        {{ t('audio.browserAudio') }}
      </audio>
      <p v-if="errorMessage" class="audio-error" role="status">{{ errorMessage }}</p>
    </template>
  </section>
</template>

<style scoped>
.artwork-audio-panel {
  margin: 0;
  padding: 20px;
  border: 1px solid var(--smk-line);
  background: var(--smk-paper);
}

.artwork-audio-panel h3 {
  margin: 0 0 12px;
  font-size: 1.2rem;
  font-weight: 600;
  line-height: 1.25;
}

.artwork-audio-panel h4 {
  margin: 0 0 16px;
  overflow-wrap: anywhere;
  font-size: 1.05rem;
  font-weight: 600;
}

.artwork-audio-panel label {
  display: block;
  margin: 16px 0 6px;
  font-weight: 600;
  font-size: 0.9rem;
}

.artwork-audio-panel select,
.artwork-audio-panel textarea,
.artwork-audio-panel audio {
  box-sizing: border-box;
  width: 100%;
  margin-bottom: 8px;
}

.artwork-audio-panel select {
  padding: 10px 36px 10px 12px;
}

.artwork-audio-panel textarea {
  min-height: 132px;
  padding: 12px;
  resize: vertical;
  font: inherit;
  line-height: 1.55;
}

.artwork-audio-panel button {
  width: 100%;
  margin-top: 8px;
  border: 1px solid var(--smk-ink);
  border-radius: 0;
  background: var(--smk-ink);
  color: var(--smk-paper);
  font-weight: 600;
}

.artwork-audio-panel button:hover:not(:disabled) {
  background: #333;
}

.artwork-audio-panel audio {
  display: block;
  margin-top: 16px;
}

.audio-error {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-left: 3px solid var(--smk-ink);
  background: var(--smk-surface);
  color: var(--smk-ink);
  line-height: 1.5;
}

@media (max-width: 480px) {
  .artwork-audio-panel {
    padding: 16px;
  }
}
</style>
