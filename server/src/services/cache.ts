import type { KVNamespace } from '@cloudflare/workers-types'
import type { FeedItem } from '../types'

export async function getCachedFeed(kv: KVNamespace | undefined, key: string): Promise<FeedItem[] | null> {
  if (!kv) return null

  try {
    const cached = await kv.get(key)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch (e) {
    console.error('Cache read error:', e)
  }
  return null
}

export async function setCachedFeed(kv: KVNamespace | undefined, key: string, data: FeedItem[]): Promise<void> {
  if (!kv) return

  try {
    await kv.put(key, JSON.stringify(data), { expirationTtl: 600 }) // 10 min cache
  } catch (e) {
    console.error('Cache write error:', e)
  }
}
