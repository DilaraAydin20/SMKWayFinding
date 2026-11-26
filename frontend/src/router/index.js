import { createRouter, createWebHistory } from 'vue-router'
import Artworks from '../views/artworks.vue'
import Homepage from '../views/homepage.vue'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(to) {
    if (to.hash) return { el: to.hash }
    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'homepage',
      component: Homepage
    },
    {
      path: '/artworks',
      name: 'artworks',
      component: Artworks
    }
  ]
})

export default router
