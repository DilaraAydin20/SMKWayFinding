import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: localStorage.getItem('smk-auth-token') || null,
    isLoading: false
  }),
  getters: {
    isAuthenticated: (state) => !!state.token
  },
  actions: {
    async login(email, password) {
      this.isLoading = true
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Login failed')
        this.token = data.token
        this.user = { email }
        localStorage.setItem('smk-auth-token', data.token)
        return data
      } finally {
        this.isLoading = false
      }
    },

    async register(email, password) {
      this.isLoading = true
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Registration failed')
        this.token = data.token
        this.user = { email }
        localStorage.setItem('smk-auth-token', data.token)
        return data
      } finally {
        this.isLoading = false
      }
    },

    logout() {
      this.user = null
      this.token = null
      localStorage.removeItem('smk-auth-token')
    },

    fetchUser() {
      if (this.token) {
        // Token stored; validate on first protected call
      }
    }
  }
})
