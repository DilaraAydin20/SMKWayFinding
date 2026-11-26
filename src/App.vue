<script setup>
import { ref } from 'vue'
import Header from './components/Header.vue'
import LanguageDialog from './components/LanguageDialog.vue'
import { languageStorageKey, isSupportedLanguage, setLanguage as updateLanguage } from './i18n/index.js'

const languageDialogOpen = ref(!isSupportedLanguage(localStorage.getItem(languageStorageKey)))

function setLanguage(language) {
  if (!updateLanguage(language)) return
  languageDialogOpen.value = false
}
</script>

<template>
  <div class="site-shell">
    <Header />
    <RouterView />
  </div>
  <LanguageDialog :open="languageDialogOpen" @confirm="setLanguage" />
</template>
