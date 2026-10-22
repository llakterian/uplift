import { Hono } from 'hono'
import type { Env } from '../types'
import { sanitizeHtml, isValidHttpUrl } from '../services/security'
import { requireAuth, getSessionUser } from '../middleware/auth'

const app = new Hono<{ Bindings: Env }>()

const MAX_BOOKMARKS_PER_USER = 1000

/**
 * Bookmarks are user-scoped, so every route below requires a valid session.
 * The user id is derived from the session token, never from a request header.
 */
app.use('*', requireAuth)

app.get('/', async (c) => {
  if (!c.env.DB) return c.json({ bookmarks: [], useLocalStorage: true })
  const user = await getSessionUser(c)
  if (!user) return c.json({ error: 'Authentication required' }, 401)

  try {
    const bookmarks = await c.env.DB.prepare(
      "SELECT post_id, title, url, image FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC"
    ).bind(user.id).all() as any
    return c.json({ bookmarks: bookmarks.results || [], useLocalStorage: false })
  } catch (error) {
    console.error('Failed to fetch bookmarks:', error)
    return c.json({ bookmarks: [], useLocalStorage: true })
  }
})

app.post('/', async (c) => {
  if (!c.env.DB) return c.json({ success: true, note: 'Using localStorage for bookmarks' })
  const user = await getSessionUser(c)
  if (!user) return c.json({ error: 'Authentication required' }, 401)

  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const { id, title, url, image } = body || {}
  if (!id || typeof id !== 'string') return c.json({ error: 'Bookmark id is required' }, 400)
  if (!url || typeof url !== 'string') return c.json({ error: 'Bookmark url is required' }, 400)

  // Only allow http(s) links; blocks javascript:/data: payloads stored for later rendering.
  if (!isValidHttpUrl(url)) return c.json({ error: 'Bookmark url must be a valid http(s) URL' }, 400)
  if (image && typeof image === 'string' && image.length > 0 && !isValidHttpUrl(image)) {
    return c.json({ error: 'Bookmark image must be a valid http(s) URL' }, 400)
  }

  try {
    const count = await c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM bookmarks WHERE user_id = ?"
    ).bind(user.id).first() as any

    if ((count?.total ?? 0) >= MAX_BOOKMARKS_PER_USER) {
      return c.json({ error: 'Bookmark limit reached' }, 400)
    }

    await c.env.DB.prepare(
      "INSERT OR REPLACE INTO bookmarks (user_id, post_id, title, url, image) VALUES (?, ?, ?, ?, ?)"
    ).bind(
      user.id,
      sanitizeHtml(id, 200),
      sanitizeHtml(title || '', 500),
      sanitizeHtml(url, 1000),
      image ? sanitizeHtml(image, 1000) : null
    ).run()
    return c.json({ success: true })
  } catch (error) {
    console.error('Failed to add bookmark:', error)
    return c.json({ error: 'Failed to add bookmark' }, 500)
  }
})

app.delete('/:id', async (c) => {
  if (!c.env.DB) return c.json({ success: true, note: 'Using localStorage for bookmarks' })
  const user = await getSessionUser(c)
  if (!user) return c.json({ error: 'Authentication required' }, 401)

  const postId = c.req.param('id')
  if (!postId) return c.json({ error: 'Bookmark id is required' }, 400)

  try {
    await c.env.DB.prepare("DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?")
      .bind(user.id, postId).run()
    return c.json({ success: true })
  } catch (error) {
    console.error('Failed to remove bookmark:', error)
    return c.json({ error: 'Failed to remove bookmark' }, 500)
  }
})

export default app
