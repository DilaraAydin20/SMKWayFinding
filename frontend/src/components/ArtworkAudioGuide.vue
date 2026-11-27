<script>
import { nextTick } from 'vue'

export default {
  name: 'ArtworkAudioGuide',
  props: {
    artwork: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      language: 'da',
      description: '',
      audioUrl: null,
      isLoading: false,
      errorMessage: ''
    }
  },
  computed: {
    languages() {
      return [
        { code: 'da', name: 'Dansk' },
        { code: 'en', name: 'English' },
        { code: 'de', name: 'Deutsch' },
        { code: 'fr', name: 'Français' },
        { code: 'sv', name: 'Svenska' },
        { code: 'it', name: 'Italiano' }
      ]
    },
    artworkName() {
      return (this.artwork?.name || this.artwork?.title || this.artwork?.id || '')
    },
    audioElementRef() {
      // Will be set via $refs in template
      return null
    }
  },
  watch: {
    'artwork.id': {
      handler() {
        this.description = this.getArtworkDescription()
        this.clearAudio()
        this.errorMessage = ''
      },
      immediate: true
    },
    language() {
      this.description = this.getArtworkDescription()
      this.clearAudio()
      this.errorMessage = ''
    },
    description() {
      this.clearAudio()
      this.errorMessage = ''
    }
  },
  methods: {
    getArtworkDescription() {
      const descriptions = this.artwork?.descriptions
      const descriptionValue = this.artwork?.description
      const localizedDescription = descriptions?.[this.language] ||
        (typeof descriptionValue === 'object' ? descriptionValue?.[this.language] : descriptionValue)

      return typeof localizedDescription === 'string' ? localizedDescription : ''
    },
    clearAudio() {
      if (this.audioUrl) {
        URL.revokeObjectURL(this.audioUrl)
        this.audioUrl = null
      }
    },
    async generateSpeech() {
      if (!this.artwork || !this.description.trim() || this.isLoading) return

      this.clearAudio()
      this.errorMessage = ''
      this.isLoading = true

      try {
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: this.description.trim(),
            language: this.language
          })
        })

        if (!response.ok) {
          const result = await response.json().catch(() => ({}))
          throw new Error(result.error || `Speech generation failed (${response.status}).`)
        }

        this.audioUrl = URL.createObjectURL(await response.blob())
        await nextTick()

        try {
          await this.$refs.audioPlayer?.play()
        } catch {
          this.errorMessage = 'Audio is ready. Press Play in the audio controls to listen.'
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          this.errorMessage = error.message || 'Speech generation failed. Please try again.'
        }
      } finally {
        this.isLoading = false
      }
    }
  },
  beforeUnmount() {
    this.clearAudio()
  }
}
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

      <audio v-if="audioUrl" ref="audioPlayer" :src="audioUrl" controls>
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
  background: var(--smk-paper);
  border-radius: 0;
  border: 1px solid var(--smk-line);
}

.artwork-audio-panel h3 {
  margin-top: 0;
  color: var(--smk-ink);
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
  color: var(--smk-ink);
}
</style>
