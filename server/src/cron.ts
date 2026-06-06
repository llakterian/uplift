import type { Env } from './types'
import { syncCirclePosts, updateReciprocityScores } from './services/circle'

export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  // Run every 15 minutes to fetch X lists and sync posts
  ctx.waitUntil(syncCirclePosts(env))
  
  // If it's a weekly cron trigger, update reciprocity
  if (event.cron === "0 0 * * 0") { // Every Sunday midnight
    ctx.waitUntil(updateReciprocityScores(env))
  }
}
