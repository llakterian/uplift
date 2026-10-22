import type { Env } from '../types'

/** Escape text for Telegram's `parse_mode: 'HTML'`. */
export function escapeTelegramHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function sendTelegramMessage(chatId: string | number, text: string, botToken?: string) {
  if (!botToken) return false;

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    })
    if (!res.ok) {
      console.error('Telegram send failed:', res.status, await res.text().catch(() => ''))
    }
    return res.ok
  } catch (e) {
    console.error("Telegram send error", e)
    return false
  }
}

/** Delay between broadcast sends to stay within Telegram's rate limits. */
const BROADCAST_DELAY_MS = 100

export async function broadcastCirclePost(post: any, env: Env) {
  if (!env.DB) return;

  try {
    const subs = await env.DB.prepare(
      "SELECT DISTINCT subscriber_id FROM circle_subscriptions WHERE channels LIKE '%telegram%'"
    ).all();

    const handle = escapeTelegramHtml(post?.creator?.x_handle || 'unknown')
    const content = escapeTelegramHtml(post?.content || '')
    const message = `🌟 <b>New Positive Post by @${handle}</b>\n\n${content}\n\nAmplify here: https://uplift.llakterian.workers.dev/circle`

    for (const sub of subs.results) {
      await sendTelegramMessage(sub.subscriber_id as string, message, env.TG_BOT_TOKEN)
      await new Promise(resolve => setTimeout(resolve, BROADCAST_DELAY_MS))
    }
  } catch (e) {
    console.error("Broadcast error", e)
  }
}
