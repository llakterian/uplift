import { Hono } from 'hono'
import type { Env } from '../types'
import { sendTelegramMessage } from '../services/telegram'

const app = new Hono<{ Bindings: Env }>()

app.post('/webhook', async (c) => {
  const update = await c.req.json()
  if (!update.message || !update.message.text) return c.json({ ok: true })
  
  const chatId = update.message.chat.id
  const text = update.message.text
  
  if (text.startsWith('/start') || text.startsWith('/subscribe')) {
    if (c.env.DB) {
      try {
        await c.env.DB.prepare(
          "INSERT OR REPLACE INTO circle_subscriptions (subscriber_id, channels) VALUES (?, ?)"
        ).bind(chatId.toString(), '["telegram"]').run()
        
        await sendTelegramMessage(chatId, "Welcome to the Uplift Verified Creators Circle! You will now receive notifications when high-positivity content is posted by circle members. Send /unsubscribe to stop.", c.env.TG_BOT_TOKEN)
      } catch (e) {
        console.error(e)
      }
    }
  } else if (text.startsWith('/unsubscribe')) {
    if (c.env.DB) {
      await c.env.DB.prepare("DELETE FROM circle_subscriptions WHERE subscriber_id = ?").bind(chatId.toString()).run()
      await sendTelegramMessage(chatId, "You have been unsubscribed from Circle notifications.", c.env.TG_BOT_TOKEN)
    }
  }
  
  return c.json({ ok: true })
})

export default app
