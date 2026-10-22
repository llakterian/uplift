import { Hono } from 'hono'
import type { Env } from '../types'
import { sanitizeHtml } from '../services/security'
import { checkRateLimitKV } from '../middleware/rateLimit'
import { parseBoundedInt } from '../config'

const app = new Hono<{ Bindings: Env }>()

const X_HANDLE_PATTERN = /^[A-Za-z0-9_]{1,15}$/
const VALID_CATEGORIES = [
  'science', 'health', 'animals', 'community', 'inspiration', 'tech', 'environment', 'culture'
]

app.post('/join', async (c) => {
  if (!c.env.DB) return c.json({ error: 'Database not configured' }, 500)

  // Application endpoint — throttle it so the creator table cannot be spammed.
  const ip = c.req.header('cf-connecting-ip') || 'unknown'
  const allowed = await checkRateLimitKV(c.env.UPLIFT_CACHE, `circle-join:${ip}`, 5, 3600)
  if (!allowed) return c.json({ error: 'Too many applications. Try again later.' }, 429)

  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const x_handle = body?.x_handle
  const name = body?.name
  const bio = body?.bio
  const categories = body?.categories

  if (typeof x_handle !== 'string' || !x_handle) {
    return c.json({ error: 'X Handle is required' }, 400)
  }

  const handle = (x_handle.startsWith('@') ? x_handle.substring(1) : x_handle).trim()
  if (!X_HANDLE_PATTERN.test(handle)) {
    return c.json({ error: 'Invalid X handle' }, 400)
  }

  // Only allow known categories, and cap the number accepted.
  const requestedCategories = Array.isArray(categories) ? categories : []
  if (requestedCategories.length > 8) {
    return c.json({ error: 'Too many categories' }, 400)
  }
  const safeCategories = requestedCategories.filter(
    (cat: unknown): cat is string => typeof cat === 'string' && VALID_CATEGORIES.includes(cat)
  )

  try {
    // Insert as verified=false until an admin approves.
    const result = await c.env.DB.prepare(
      "INSERT INTO creators (x_handle, name, bio, categories, is_verified, reciprocity_score) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(
      handle,
      sanitizeHtml(typeof name === 'string' ? name : '', 100),
      sanitizeHtml(typeof bio === 'string' ? bio : '', 500),
      JSON.stringify(safeCategories),
      0, // not verified initially
      0
    ).run()

    if (!result.success) return c.json({ error: 'Handle already requested' }, 400)

    // TODO: replace with a real transactional email provider (Resend/SendGrid).
    console.log(`[circle] New application: @${handle} — ${sanitizeHtml(String(name ?? ''), 100)}`)

    return c.json({ success: true, message: 'Join request submitted' })
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) return c.json({ error: 'Handle already requested' }, 400)
    console.error(error)
    return c.json({ error: 'Submission failed' }, 500)
  }
})

app.get('/directory', async (c) => {
  if (!c.env.DB) return c.json({ creators: [] })

  try {
    const page = parseBoundedInt(c.req.query('page'), 1, 1, 10000)
    const limit = parseBoundedInt(c.req.query('limit'), 50, 1, 100)
    const offset = (page - 1) * limit

    const creators = await c.env.DB.prepare(
      "SELECT id, x_handle, name, bio, avatar_url, categories, is_verified, reciprocity_score FROM creators WHERE is_verified = 1 ORDER BY reciprocity_score DESC LIMIT ? OFFSET ?"
    ).bind(limit, offset).all()

    return c.json({
      success: true,
      creators: creators.results.map((row: any) => ({
        ...row,
        categories: JSON.parse(row.categories || '[]')
      }))
    })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Failed to fetch directory' }, 500)
  }
})

app.get('/feed', async (c) => {
  if (!c.env.DB) return c.json({ posts: [] })

  try {
    const page = parseBoundedInt(c.req.query('page'), 1, 1, 10000)
    const limit = parseBoundedInt(c.req.query('limit'), 50, 1, 100)
    const offset = (page - 1) * limit

    const postsQuery = await c.env.DB.prepare(`
      SELECT p.*, c.x_handle, c.name, c.avatar_url
      FROM circle_posts p
      JOIN creators c ON p.creator_id = c.id
      ORDER BY p.posted_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all()

    return c.json({
      success: true,
      posts: postsQuery.results.map((p: any) => ({
        ...p,
        media_urls: JSON.parse(p.media_urls || '[]'),
        amplified_by: JSON.parse(p.amplified_by || '[]'),
        creator: { x_handle: p.x_handle, name: p.name, avatar_url: p.avatar_url }
      }))
    })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Failed to fetch feed' }, 500)
  }
})

app.post('/amplify', async (c) => {
  if (!c.env.DB) return c.json({ error: 'DB not configured' }, 500)

  const ip = c.req.header('cf-connecting-ip') || 'unknown'
  const allowed = await checkRateLimitKV(c.env.UPLIFT_CACHE, `amplify:${ip}`, 30, 3600)
  if (!allowed) return c.json({ error: 'Too many requests' }, 429)

  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { post_id, amplifier_handle } = body || {}
  if (typeof post_id !== 'string' || !post_id) {
    return c.json({ error: 'Missing post_id' }, 400)
  }
  if (typeof amplifier_handle !== 'string' || !amplifier_handle) {
    return c.json({ error: 'Missing amplifier_handle' }, 400)
  }
  if (!X_HANDLE_PATTERN.test(amplifier_handle.replace(/^@/, ''))) {
    return c.json({ error: 'Invalid amplifier handle' }, 400)
  }

  try {
    await c.env.DB.prepare(
      "INSERT INTO amplifications (circle_post_id, amplifier_handle) VALUES (?, ?)"
    ).bind(post_id, sanitizeHtml(amplifier_handle, 15)).run()

    return c.json({ success: true })
  } catch (e) {
    console.error(e)
    return c.json({ error: 'Failed to amplify' }, 500)
  }
})

app.get('/leaderboard', async (c) => {
  if (!c.env.DB) return c.json({ leaderboard: [] })
  try {
    const creators = await c.env.DB.prepare(
      "SELECT id, x_handle, name, avatar_url, reciprocity_score FROM creators WHERE is_verified = 1 ORDER BY reciprocity_score DESC LIMIT 10"
    ).all()
    return c.json({ success: true, leaderboard: creators.results })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Failed to fetch leaderboard' }, 500)
  }
})

export default app
