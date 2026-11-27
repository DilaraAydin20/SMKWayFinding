import { createRouter, createWebHistory } from 'vue-router'
import Artworks from '../views/artworks.vue'
import Homepage from '../views/homepage.vue'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import { useAuthStore } from '../stores/auth.js'

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
    },
    {
      path: '/login',
      name: 'login',
      component: Login,
      meta: { guest: true }
    },
    {
      path: '/register',
      name: 'register',
      component: Register,
      meta: { guest: true }
    }
  ]
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  // If already logged in and visiting guest-only page, redirect to homepage
  if (to.meta.guest && auth.isAuthenticated) {
    return { name: 'homepage' }
  }
})

export default router
