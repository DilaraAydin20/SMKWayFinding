<script>
import { languageOptions, setLanguage } from '../i18n/index.js'

export default {
  name: 'Header',
  computed: {
    locale() {
      return this.$i18n.locale
    },
    t() {
      return (key) => this.$t(key)
    }
  },
  methods: {
    languageOptions,
    updateLanguage(event) {
      setLanguage(event.target.value)
    }
  }
}
</script>

<template>
  <header class="app-header">
    <RouterLink class="brand" to="/" :aria-label="`${t('app.brand')} — ${t('app.map')}`">
      <img src="../assets/brand/smk-primary-logo-da.svg" alt="Statens Museum for Kunst" />
      <span class="brand-name">{{ t('app.brand') }}</span>
    </RouterLink>
    <nav class="primary-navigation" :aria-label="t('app.navigation')">
      <RouterLink to="/#map">{{ t('app.map') }}</RouterLink>
      <RouterLink to="/artworks">{{ t('app.artworks') }}</RouterLink>
    </nav>
    <label class="language-switcher">
      <span>{{ t('app.language') }}</span>
      <select :value="locale" :aria-label="t('app.language')" @change="updateLanguage">
        <option v-for="language in languageOptions" :key="language.code" :value="language.code">
          {{ language.name }}
        </option>
      </select>
    </label>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 76px;
  padding: 10px clamp(16px, 4vw, 56px);
  border-bottom: 1px solid var(--smk-line);
  background: var(--smk-paper);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  color: var(--smk-ink);
  text-decoration: none;
}

.brand img {
  display: block;
  width: 78px;
  height: auto;
}

.brand-name {
  padding-left: 14px;
  border-left: 1px solid var(--smk-line);
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.primary-navigation {
  display: flex;
  align-items: center;
  gap: clamp(14px, 3vw, 32px);
}

.primary-navigation a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--smk-ink);
  font-size: 0.95rem;
  font-weight: 600;
  text-decoration: none;
  text-underline-offset: 5px;
}

.primary-navigation a:hover {
  text-decoration: underline;
}

.language-switcher {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--smk-muted);
  font-size: 0.85rem;
  font-weight: 600;
}

.language-switcher select {
  min-height: 40px;
  padding: 6px 30px 6px 10px;
  font-size: 0.9rem;
}

@media (max-width: 480px) {
  .app-header {
    flex-wrap: wrap;
    gap: 4px 10px;
    min-height: 64px;
    padding: 8px 14px;
  }

  .brand {
    gap: 9px;
  }

  .brand img {
    width: 60px;
  }

  .brand-name {
    padding-left: 9px;
    font-size: 0.8rem;
  }

  .primary-navigation {
    gap: 10px;
  }

  .primary-navigation a {
    font-size: 0.85rem;
  }

  .language-switcher {
    gap: 5px;
    margin-left: auto;
    font-size: 0.75rem;
  }

  .language-switcher select {
    min-height: 36px;
    padding: 5px 25px 5px 8px;
    font-size: 0.85rem;
  }
}
</style>
