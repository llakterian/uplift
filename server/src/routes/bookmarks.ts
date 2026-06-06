import { Hono } from 'hono'
import type { Env } from '../types'
import { sanitizeHtml } from '../services/security'

const app = new Hono<{ Bindings: Env }>()

app.get('/', async (c) => {
  const userId = c.req.header('X-User-Id')
  if (!userId || !c.env.DB) return c.json({ bookmarks: [], useLocalStorage: true })
  
  try {
    const bookmarks = await c.env.DB.prepare("SELECT post_id, title, url, image FROM bookmarks WHERE user_id = ?").bind(userId).all() as any
    return c.json({ bookmarks: bookmarks.results || [], useLocalStorage: false })
  } catch (error) {
    return c.json({ bookmarks: [], useLocalStorage: true })
  }
})

app.post('/', async (c) => {
  const userId = c.req.header('X-User-Id')
  const { id, title, url, image } = await c.req.json()
  
  if (!userId || !c.env.DB) return c.json({ success: true, note: 'Using localStorage for bookmarks' })
  
  try {
    await c.env.DB.prepare("INSERT OR REPLACE INTO bookmarks (user_id, post_id, title, url, image) VALUES (?, ?, ?, ?, ?)")
      .bind(userId, id, sanitizeHtml(title, 500), sanitizeHtml(url, 1000), sanitizeHtml(image, 1000)).run()
    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: 'Failed to add bookmark' }, 500)
  }
})

app.delete('/:id', async (c) => {
  const userId = c.req.header('X-User-Id')
  const postId = c.req.param('id')
  
  if (!userId || !c.env.DB) return c.json({ success: true, note: 'Using localStorage for bookmarks' })
  
  try {
    await c.env.DB.prepare("DELETE FROM bookmarks WHERE user_id = ? AND post_id = ?").bind(userId, postId).run()
    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: 'Failed to remove bookmark' }, 500)
  }
})

export default app
