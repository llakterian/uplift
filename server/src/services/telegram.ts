import type { Env } from '../types'

export async function sendTelegramMessage(chatId: string, text: string, botToken?: string) {
  if (!botToken) return false;
  
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    })
    return res.ok
  } catch (e) {
    console.error("Telegram send error", e)
    return false
  }
}

export async function broadcastCirclePost(post: any, env: Env) {
  // Fetch subscribers from DB and send notification
  if (!env.DB) return;
  
  try {
    const subs = await env.DB.prepare("SELECT subscriber_id FROM circle_subscriptions WHERE channels LIKE '%telegram%'").all();
    const message = `🌟 <b>New Positive Post by @${post.creator.x_handle}</b>\n\n${post.content}\n\nAmplify here: https://uplift.llakterian.workers.dev/circle`
    
    for (const sub of subs.results) {
      await sendTelegramMessage(sub.subscriber_id as string, message, env.TG_BOT_TOKEN)
    }
  } catch (e) {
    console.error("Broadcast error", e)
  }
}
