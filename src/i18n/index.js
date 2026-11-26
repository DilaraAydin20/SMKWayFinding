import { createI18n } from 'vue-i18n'
import da from './locales/da.js'
import en from './locales/en.js'
import de from './locales/de.js'
import fr from './locales/fr.js'
import sv from './locales/sv.js'
import it from './locales/it.js'

export const languageOptions = [
  { code: 'da', name: 'Dansk' },
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'sv', name: 'Svenska' },
  { code: 'it', name: 'Italiano' }
]

export const supportedLanguages = languageOptions.map(({ code }) => code)
export const languageStorageKey = 'smk-wayfinding-language'

export function isSupportedLanguage(language) {
  return supportedLanguages.includes(language)
}

const savedLanguage = localStorage.getItem(languageStorageKey)
const initialLanguage = isSupportedLanguage(savedLanguage) ? savedLanguage : 'da'

export const i18n = createI18n({
  legacy: false,
  locale: initialLanguage,
  fallbackLocale: 'da',
  messages: { da, en, de, fr, sv, it }
})

document.documentElement.lang = initialLanguage
