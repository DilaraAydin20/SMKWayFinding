import { Router } from 'express'
import User from '../models/User.js'
import jwt from 'jsonwebtoken'

const router = Router()

// POST /api/auth/register — create user account
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body ?? {}

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required.' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' })
    }

    const existing = await User.findOne({ where: { email } })
    if (existing) {
      return res.status(409).json({ error: 'Email already registered.' })
    }

    const user = await User.create({ email, password_hash: password })
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )

    res.status(201).json({ message: 'User created.', token })
  } catch (err) {
    console.error('Registration error:', err.message)
    res.status(500).json({ error: err.message || 'Registration failed.' })
  }
})

// POST /api/auth/login — authenticate user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {}

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required.' })
    }

    const user = await User.findOne({ where: { email } })
    if (!user || !(await user.validatePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials.' })
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    )

    res.json({ message: 'Logged in.', token })
  } catch (err) {
    console.error('Login error:', err.message)
    res.status(500).json({ error: err.message || 'Login failed.' })
  }
})

// GET /api/auth/me — current user profile (protected)
router.get('/me', async (req, res) => {
  try {
    const { authenticate } = await import('../middleware/auth.js')
    authenticate(req, res, () => {
      res.json({ id: req.user.id, email: req.user.email })
    })
  } catch (err) {
    console.error('Me error:', err.message)
    res.status(500).json({ error: err.message || 'Failed to get user.' })
  }
})

export default router
