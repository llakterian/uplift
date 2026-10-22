import { Hono } from 'hono'
import type { Env } from '../types'
import { sendTelegramMessage } from '../services/telegram'

const app = new Hono<{ Bindings: Env }>()

/**
 * Telegram webhook authentication.
 *
 * Telegram sends the value configured via `setWebhook(secret_token=...)` in the
 * `X-Telegram-Bot-Api-Secret-Token` header. Without this check anybody could
 * POST to the webhook and subscribe or unsubscribe arbitrary chat ids.
 *
 * Fails closed: if no secret is configured the webhook refuses all traffic.
 */
function isAuthorized(c: { req: { header: (k: string) => string | undefined } }, env: Env): boolean {
  const expected = env.TG_WEBHOOK_SECRET
  if (!expected) return false
  const provided = c.req.header('x-telegram-bot-api-secret-token')
  if (!provided || provided.length !== expected.length) return false
  // Constant-time-ish comparison.
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i)
  return diff === 0
}

app.post('/webhook', async (c) => {
  if (!c.env.TG_WEBHOOK_SECRET) {
    console.error('TG_WEBHOOK_SECRET is not configured — refusing Telegram webhook traffic')
    return c.json({ error: 'Webhook not configured' }, 503)
  }

  if (!isAuthorized(c, c.env)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  let update: any
  try {
    update = await c.req.json()
  } catch {
    return c.json({ ok: true })
  }

  const message = update?.message
  if (!message || typeof message.text !== 'string') return c.json({ ok: true })

  const chatId = message.chat?.id
  if (chatId === undefined || chatId === null) return c.json({ ok: true })

  const text: string = message.text
  const command = text.trim().split(/\s+/)[0]?.toLowerCase()

  if (command === '/start' || command === '/subscribe') {
    if (c.env.DB) {
      try {
        // Replace rather than append: the table has no unique constraint on
        // subscriber_id, so a plain INSERT would duplicate subscriptions.
        await c.env.DB.prepare(
          "DELETE FROM circle_subscriptions WHERE subscriber_id = ?"
        ).bind(chatId.toString()).run()

        await c.env.DB.prepare(
          "INSERT INTO circle_subscriptions (subscriber_id, channels) VALUES (?, ?)"
        ).bind(chatId.toString(), '["telegram"]').run()

        await sendTelegramMessage(
          chatId,
          "Welcome to the Uplift Verified Creators Circle! You will now receive notifications when high-positivity content is posted by circle members. Send /unsubscribe to stop.",
          c.env.TG_BOT_TOKEN
        )
      } catch (e) {
        console.error('Telegram subscribe failed:', e)
      }
    }
  } else if (command === '/unsubscribe') {
    if (c.env.DB) {
      try {
        await c.env.DB.prepare("DELETE FROM circle_subscriptions WHERE subscriber_id = ?")
          .bind(chatId.toString()).run()
        await sendTelegramMessage(chatId, "You have been unsubscribed from Circle notifications.", c.env.TG_BOT_TOKEN)
      } catch (e) {
        console.error('Telegram unsubscribe failed:', e)
      }
    }
  }

  return c.json({ ok: true })
})

export default app
