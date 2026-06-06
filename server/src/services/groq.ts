import { isValidApiKey } from './security'
import type { FeedItem } from '../types'

function getSystemPrompt(lang: string = 'en'): string {
  const isSwahili = lang === 'sw'
  return `${isSwahili ? 'Wewe' : 'You are'} Uplift's strict positivity classifier.
${isSwahili ? 'Jibu tu kama halali JSON, usiongeza maandishi yoyote.' : 'Respond ONLY with valid JSON. Never add extra text.'}

Definitions:
- POSITIVE: Inspiring, uplifting, wins, kindness, breakthroughs, cute animals, human goodness.
- NEUTRAL: Pure info, no emotion.
- NEGATIVE: Sad, tragic, anxiety, doom.

Output format (${isSwahili ? 'Kwa Kiswahili' : 'in English'}):
{
  "classification": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
  "confidence": 0.95,
  "reason": "Short ${isSwahili ? 'sentensi' : 'sentence'} explaining why"
}

Classify the content below.`
}

export async function classifyWithGroq(title: string, content: string, lang: string = 'en', apiKey: string): Promise<any> {
  if (!apiKey || !isValidApiKey(apiKey)) {
    return { classification: 'POSITIVE', confidence: 0.7, reason: 'Fallback classification' }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        temperature: 0,
        max_tokens: 200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: getSystemPrompt(lang) },
          { role: 'user', content: JSON.stringify({ title, content: content || '' }) }
        ]
      }),
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return { classification: 'POSITIVE', confidence: 0.7, reason: 'Fallback classification' }
    }

    const data = await response.json() as any
    return JSON.parse(data.choices[0].message.content)
  } catch {
    return { classification: 'POSITIVE', confidence: 0.7, reason: 'Fallback classification' }
  }
}

export async function generateAIDeepDive(title: string, reason: string, lang: string = 'en', apiKey: string): Promise<string> {
  if (!apiKey || !isValidApiKey(apiKey)) {
    return "This story will brighten your day with its positive message!"
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    
    const prompt = `${lang === 'sw' 
      ? `Andika sentensi 3 za furaha ili zitoe sababu kwa nini hadithi hii itakufanya furahi kwa kutumia "Hadithi hii": "${title}". Sababu kutoka kwa classifier: ${reason}. Iongee na utajiri wa moyo!`
      : `Write a warm, fun 3-sentence "Why this story will make your day" explanation in English for this uplifting post: "${title}". Reason from classifier: ${reason}. Make it personal and joyful!`
    }`
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        temperature: 0.7,
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return "This story will brighten your day with its positive message!"
    }

    const data = await response.json() as any
    return data.choices[0].message.content.trim()
  } catch {
    return "This story will brighten your day with its positive message!"
  }
}

export async function generateDailyIntro(lang: string = 'en', topTitles: string[] = [], apiKey: string): Promise<string> {
  if (!apiKey || !isValidApiKey(apiKey)) {
    return lang === 'sw' 
      ? "Leo tuna habari nzuri kutoka dunia nzima! Furahia shangwe za leo."
      : "Here's your daily dose of good news! Get ready for some uplifting stories."
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    
    const prompt = topTitles.length > 0
      ? `${lang === 'sw' ? 'Andika' : 'Write'} a warm, optimistic 2-sentence daily intro ${lang === 'sw' ? 'kwa Kiswahili' : 'in English'} inspired by these uplifting stories: ${topTitles.slice(0, 3).join(', ')}.`
      : `${lang === 'sw' ? 'Andika' : 'Write'} a short, hopeful daily intro paragraph ${lang === 'sw' ? 'kwa Kiswahili' : 'in English'}.`
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        temperature: 0.7,
        max_tokens: 120,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return lang === 'sw' 
        ? "Leo tuna habari nzuri kutoka dunia nzima! Furahia shangwe za leo."
        : "Here's your daily dose of good news!"
    }

    const data = await response.json() as any
    return data.choices[0].message.content.trim()
  } catch {
    return lang === 'sw' 
      ? "Leo tuna habari nzuri kutoka dunia nzima! Furahia shangwe za leo."
      : "Here's your daily dose of good news!"
  }
}

export async function classifyWithAI(items: FeedItem[], apiKey: string): Promise<FeedItem[]> {
  if (!apiKey || !isValidApiKey(apiKey) || items.length === 0) return items

  try {
    const titles = items.map(i => `${i.id}: ${i.title}`).join('\n')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `You are a positivity classifier. For each news title, classify it as:
- POSITIVE (score 8-10): Good news, inspiring, scientific breakthroughs, community wins, happy moments, acts of kindness
- NEUTRAL (score 5-7): Informational, news without strong emotion
- NEGATIVE (score 1-4): Sad, tragic, anxiety-inducing, doom-scrolling content

Return JSON array with scores for each item in format: [{"id": "item-id", "score": 8}]`
          },
          {
            role: 'user',
            content: `Classify these news titles:\n${titles}`
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      }),
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!response.ok) return items

    const data = await response.json() as any
    const content = data.choices?.[0]?.message?.content || ''
    const scoresMatch = content.match(/\[[\s\S]*\]/)
    if (scoresMatch) {
      const scores = JSON.parse(scoresMatch[0])
      const scoreMap = new Map<string, number>(scores.map((s: any) => [s.id, s.score]))
      return items.map(item => {
        const aiScore = scoreMap.get(item.id);
        return {
          ...item,
          positivityScore: typeof aiScore === 'number' ? aiScore : item.positivityScore
        };
      })
    }
    return items
  } catch {
    return items
  }
}

export async function scorePostPositivity(content: string, apiKey: string): Promise<number> {
  if (!apiKey || !isValidApiKey(apiKey)) return 0.5;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "llama3-70b-8192",
        messages: [{
          role: "system",
          content: `You are a positivity curator. Score 0-1 for positivity, progress, unity. Output only JSON: {"score": 0.85}`
        }, {
          role: "user",
          content: content
        }],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) return 0.5;
    const data = await response.json() as any;
    const result = JSON.parse(data.choices[0].message.content!);
    return result.score || 0.5;
  } catch (error) {
    console.error("Error scoring post:", error);
    return 0.5;
  }
}
