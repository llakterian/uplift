import { Hono } from 'hono'
import type { Env } from '../types'
import { hashPassword, verifyPassword } from '../services/security'
import { createSession, destroySession, getSessionUser, extractBearerToken } from '../middleware/auth'
import { checkRateLimitKV } from '../middleware/rateLimit'

const app = new Hono<{ Bindings: Env }>()

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MAX_EMAIL_LENGTH = 254
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 200

/** Rate limits for credential endpoints, keyed per-IP. */
const LOGIN_LIMIT = 10
const LOGIN_WINDOW = 300 // 5 minutes
const REGISTER_LIMIT = 5
const REGISTER_WINDOW = 3600 // 1 hour

function clientKey(c: { req: { header: (k: string) => string | undefined } }): string {
  return c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null
  const trimmed = email.trim().toLowerCase()
  if (!trimmed || trimmed.length > MAX_EMAIL_LENGTH) return null
  if (!EMAIL_PATTERN.test(trimmed)) return null
  return trimmed
}

app.post('/register', async (c) => {
  if (!c.env.DB) return c.json({ error: 'Database not configured' }, 500)
  if (!c.env.UPLIFT_CACHE) return c.json({ error: 'Session storage not configured' }, 500)

  const ip = clientKey(c)
  const allowed = await checkRateLimitKV(c.env.UPLIFT_CACHE, `register:${ip}`, REGISTER_LIMIT, REGISTER_WINDOW)
  if (!allowed) return c.json({ error: 'Too many registration attempts. Try again later.' }, 429)

  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const email = normalizeEmail(body?.email)
  const password = body?.password

  if (!email) return c.json({ error: 'A valid email address is required' }, 400)
  if (typeof password !== 'string') return c.json({ error: 'Password is required' }, 400)
  if (password.length < MIN_PASSWORD_LENGTH) {
    return c.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }, 400)
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return c.json({ error: 'Password is too long' }, 400)
  }

  try {
    const hash = await hashPassword(password)
    const result = await c.env.DB.prepare(
      "INSERT INTO users (email, password_hash, streak, level) VALUES (?, ?, 0, 'Uplift Explorer')"
    ).bind(email, hash).run()

    if (!result.success) return c.json({ error: 'Email already registered' }, 400)

    const user = await c.env.DB.prepare("SELECT id, email, streak, level FROM users WHERE email = ?")
      .bind(email).first() as any

    if (!user) return c.json({ success: true, message: 'Account created successfully' }, 201)

    const token = await createSession(c.env.UPLIFT_CACHE, user.id)
    return c.json({
      success: true,
      message: 'Account created successfully',
      user: { id: user.id, email: user.email, streak: user.streak, level: user.level },
      token
    }, 201)
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) return c.json({ error: 'Email already registered' }, 400)
    console.error('Registration failed:', error)
    return c.json({ error: 'Registration failed' }, 500)
  }
})

app.post('/login', async (c) => {
  if (!c.env.DB) return c.json({ error: 'Database not configured' }, 500)
  if (!c.env.UPLIFT_CACHE) return c.json({ error: 'Session storage not configured' }, 500)

  const ip = clientKey(c)
  const allowed = await checkRateLimitKV(c.env.UPLIFT_CACHE, `login:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW)
  if (!allowed) return c.json({ error: 'Too many login attempts. Try again later.' }, 429)

  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const email = normalizeEmail(body?.email)
  const password = body?.password

  if (!email || typeof password !== 'string' || !password) {
    return c.json({ error: 'Email and password required' }, 400)
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  try {
    const user = await c.env.DB.prepare(
      "SELECT id, email, password_hash, streak, level, last_visit FROM users WHERE email = ?"
    ).bind(email).first() as any

    // Always run the KDF so that a missing account and a wrong password take
    // roughly the same amount of time (prevents user enumeration by timing).
    const storedHash = user?.password_hash || 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
    const { valid, needsRehash } = await verifyPassword(password, storedHash)

    if (!user || !valid) {
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    // Upgrade legacy SHA-256 hashes transparently on successful login.
    if (needsRehash) {
      try {
        const upgraded = await hashPassword(password)
        await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(upgraded, user.id).run()
      } catch (error) {
        console.error('Password rehash failed:', error)
      }
    }

    const token = await createSession(c.env.UPLIFT_CACHE, user.id)

    return c.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        streak: user.streak,
        level: user.level,
        lastVisit: user.last_visit
      },
      token
    })
  } catch (error) {
    console.error('Login failed:', error)
    return c.json({ error: 'Login failed' }, 500)
  }
})

/** Return the currently authenticated user. */
app.get('/me', async (c) => {
  const user = await getSessionUser(c)
  if (!user) return c.json({ error: 'Authentication required' }, 401)
  if (!c.env.DB) return c.json({ error: 'Database not configured' }, 500)

  try {
    const record = await c.env.DB.prepare(
      "SELECT id, email, streak, level, last_visit, created_at FROM users WHERE id = ?"
    ).bind(user.id).first() as any
    if (!record) return c.json({ error: 'User not found' }, 404)
    return c.json({ success: true, user: record })
  } catch (error) {
    console.error('Failed to load profile:', error)
    return c.json({ error: 'Failed to load profile' }, 500)
  }
})

/** Revoke the current session. */
app.post('/logout', async (c) => {
  const token = extractBearerToken(c.req.header('Authorization'))
  if (!token || !c.env.UPLIFT_CACHE) {
    return c.json({ success: true, note: 'No active session' })
  }
  try {
    await destroySession(c.env.UPLIFT_CACHE, token)
  } catch (error) {
    console.error('Logout failed:', error)
  }
  return c.json({ success: true })
})

export default app
