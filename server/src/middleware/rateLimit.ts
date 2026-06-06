import type { KVNamespace } from '@cloudflare/workers-types'

export async function checkRateLimitKV(kv: KVNamespace | undefined, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!kv) return true // Allow if KV not configured
  
  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - windowSeconds
  const recordKey = `ratelimit:${key}`
  
  try {
    const record = await kv.get(recordKey)
    let requests: number[] = []
    
    if (record) {
      requests = JSON.parse(record).filter((ts: number) => ts > windowStart)
    }
    
    if (requests.length >= limit) {
      return false
    }
    
    requests.push(now)
    await kv.put(recordKey, JSON.stringify(requests), { expirationTtl: windowSeconds })
    return true
  } catch (e) {
    console.error('Rate limit check error:', e)
    return true // Allow on error to prevent lockouts
  }
}
