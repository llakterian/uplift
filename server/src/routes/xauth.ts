import { Hono } from 'hono'
import type { Env } from '../types'

const app = new Hono<{ Bindings: Env }>()

app.get('/x', async (c) => {
  // Placeholder for X OAuth 2.0 PKCE flow initiation
  // Needs X_CLIENT_ID, redirects to X with code_challenge
  return c.json({ error: 'X OAuth not fully configured yet. Use manual login.' }, 501)
})

app.get('/x/callback', async (c) => {
  // Placeholder for exchanging code for token
  return c.json({ error: 'X OAuth not fully configured yet.' }, 501)
})

export default app
