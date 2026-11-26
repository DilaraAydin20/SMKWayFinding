import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Import Leaflet
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Import global mobile-first styles
import './styles/mobile.css'

// Import our components and stores
import App from './App.vue'
import { i18n } from './i18n/index.js'

// Create Vue app with Pinia
const app = createApp(App)

// Use Pinia for state management
app.use(createPinia())
app.use(i18n)

// Mount the application
app.mount('#app')