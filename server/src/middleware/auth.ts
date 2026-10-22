/**
 * Session authentication.
 *
 * Sessions are opaque random tokens stored in KV (`session:<token>` -> user id).
 * The client presents the token as `Authorization: Bearer <token>`.
 *
 * IMPORTANT: the user id is always derived from a validated session token.
 * It must never be read from a client-supplied header such as `X-User-Id`,
 * because that allows trivial account takeover.
 */

import type { Context } from 'hono'
import type { Env } from '../types'

const SESSION_PREFIX = 'session:'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

/** Session tokens are UUIDs; anything else is rejected before hitting KV. */
const SESSION_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface SessionUser {
  id: string
  email?: string
}

/**
 * Extract the bearer token from the Authorization header.
 * Returns null when the header is absent or malformed.
 */
export function extractBearerToken(header: string | undefined | null): string | null {
  if (!header) return null
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim())
  if (!match) return null
  const token = match[1]
  if (!SESSION_TOKEN_PATTERN.test(token)) return null
  return token
}

/**
 * Resolve the authenticated user for a request.
 * Returns null when the request is unauthenticated or the session expired.
 */
export async function getSessionUser(c: Context<{ Bindings: Env }>): Promise<SessionUser | null> {
  const token = extractBearerToken(c.req.header('Authorization'))
  if (!token || !c.env.UPLIFT_CACHE) return null

  try {
    const userId = await c.env.UPLIFT_CACHE.get(SESSION_PREFIX + token)
    if (!userId) return null
    return { id: userId }
  } catch (error) {
    console.error('Session lookup failed:', error)
    return null
  }
}

/**
 * Middleware that rejects requests without a valid session.
 *
 * Usage: `app.use('/api/bookmarks', requireAuth)` — the resolved user is
 * available downstream via `getSessionUser(c)`.
 */
export async function requireAuth(c: Context<{ Bindings: Env }>, next: () => Promise<void>) {
  const user = await getSessionUser(c)
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  await next()
}

/**
 * Create a session token for a user and persist it in KV.
 *
 * The token is also recorded in a per-user index (`sessions:<userId>`) so that
 * every session can be revoked at once.
 */
export async function createSession(kv: Env['UPLIFT_CACHE'], userId: string | number): Promise<string> {
  const token = crypto.randomUUID()
  const indexKey = `sessions:${userId}`

  await kv.put(SESSION_PREFIX + token, String(userId), { expirationTtl: SESSION_TTL_SECONDS })

  try {
    const existing = await kv.get(indexKey, 'json') as string[] | null
    const tokens = Array.isArray(existing) ? existing : []
    tokens.push(token)
    await kv.put(indexKey, JSON.stringify(tokens), { expirationTtl: SESSION_TTL_SECONDS })
  } catch (error) {
    // Indexing is best-effort; the session itself is already valid.
    console.error('Failed to index session:', error)
  }

  return token
}

/** Revoke a session token. */
export async function destroySession(kv: Env['UPLIFT_CACHE'], token: string): Promise<void> {
  await kv.delete(SESSION_PREFIX + token)
}

/** Revoke every session belonging to a user. */
export async function destroyAllSessions(kv: Env['UPLIFT_CACHE'], userId: string | number): Promise<void> {
  // KV has no prefix listing, so track user -> tokens in a separate index.
  const indexKey = `sessions:${userId}`
  try {
    const raw = await kv.get(indexKey, 'json') as string[] | null
    if (!raw) return
    for (const token of raw) {
      await kv.delete(SESSION_PREFIX + token)
    }
    await kv.delete(indexKey)
  } catch (error) {
    console.error('Failed to destroy sessions:', error)
  }
}
