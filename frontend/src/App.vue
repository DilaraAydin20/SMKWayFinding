<script>
import Header from './components/Header.vue'
import LanguageDialog from './components/LanguageDialog.vue'
import { languageStorageKey, isSupportedLanguage, setLanguage as updateLanguage } from './i18n/index.js'

export default {
  name: 'App',
  components: { Header, LanguageDialog },
  data() {
    return {
      languageDialogOpen: !isSupportedLanguage(localStorage.getItem(languageStorageKey))
    }
  },
  methods: {
    setLanguage(language) {
      if (!updateLanguage(language)) return
      this.languageDialogOpen = false
    }
  }
}
</script>

<template>
  <div class="site-shell">
    <Header />
    <RouterView />
  </div>
  <LanguageDialog :open="languageDialogOpen" @confirm="setLanguage" />
</template>
