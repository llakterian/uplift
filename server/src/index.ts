import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { getSecurityHeaders, isValidHttpUrl } from './services/security'
import { checkRateLimitKV } from './middleware/rateLimit'
import type { Env } from './types'

// Import routes
import feedRoutes from './routes/feed'
import authRoutes from './routes/auth'
import bookmarkRoutes from './routes/bookmarks'
import circleRoutes from './routes/circle'
import xauthRoutes from './routes/xauth'
import telegramRoutes from './routes/telegram'

// Import cron scheduled function
export { scheduled } from './cron'

const app = new Hono<{ Bindings: Env }>()

app.use('*', async (c, next) => {
  const headers = getSecurityHeaders() as Record<string, string>
  for (const [key, value] of Object.entries(headers)) {
    c.header(key, value)
  }
  await next()
})

app.use('/api/*', cors({
  origin: (origin) => {
    const allowed = ['http://localhost:5173', 'https://uplift.llakterian.workers.dev', 'http://127.0.0.1:5173']
    if (origin && allowed.includes(origin)) return origin
    return allowed[0]
  },
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization', 'X-User-Id'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}))

app.use('/api/*', async (c, next) => {
  const ip = c.req.header('cf-connecting-ip') || 'unknown'
  const isAllowed = await checkRateLimitKV(c.env.UPLIFT_CACHE, ip, 60, 60) // 60 requests per minute
  if (!isAllowed) return c.json({ error: 'Too many requests' }, 429)
  await next()
})

// Image proxy endpoint (kept here as it's small and utility-focused)
app.get('/api/image-proxy', async (c) => {
  const url = c.req.query('url')
  const width = parseInt(c.req.query('w') || '400')
  if (!url || !isValidHttpUrl(url)) return c.json({ error: 'Invalid image URL' }, 400)
  if (width < 10 || width > 1200) return c.json({ error: 'Width must be between 10 and 1200' }, 400)
  
  const cacheKey = `img:${width}:${url}`
  try {
    const cached = await c.env.UPLIFT_CACHE?.get(cacheKey, 'arrayBuffer')
    if (cached) return new Response(cached, { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=86400', 'X-Cache': 'HIT' } })
  } catch (e) { console.error('Cache read error for image:', e) }
  
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const response = await fetch(url, { headers: { 'User-Agent': 'Uplift/1.0' }, signal: controller.signal })
    clearTimeout(timeout)
    
    if (!response.ok) return c.json({ error: 'Failed to fetch image' }, 502)
    const contentType = response.headers.get('Content-Type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) return c.json({ error: 'URL is not an image' }, 400)
    
    const imageBuffer = await response.arrayBuffer()
    try { await c.env.UPLIFT_CACHE?.put(cacheKey, imageBuffer, { expirationTtl: 86400 }) } catch (e) { }
    
    return new Response(imageBuffer, { headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400', 'X-Cache': 'MISS' } })
  } catch (error) {
    return c.json({ error: 'Failed to proxy image' }, 502)
  }
})

// Static categories endpoint
app.get('/api/categories', (c) => {
  return c.json({
    success: true,
    categories: [
      { id: 'science', label: 'Science', icon: 'microscope' },
      { id: 'health', label: 'Health', icon: 'heart-pulse' },
      { id: 'animals', label: 'Animals', icon: 'paw-print' },
      { id: 'community', label: 'Community', icon: 'users' },
      { id: 'inspiration', label: 'Inspiration', icon: 'sparkles' },
      { id: 'tech', label: 'Technology', icon: 'cpu' },
      { id: 'environment', label: 'Environment', icon: 'leaf' },
      { id: 'culture', label: 'Culture', icon: 'palette' }
    ]
  })
})

// Mount route modules
app.route('/api/feed', feedRoutes)
app.route('/api/auth', authRoutes)
app.route('/api/bookmarks', bookmarkRoutes)
app.route('/api/circle', circleRoutes)
app.route('/api/auth', xauthRoutes)
app.route('/telegram-webhook', telegramRoutes)

// Push subscription
app.post('/api/push/subscribe', async (c) => {
  const userId = c.req.header('X-User-Id')
  if (!userId) return c.json({ error: 'User ID required' }, 401)
  const subscription = await c.req.json()
  if (!subscription || !subscription.endpoint) return c.json({ error: 'Invalid subscription' }, 400)
  if (!c.env.DB) return c.json({ success: true, note: 'Push notifications not configured' })
  
  try {
    await c.env.DB.prepare("INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)")
      .bind(userId, subscription.endpoint, subscription.keys?.p256dh || '', subscription.keys?.auth || '').run()
    return c.json({ success: true })
  } catch (error) { return c.json({ error: 'Failed to subscribe' }, 500) }
})

app.get('/api/push/vapid-public-key', (c) => {
  if (c.env.VAPID_PUBLIC_KEY) return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY })
  return c.json({ error: 'VAPID not configured' }, 500)
})

// Serve static assets
app.get('*', async (c) => {
  const assets = c.env.ASSETS
  if (!assets) return c.json({ error: 'Static assets not configured' }, 500)
  
  const url = new URL(c.req.url)
  let path = url.pathname
  if (path === '/' || path === '') path = '/index.html'
  
  const assetUrl = new URL(path, url.origin)
  const response = await assets.fetch(assetUrl.toString())
  
  if (response.status === 404) {
    const indexUrl = new URL('/index.html', url.origin)
    return assets.fetch(indexUrl.toString())
  }
  return response
})

export default app
