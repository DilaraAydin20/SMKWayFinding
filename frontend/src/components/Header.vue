<script>
import { languageOptions, setLanguage } from '../i18n/index.js'
import { useAuthStore } from '../stores/auth.js'

export default {
  name: 'Header',
  data() {
    return { selectedLanguage: this.$i18n.locale }
  },
  computed: {
    t() {
      return (key) => this.$t(key)
    },
    auth() {
      return useAuthStore()
    },
    languageOptions() {
      return languageOptions
    }
  },
  watch: {
    '$i18n.locale'(value) {
      this.selectedLanguage = value
    }
  },
  methods: {
    updateLanguage(event) {
      setLanguage(event.target.value)
    },
    handleLogout() {
      this.auth.logout()
      this.$router.push('/login')
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
    <div class="header-actions">
      <label class="language-switcher">
        <span>{{ t('app.language') }}</span>
        <select :value="selectedLanguage" @change="updateLanguage" :aria-label="t('app.language')">
          <option v-for="language in languageOptions" :key="language.code" :value="language.code">
            {{ language.name }}
          </option>
        </select>
      </label>
      <span v-if="auth.isAuthenticated" class="auth-status">
        <button class="btn-auth-link" @click="handleLogout">{{ t('auth.logout') }}</button>
      </span>
      <RouterLink v-else to="/login" class="auth-link">{{ t('auth.login') }}</RouterLink>
    </div>
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
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

.auth-status {
  display: inline-flex;
  align-items: center;
}

.btn-auth-link {
  min-height: 40px;
  padding: 6px 12px;
  background: none;
  border: 1px solid var(--smk-line);
  color: var(--smk-ink);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.btn-auth-link:hover {
  background: var(--smk-surface);
}

.auth-link {
  min-height: 40px;
  padding: 6px 12px;
  display: inline-flex;
  align-items: center;
  color: var(--smk-ink);
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  border: 1px solid var(--smk-line);
}

.auth-link:hover {
  background: var(--smk-surface);
  text-decoration: underline;
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

  .header-actions {
    gap: 8px;
  }
}
</style>
