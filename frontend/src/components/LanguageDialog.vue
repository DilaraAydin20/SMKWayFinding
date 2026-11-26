<script>
import { languageOptions } from '../i18n/index.js'

export default {
  name: 'LanguageDialog',
  props: {
    open: {
      type: Boolean,
      required: true
    }
  },
  data() {
    return {
      pendingLanguage: this.$i18n.locale
    }
  },
  watch: {
    open() {
      // re-sync when dialog opens
    }
  },
  computed: {
    languageOptions() {
      return languageOptions
    }
  },
  methods: {
    confirmLanguage() {
      this.$emit('confirm', this.pendingLanguage)
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="language-dialog-backdrop">
      <section
        class="language-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="language-dialog-title"
      >
        <h2 id="language-dialog-title">{{ $t('app.chooseLanguage') }}</h2>
        <p>{{ $t('app.languageIntro') }}</p>
        <label for="initial-language">{{ $t('app.language') }}</label>
        <select id="initial-language" v-model="pendingLanguage">
          <option v-for="language in languageOptions" :key="language.code" :value="language.code">
            {{ language.name }}
          </option>
        </select>
        <button type="button" class="language-confirm" @click="confirmLanguage">
          {{ $t('app.continue') }}
        </button>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
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
</style>
