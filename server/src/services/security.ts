export function sanitizeHtml(text: string, maxLength: number = 1000): string {
  if (!text || typeof text !== 'string') return ''
  
  // Remove all HTML tags first, keeping text content
  let sanitized = text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gim, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gim, '')
    .replace(/<(object|embed)\b[^>]*>[\s\S]*?<\/\1>/gim, '')
    .replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1') // Extract text from ahref links
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/data:(?!(image\/[a-z]+);base64)/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  
  // Truncate long content to prevent DoS
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...'
  }
  
  return sanitized
}

export function isValidSubreddit(name: string): boolean {
  return /^[a-zA-Z0-9_]{1,21}$/.test(name)
}

export function isValidHttpUrl(url: string, allowedDomains?: string[]): boolean {
  try {
    const parsed = new URL(url)
    
    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false
    }
    
    // Prevent access to private networks
    const hostname = parsed.hostname.toLowerCase()
    const privatePatterns = [
      /^localhost$/,
      /^127\.\d+\.\d+\.\d+$/,
      /^10\.\d+\.\d+\.\d+$/,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/,
      /^192\.168\.\d+\.\d+$/,
      /^0x[0-9a-f]+$/,
      /^\[::1\]$/
    ]
    
    for (const pattern of privatePatterns) {
      if (pattern.test(hostname)) {
        return false
      }
    }
    
    // Check domain allowlist if provided
    if (allowedDomains && allowedDomains.length > 0) {
      const domainAllowed = allowedDomains.some(allowed => 
        hostname === allowed || hostname.endsWith('.' + allowed)
      )
      if (!domainAllowed) return false
    }
    
    return true
  } catch {
    return false
  }
}

export function isValidApiKey(key: string, provider: 'groq' = 'groq'): boolean {
  if (!key || typeof key !== 'string') return false
  
  switch (provider) {
    case 'groq':
      return /^gsk_[a-zA-Z0-9]{52}$/.test(key)
    default:
      return key.length >= 20 && key.length <= 200
  }
}

export function getSecurityHeaders(): HeadersInit {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-visible=(), execution-while-out-of-viewport=(), fullscreen=(self), geolocation=(), gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), midi=(), navigation-override=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-DNS-Prefetch-Control': 'on',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' data: https: blob:",
      "connect-src 'self' https://api.groq.com https://www.reddit.com https://*.reddit.com https://oauth.reddit.com https://old.reddit.com https://www.google.com wss://",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests"
    ].join('; ')
  }
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'uplift-salt')
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}
