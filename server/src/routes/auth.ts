import { Hono } from 'hono'
import type { Env } from '../types'
import { hashPassword, sanitizeHtml } from '../services/security'

const app = new Hono<{ Bindings: Env }>()

app.post('/register', async (c) => {
  if (!c.env.DB) return c.json({ error: 'Database not configured' }, 500)
  
  const { email, password } = await c.req.json()
  
  if (!email || !password) return c.json({ error: 'Email and password required' }, 400)
  
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailPattern.test(email)) return c.json({ error: 'Invalid email format' }, 400)
  if (password.length < 6) return c.json({ error: 'Password must be at least 6 characters' }, 400)
  
  try {
    const hash = await hashPassword(password)
    const result = await c.env.DB.prepare("INSERT INTO users (email, password_hash, streak, level) VALUES (?, ?, 0, 'Uplift Explorer')")
      .bind(sanitizeHtml(email, 254), hash).run()
    
    if (result.success) return c.json({ success: true, message: 'Account created successfully' })
    else return c.json({ error: 'Email already registered' }, 400)
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) return c.json({ error: 'Email already registered' }, 400)
    return c.json({ error: 'Registration failed' }, 500)
  }
})

app.post('/login', async (c) => {
  if (!c.env.DB) return c.json({ error: 'Database not configured' }, 500)
  
  const { email, password } = await c.req.json()
  if (!email || !password) return c.json({ error: 'Email and password required' }, 400)
  
  try {
    const hash = await hashPassword(password)
    const user = await c.env.DB.prepare("SELECT id, email, streak, level, last_visit FROM users WHERE email = ? AND password_hash = ?")
      .bind(sanitizeHtml(email, 254), hash).first() as any
    
    if (!user) return c.json({ error: 'Invalid credentials' }, 401)
    
    const sessionToken = crypto.randomUUID()
    const sessionKey = `session:${sessionToken}`
    await c.env.UPLIFT_CACHE?.put(sessionKey, user.id.toString(), { expirationTtl: 86400 * 30 })
    
    return c.json({ success: true, user: { id: user.id, email: user.email, streak: user.streak, level: user.level }, token: sessionToken })
  } catch (error) {
    return c.json({ error: 'Login failed' }, 500)
  }
})

export default app
