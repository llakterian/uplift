import { Hono } from 'hono'
import type { Env } from '../types'
import { sanitizeHtml } from '../services/security'

const app = new Hono<{ Bindings: Env }>()

app.post('/join', async (c) => {
  if (!c.env.DB) return c.json({ error: 'Database not configured' }, 500)

  const { x_handle, name, bio, categories } = await c.req.json()

  if (!x_handle) return c.json({ error: 'X Handle is required' }, 400)

  try {
    const handle = x_handle.startsWith('@') ? x_handle.substring(1) : x_handle;

    // Insert as verified=false until admin approves
    const result = await c.env.DB.prepare(
      "INSERT INTO creators (x_handle, name, bio, categories, is_verified, reciprocity_score) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(
      sanitizeHtml(handle, 50),
      sanitizeHtml(name || '', 100),
      sanitizeHtml(bio || '', 500),
      JSON.stringify(categories || []),
      0, // not verified initially
      0
    ).run()

    // Send email notification to admin
    try {
      const emailSubject = encodeURIComponent(`New Creators Circle Application: @${handle} - ${name}`)
      const emailBody = encodeURIComponent(
        `New Creators Circle Application\n\n` +
        `X Handle: @${handle}\n` +
        `Name: ${name}\n` +
        `Bio: ${bio || 'No bio provided'}\n` +
        `Categories: ${categories?.join(', ') || 'None'}\n\n` +
        `Please review and approve this application in the admin panel.`
      )
      const mailtoUrl = `mailto:llakterian@gmail.com?subject=${emailSubject}&body=${emailBody}`

      // In a real implementation, you would use an email service like SendGrid
      // For now, we'll log the email details and return the mailto link
      console.log('Email notification would be sent to: llakterian@gmail.com')
      console.log('Subject:', `New Creators Circle Application: @${handle} - ${name}`)
      console.log('Body:', emailBody)
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError)
      // Continue anyway since the application was submitted
    }

    return c.json({ success: true, message: 'Join request submitted' })
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) return c.json({ error: 'Handle already requested' }, 400)
    console.error(error)
    return c.json({ error: 'Submission failed' }, 500)
  }
})

app.get('/directory', async (c) => {
  if (!c.env.DB) return c.json({ creators: [] })
  
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100)
    const offset = (page - 1) * limit
    
    const creators = await c.env.DB.prepare(
      "SELECT id, x_handle, name, bio, avatar_url, categories, is_verified, reciprocity_score FROM creators WHERE is_verified = 1 ORDER BY reciprocity_score DESC LIMIT ? OFFSET ?"
    ).bind(limit, offset).all()
    
    return c.json({ success: true, creators: creators.results.map((c: any) => ({ ...c, categories: JSON.parse(c.categories || '[]') })) })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Failed to fetch directory' }, 500)
  }
})

app.get('/feed', async (c) => {
  if (!c.env.DB) return c.json({ posts: [] })
  
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100)
    const offset = (page - 1) * limit
    
    const postsQuery = await c.env.DB.prepare(`
      SELECT p.*, c.x_handle, c.name, c.avatar_url 
      FROM circle_posts p 
      JOIN creators c ON p.creator_id = c.id 
      ORDER BY p.posted_at DESC 
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all()
    
    return c.json({ 
      success: true, 
      posts: postsQuery.results.map((p: any) => ({
        ...p,
        media_urls: JSON.parse(p.media_urls || '[]'),
        amplified_by: JSON.parse(p.amplified_by || '[]'),
        creator: { x_handle: p.x_handle, name: p.name, avatar_url: p.avatar_url }
      })) 
    })
  } catch (error) {
    console.error(error)
    return c.json({ error: 'Failed to fetch feed' }, 500)
  }
})

app.post('/amplify', async (c) => {
  if (!c.env.DB) return c.json({ error: 'DB not configured' }, 500)
  
  const { post_id, amplifier_handle } = await c.req.json()
  if (!post_id || !amplifier_handle) return c.json({ error: 'Missing params' }, 400)
  
  try {
    await c.env.DB.prepare(
      "INSERT INTO amplifications (circle_post_id, amplifier_handle) VALUES (?, ?)"
    ).bind(post_id, sanitizeHtml(amplifier_handle)).run()
    
    // Also update post's amplified_by array (simplified for now)
    return c.json({ success: true })
  } catch(e) {
    return c.json({ error: 'Failed to amplify' }, 500)
  }
})

app.get('/leaderboard', async (c) => {
  if (!c.env.DB) return c.json({ leaderboard: [] })
  try {
    const creators = await c.env.DB.prepare(
      "SELECT id, x_handle, name, avatar_url, reciprocity_score FROM creators WHERE is_verified = 1 ORDER BY reciprocity_score DESC LIMIT 10"
    ).all()
    return c.json({ success: true, leaderboard: creators.results })
  } catch (error) {
    return c.json({ error: 'Failed to fetch leaderboard' }, 500)
  }
})

export default app
