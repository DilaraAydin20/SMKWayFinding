import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Import Leaflet
import 'leaflet'
import 'leaflet/dist/leaflet.css'

// Import our components and stores
import App from './App.vue'

// Create Vue app with Pinia
const app = createApp(App)

// Use Pinia for state management
app.use(createPinia())

// Mount the application
app.mount('#app')