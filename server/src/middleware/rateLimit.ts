import type { KVNamespace } from '@cloudflare/workers-types'

/**
 * Distributed sliding-window rate limiter backed by KV.
 *
 * KV is eventually consistent, so this is a soft limit: it reliably throttles
 * casual abuse but cannot be relied on as a hard security boundary. Use it to
 * blunt brute-force and scraping, not to authorise access.
 */
export async function checkRateLimitKV(
  kv: KVNamespace | undefined,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  // Fail open when KV is unavailable so a KV outage cannot take the API down.
  if (!kv) return true

  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - windowSeconds
  const recordKey = `ratelimit:${key}`

  try {
    const record = await kv.get(recordKey)
    let requests: number[] = []

    if (record) {
      const parsed = JSON.parse(record)
      if (Array.isArray(parsed)) {
        requests = parsed.filter((ts: unknown): ts is number =>
          typeof ts === 'number' && ts > windowStart
        )
      }
    }

    if (requests.length >= limit) {
      return false
    }

    requests.push(now)
    // Keep the array bounded even if the window is long.
    const trimmed = requests.slice(-Math.max(limit, 1))
    await kv.put(recordKey, JSON.stringify(trimmed), { expirationTtl: windowSeconds })
    return true
  } catch (e) {
    console.error('Rate limit check error:', e)
    return true // Fail open to prevent lockouts
  }
}

/**
 * Express the remaining allowance for a key as response headers.
 * Safe to call after `checkRateLimitKV`.
 */
export async function rateLimitHeaders(
  kv: KVNamespace | undefined,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<Record<string, string>> {
  if (!kv) return {}
  try {
    const record = await kv.get(`ratelimit:${key}`)
    const now = Math.floor(Date.now() / 1000)
    const windowStart = now - windowSeconds
    const requests = record ? (JSON.parse(record) as number[]).filter(ts => ts > windowStart) : []
    const remaining = Math.max(0, limit - requests.length)
    const reset = windowStart + windowSeconds
    return {
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(reset)
    }
  } catch {
    return {}
  }
}
