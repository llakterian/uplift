import { Hono } from 'hono'

import { getSecurityHeaders, isValidHttpUrl } from './services/security'
import { allowedOrigins, isAllowedOrigin } from './config'
import { checkRateLimitKV } from './middleware/rateLimit'
import { getSessionUser } from './middleware/auth'
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

app.use('/api/*', async (c, next) => {
  const allowed = allowedOrigins(c.env)
  const origin = c.req.header('Origin')
  const isAllowed = isAllowedOrigin(origin, allowed)

  // Only echo back an origin that is explicitly allowlisted. Requests without
  // an Origin header (same-origin, curl, native clients) are allowed through.
  if (origin && isAllowed) {
    c.header('Access-Control-Allow-Origin', origin)
    c.header('Access-Control-Allow-Credentials', 'true')
  }
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  c.header('Access-Control-Max-Age', '86400')
  c.header('Vary', 'Origin')

  if (c.req.method === 'OPTIONS') return c.body(null, 204)

  await next()
})

app.use('/api/*', async (c, next) => {
  const ip = c.req.header('cf-connecting-ip') || 'unknown'
  const isAllowed = await checkRateLimitKV(c.env.UPLIFT_CACHE, ip, 60, 60) // 60 requests per minute
  if (!isAllowed) return c.json({ error: 'Too many requests' }, 429)
  await next()
})

// Stricter limit on the image proxy — it is the most outbound-request heavy route.
app.use('/api/image-proxy', async (c, next) => {
  const ip = c.req.header('cf-connecting-ip') || 'unknown'
  const isAllowed = await checkRateLimitKV(c.env.UPLIFT_CACHE, `img:${ip}`, 30, 60)
  if (!isAllowed) return c.json({ error: 'Too many requests' }, 429)
  await next()
})

// ---------------------------------------------------------------------------
// Image proxy
// ---------------------------------------------------------------------------

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_REDIRECTS = 3
const FETCH_TIMEOUT_MS = 10000

/**
 * Fetch a remote image with SSRF protection.
 *
 * Redirects are followed manually so that every hop is re-validated — a public
 * URL that 302s to 169.254.169.254 must not be able to reach cloud metadata.
 */
async function fetchImageSafely(
  url: string,
  allowedDomains: string[] | undefined
): Promise<{ buffer: ArrayBuffer; contentType: string } | { error: string; status: number }> {
  let currentUrl = url

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isValidHttpUrl(currentUrl, allowedDomains)) {
      return { error: 'Invalid image URL', status: 400 }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(currentUrl, {
        headers: { 'User-Agent': 'Uplift/1.0 (+https://uplift.news)' },
        redirect: 'manual',
        signal: controller.signal
      })
    } catch (error) {
      clearTimeout(timeout)
      return { error: 'Failed to fetch image', status: 502 }
    }
    clearTimeout(timeout)

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location')
      if (!location) return { error: 'Failed to fetch image', status: 502 }
      try {
        currentUrl = new URL(location, currentUrl).toString()
      } catch {
        return { error: 'Invalid redirect target', status: 400 }
      }
      continue
    }

    if (!response.ok) return { error: 'Failed to fetch image', status: 502 }

    const contentType = response.headers.get('Content-Type') || 'image/jpeg'
    if (!contentType.startsWith('image/')) return { error: 'URL is not an image', status: 400 }

    // Reject oversized images before buffering them.
    const declaredLength = parseInt(response.headers.get('Content-Length') || '0', 10)
    if (declaredLength > MAX_IMAGE_BYTES) {
      return { error: 'Image too large', status: 413 }
    }

    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return { error: 'Image too large', status: 413 }
    }

    return { buffer, contentType }
  }

  return { error: 'Too many redirects', status: 502 }
}

app.get('/api/image-proxy', async (c) => {
  const url = c.req.query('url')
  const width = parseInt(c.req.query('w') || '400')

  if (!url || !isValidHttpUrl(url)) return c.json({ error: 'Invalid image URL' }, 400)
  if (!Number.isFinite(width) || width < 10 || width > 1200) {
    return c.json({ error: 'Width must be between 10 and 1200' }, 400)
  }

  // Optional allowlist: IMAGE_PROXY_ALLOWED_DOMAINS=cdn.example.com,a.com
  const allowlist = c.env.IMAGE_PROXY_ALLOWED_DOMAINS?.split(',')
    .map(d => d.trim())
    .filter(Boolean)

  const cacheKey = `img:${width}:${url}`
  const ctKey = `imgct:${width}:${url}`
  try {
    const cached = await c.env.UPLIFT_CACHE?.get(cacheKey, 'arrayBuffer')
    if (cached) {
      const ct = (await c.env.UPLIFT_CACHE?.get(ctKey)) || 'image/jpeg'
      return new Response(cached, {
        headers: {
          'Content-Type': ct,
          'Cache-Control': 'public, max-age=86400',
          'X-Cache': 'HIT'
        }
      })
    }
  } catch (e) {
    console.error('Cache read error for image:', e)
  }

  const result = await fetchImageSafely(url, allowlist)
  if ('error' in result) {
    return c.json({ error: result.error }, result.status as any)
  }

  try {
    await c.env.UPLIFT_CACHE?.put(cacheKey, result.buffer, { expirationTtl: 86400 })
    await c.env.UPLIFT_CACHE?.put(ctKey, result.contentType, { expirationTtl: 86400 })
  } catch (e) {
    console.error('Cache write error for image:', e)
  }

  return new Response(result.buffer, {
    headers: {
      'Content-Type': result.contentType,
      'Cache-Control': 'public, max-age=86400',
      'X-Cache': 'MISS'
    }
  })
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
app.route('/api/auth/x', xauthRoutes)
app.route('/telegram-webhook', telegramRoutes)

// Push subscription
app.post('/api/push/subscribe', async (c) => {
  const user = await getSessionUser(c)
  if (!user) return c.json({ error: 'Authentication required' }, 401)
  if (!c.env.DB) return c.json({ success: true, note: 'Push notifications not configured' })

  let subscription: any
  try {
    subscription = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  if (!subscription || typeof subscription.endpoint !== 'string' || !subscription.endpoint) {
    return c.json({ error: 'Invalid subscription' }, 400)
  }
  if (!isValidHttpUrl(subscription.endpoint)) {
    return c.json({ error: 'Invalid subscription endpoint' }, 400)
  }

  try {
    await c.env.DB.prepare(
      "INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)"
    ).bind(
      user.id,
      subscription.endpoint,
      subscription.keys?.p256dh || '',
      subscription.keys?.auth || ''
    ).run()
    return c.json({ success: true })
  } catch (error) {
    console.error('Failed to store push subscription:', error)
    return c.json({ error: 'Failed to subscribe' }, 500)
  }
})

app.get('/api/push/vapid-public-key', (c) => {
  if (c.env.VAPID_PUBLIC_KEY) return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY })
  return c.json({ error: 'VAPID not configured' }, 500)
})

/**
 * Apply the security headers to a response that is returned directly.
 *
 * Hono merges `c.header()` values into responses created with `c.json()`, but
 * NOT into a raw `Response` returned by a handler — which is what the asset
 * fetcher below produces. Without this, the HTML shell (and therefore the
 * whole app) would be served without a Content-Security-Policy.
 */
function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(getSecurityHeaders() as Record<string, string>)) {
    headers.set(key, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

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
    // SPA fallback — the client uses hash routing, so unknown paths still
    // resolve to the app shell.
    const indexUrl = new URL('/index.html', url.origin)
    return withSecurityHeaders(await assets.fetch(indexUrl.toString()))
  }

  return withSecurityHeaders(response)
})

export default app
