<script>
import { useAuthStore } from '../stores/auth.js'
import { useRouter } from 'vue-router'

export default {
  name: 'Register',
  data() {
    return {
      email: '',
      password: '',
      confirmPassword: '',
      error: ''
    }
  },
  computed: {
    t() {
      return (key) => this.$t(key)
    }
  },
  methods: {
    async handleSubmit() {
      this.error = ''

      if (!this.email.trim()) {
        this.error = this.t('auth.emailRequired')
        return
      }
      if (!this.password) {
        this.error = this.t('auth.passwordRequired')
        return
      }
      if (this.password.length < 6) {
        this.error = this.t('auth.passwordMin')
        return
      }
      if (this.password !== this.confirmPassword) {
        this.error = this.t('auth.passwordsNotMatch')
        return
      }

      const auth = useAuthStore()
      try {
        await auth.register(this.email.trim(), this.password)
        this.$router.push('/')
      } catch (err) {
        this.error = err.message || this.t('auth.error')
      }
    }
  }
}
</script>

<template>
  <main class="app-main">
    <section class="auth-card">
      <h1 class="auth-title">{{ t('auth.registerTitle') }}</h1>
      <p class="auth-desc">{{ t('auth.registerDesc') }}</p>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <label class="auth-field">
          <span class="auth-label">{{ t('auth.email') }}</span>
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            :placeholder="t('auth.email')"
            required
          />
        </label>

        <label class="auth-field">
          <span class="auth-label">{{ t('auth.password') }}</span>
          <input
            v-model="password"
            type="password"
            autocomplete="new-password"
            :placeholder="t('auth.password')"
            required
          />
        </label>

        <label class="auth-field">
          <span class="auth-label">{{ t('auth.confirmPassword') }}</span>
          <input
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            :placeholder="t('auth.confirmPassword')"
            required
          />
        </label>

        <p v-if="error" class="auth-error">{{ error }}</p>

        <button type="submit" class="btn">
          {{ t('auth.registerBtn') }}
        </button>
      </form>

      <p class="auth-switch">
        {{ t('auth.hasAccount') }}
        <RouterLink to="/login">{{ t('auth.switchToLogin') }}</RouterLink>
      </p>
    </section>
  </main>
</template>

<style scoped>
.auth-card {
  width: min(100%, 420px);
  margin: 40px auto;
  padding: 32px;
  border: 1px solid var(--smk-line);
  background: var(--smk-paper);
}

.auth-title {
  margin: 0 0 8px;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--smk-ink);
}

.auth-desc {
  margin: 0 0 24px;
  font-size: 0.95rem;
  color: var(--smk-muted);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.auth-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--smk-ink);
}

.auth-field input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--smk-line);
  border-radius: 0;
  background: var(--smk-paper);
  color: var(--smk-ink);
  font-size: 16px;
  min-height: 44px;
}

.auth-field input:focus {
  outline: 2px solid var(--smk-ink);
  outline-offset: 2px;
}

.auth-error {
  margin: 0;
  padding: 10px 12px;
  font-size: 0.9rem;
  color: var(--smk-ink);
  background: var(--smk-surface);
  border-left: 3px solid var(--smk-ink);
}


.auth-switch {
  margin: 20px 0 0;
  font-size: 0.9rem;
  color: var(--smk-muted);
  text-align: center;
}

.auth-switch a {
  color: var(--smk-ink);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

@media (max-width: 480px) {
  .auth-card {
    margin: 20px 14px;
    padding: 24px 18px;
  }

  .auth-title {
    font-size: 1.25rem;
  }
}
</style>
