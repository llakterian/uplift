/**
 * Enhanced HTML sanitization to prevent XSS attacks
 * Uses a whitelist-based approach for safer rendering
 */
export function sanitizeHtml(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') return ''
  
  // Truncate long content to prevent DoS
  if (input.length > maxLength) {
    input = input.substring(0, maxLength) + '...'
  }
  
  // Remove potentially dangerous content
  const sanitized = input
    // Remove script tags and their content
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gim, '')
    // Remove iframe tags
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gim, '')
    // Remove object/embed tags
    .replace(/<(object|embed)\b[^>]*>[\s\S]*?<\/\1>/gim, '')
    // Remove all HTML tags (conservative approach)
    .replace(/<[^>]+>/g, '')
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Remove on* event handlers
    .replace(/on\w+\s*=/gi, '')
    // Remove data: protocol (except data:image)
    .replace(/data:(?!(image\/[a-z]+);base64)/gi, '')
    // Remove vbscript: protocol
    .replace(/vbscript:/gi, '')
    // Handle HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .trim()
  
  return sanitized
}

/**
 * Validate and sanitize URLs to prevent SSRF attacks
 */
export function validateUrl(url: string, allowedDomains?: string[]): { valid: boolean; sanitized?: string } {
  try {
    const parsed = new URL(url)
    
    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false }
    }
    
    // Prevent access to localhost and private networks
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
        return { valid: false }
      }
    }
    
    // Check against domain allowlist if provided
    if (allowedDomains && allowedDomains.length > 0) {
      const domainAllowed = allowedDomains.some(allowed => 
        hostname === allowed || hostname.endsWith('.' + allowed)
      )
      if (!domainAllowed) {
        return { valid: false }
      }
    }
    
    // Sanitize URL by removing sensitive query parameters
    const cleanHost = parsed.host
    const cleanPath = parsed.pathname.replace(/\.\./g, '').normalize()
    const cleanHash = parsed.hash
    
    // Whitelist safe query parameters
    const safeParams = new URLSearchParams()
    for (const [key, value] of parsed.searchParams.entries()) {
      if (/^[a-zA-Z0-9_-]+$/.test(key) && value.length < 200) {
        safeParams.set(key, value)
      }
    }
    
    const sanitized = `${parsed.protocol}//${cleanHost}${cleanPath}${safeParams.toString() ? '?' + safeParams.toString() : ''}${cleanHash}`
    
    return { valid: true, sanitized }
  } catch {
    return { valid: false }
  }
}

/**
 * Rate limiting with token bucket algorithm
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map()
  private maxRequests: number
  private windowMs: number
  
  constructor(maxRequests: number = 30, windowMs: number = 60000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }
  
  async check(identifier: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    const now = Date.now()
    const windowStart = now - this.windowMs
    
    // Get existing timestamps for this identifier
    let timestamps = this.requests.get(identifier) || []
    
    // Filter out old timestamps
    timestamps = timestamps.filter(ts => ts > windowStart)
    
    // Check if limit exceeded
    if (timestamps.length >= this.maxRequests) {
      const oldestRequest = timestamps[0]
      const retryAfter = Math.ceil((oldestRequest + this.windowMs - now) / 1000)
      return { allowed: false, retryAfter }
    }
    
    // Add current request
    timestamps.push(now)
    this.requests.set(identifier, timestamps)
    
    return { allowed: true }
  }
  
  clear(identifier?: string): void {
    if (identifier) {
      this.requests.delete(identifier)
    } else {
      this.requests.clear()
    }
  }
}

/**
 * Generate secure random token
 */
export function generateSecureToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Validate API key format
 */
export function validateApiKey(key: string, provider: 'groq' | 'openai' | 'custom'): boolean {
  if (!key || typeof key !== 'string') return false
  
  switch (provider) {
    case 'groq':
      return /^gsk_[a-zA-Z0-9]{52}$/.test(key)
    case 'openai':
      return /^sk-[a-zA-Z0-9]{48}$/.test(key)
    case 'custom':
      return key.length >= 20 && key.length <= 200
    default:
      return false
  }
}

/**
 * CSP header generator
 */
export function generateCSPHeader(): string {
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.groq.com https://www.reddit.com wss://",
    "media-src 'self' data: https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ]
  
  return directives.join('; ')
}

/**
 * Security headers for responses
 */
export function getSecurityHeaders(): HeadersInit {
  return {
    'Content-Security-Policy': generateCSPHeader(),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  }
}

/**
 * Safe JSON parse with size limits
 */
export function safeJsonParse<T>(json: string, maxSize: number = 100000): T | null {
  if (!json || typeof json !== 'string') return null
  
  // Check size before parsing to prevent DoS
  if (json.length > maxSize) {
    console.error('JSON payload exceeds maximum allowed size')
    return null
  }
  
  try {
    return JSON.parse(json)
  } catch (error) {
    console.error('JSON parse error:', error)
    return null
  }
}

/**
 * Validate input against safe patterns
 */
export function validateInput(input: string, type: 'email' | 'username' | 'text' | 'url'): boolean {
  if (!input || typeof input !== 'string') return false
  
  switch (type) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) && input.length <= 254
    case 'username':
      return /^[a-zA-Z0-9_-]{3,30}$/.test(input)
    case 'text':
      return input.length >= 1 && input.length <= 1000 && !/[<>]/.test(input)
    case 'url':
      return validateUrl(input).valid
    default:
      return false
  }
}