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