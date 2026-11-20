<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  artwork: {
    type: Object,
    default: null
  }
})

const languages = [
  { code: 'da', name: 'Dansk' },
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'sv', name: 'Svenska' },
  { code: 'it', name: 'Italiano' }
]

const language = ref('da')
const description = ref('')
const audioUrl = ref(null)
const audioElement = ref(null)
const isLoading = ref(false)
const errorMessage = ref('')
let requestController = null

const artworkName = computed(() => props.artwork?.name || props.artwork?.title || props.artwork?.id || '')

function getArtworkDescription() {
  const descriptions = props.artwork?.descriptions
  const descriptionValue = props.artwork?.description
  const localizedDescription = descriptions?.[language.value] ??
    (typeof descriptionValue === 'object' ? descriptionValue?.[language.value] : descriptionValue)

  return typeof localizedDescription === 'string' ? localizedDescription : ''
}

function clearAudio() {
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
    audioUrl.value = null
  }
}

watch(
  [() => props.artwork?.id, language],
  () => {
    description.value = getArtworkDescription()
    clearAudio()
    errorMessage.value = ''
  },
  { immediate: true }
)

watch(description, () => {
  clearAudio()
  errorMessage.value = ''
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
        language: language.value
      }),
      signal: requestController.signal
    })

    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      throw new Error(result.error || `Speech generation failed (${response.status}).`)
    }

    audioUrl.value = URL.createObjectURL(await response.blob())
    await nextTick()

    try {
      await audioElement.value?.play()
    } catch {
      errorMessage.value = 'Audio is ready. Press Play in the audio controls to listen.'
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      errorMessage.value = error.message || 'Speech generation failed. Please try again.'
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
    <h3 id="artwork-audio-title">Listen to artwork</h3>

    <p v-if="!artwork">Scan an artwork QR code to listen to its description.</p>
    <template v-else>
      <h4>{{ artworkName }}</h4>

      <label for="artwork-audio-language">Description language</label>
      <select id="artwork-audio-language" v-model="language" :disabled="isLoading">
        <option v-for="option in languages" :key="option.code" :value="option.code">
          {{ option.name }}
        </option>
      </select>

      <label for="artwork-audio-description">Artwork description</label>
      <textarea
        id="artwork-audio-description"
        v-model="description"
        :disabled="isLoading"
        maxlength="5000"
        rows="5"
        :placeholder="`Enter the ${languages.find(option => option.code === language)?.name} description`"
      ></textarea>

      <button
        type="button"
        class="btn btn-primary"
        :disabled="isLoading || !description.trim()"
        @click="generateSpeech"
      >
        {{ isLoading ? 'Generating audio…' : 'Generate and play' }}
      </button>

      <audio v-if="audioUrl" ref="audioElement" :src="audioUrl" controls>
        Your browser does not support audio playback.
      </audio>
      <p v-if="errorMessage" class="audio-error" role="status">{{ errorMessage }}</p>
    </template>
  </section>
</template>

<style scoped>
.artwork-audio-panel {
  margin-top: 20px;
  padding: 15px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.artwork-audio-panel h3 {
  margin-top: 0;
  color: #1a4d78;
}

.artwork-audio-panel h4 {
  overflow-wrap: anywhere;
}

.artwork-audio-panel label {
  display: block;
  margin: 12px 0 5px;
  font-weight: 600;
}

.artwork-audio-panel select,
.artwork-audio-panel textarea,
.artwork-audio-panel audio {
  box-sizing: border-box;
  width: 100%;
  margin-bottom: 12px;
}

.artwork-audio-panel textarea {
  resize: vertical;
  font: inherit;
}

.artwork-audio-panel button {
  width: 100%;
}

.audio-error {
  color: #a12622;
}
</style>
