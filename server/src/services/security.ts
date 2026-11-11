/**
 * Security primitives for the Uplift Worker.
 *
 * Covers three areas:
 *  1. HTML sanitisation for untrusted upstream content (RSS/Reddit/social).
 *  2. Password hashing/verification (PBKDF2-SHA256, per-user salt).
 *  3. SSRF-safe URL validation for the image proxy.
 *  4. Response security headers (CSP, HSTS, ...).
 */

// ---------------------------------------------------------------------------
// HTML sanitisation
// ---------------------------------------------------------------------------

/**
 * Strip markup and dangerous protocols from untrusted text.
 *
 * This is a defence-in-depth layer only. React escapes interpolated text by
 * default, so callers must never pipe the result into `dangerouslySetInnerHTML`.
 */
export function sanitizeHtml(text: string, maxLength: number = 1000): string {
  if (!text || typeof text !== 'string') return ''

  let sanitized = text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gim, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gim, '')
    .replace(/<(object|embed)\b[^>]*>[\s\S]*?<\/\1>/gim, '')
    .replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1') // Extract text from a href links
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

  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...'
  }

  return sanitized
}

// ---------------------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------------------

/**
 * Cloudflare Workers caps PBKDF2 at 100k iterations, so that is our ceiling.
 * https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
 */
const PBKDF2_ITERATIONS = 100_000
const PBKDF2_KEY_BITS = 256
const PBKDF2_SALT_BYTES = 16

/** Salt used by the pre-2026 SHA-256 implementation, kept only to verify old hashes. */
const LEGACY_SALT = 'uplift-salt'

const textEncoder = new TextEncoder()

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Parse a lowercase hex string into bytes. */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase()
  if (!clean || clean.length % 2 !== 0 || !/^[0-9a-f]+$/.test(clean)) {
    return new Uint8Array(0)
  }
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16)
  }
  return bytes
}

/** Derive PBKDF2-SHA256 bits for a password. */
async function pbkdf2(password: string, salt: Uint8Array, iterations: number, bits: number = PBKDF2_KEY_BITS): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    key,
    bits
  )
  return new Uint8Array(derived)
}

/** Length-independent, content constant-time comparison. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/** Legacy SHA-256(password + static salt) digest, as lowercase hex. */
async function legacyHash(password: string): Promise<string> {
  const data = textEncoder.encode(password + LEGACY_SALT)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return toHex(new Uint8Array(hash))
}

/**
 * Hash a password with PBKDF2-SHA256 and a fresh per-user random salt.
 * Stored format: `pbkdf2$<iterations>$<saltBase64>$<hashBase64>`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES))
  const bits = await pbkdf2(password, salt, PBKDF2_ITERATIONS)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(bits)}`
}

/**
 * Verify a password against a stored hash.
 *
 * Supports legacy SHA-256 hashes so existing accounts keep working; the
 * caller should re-hash with `hashPassword` when `needsRehash` is true.
 */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!password || !stored || typeof stored !== 'string') {
    return { valid: false, needsRehash: false }
  }

  const parts = stored.split('$')
  if (parts[0] === 'pbkdf2' && parts.length === 4) {
    const iterations = parseInt(parts[1], 10)
    if (!Number.isFinite(iterations) || iterations < 1) {
      return { valid: false, needsRehash: false }
    }
    try {
      const salt = fromBase64(parts[2])
      const expected = fromBase64(parts[3])
      const actual = await pbkdf2(password, salt, iterations, expected.length * 8)
      if (!timingSafeEqual(actual, expected)) return { valid: false, needsRehash: false }
      return { valid: true, needsRehash: iterations < PBKDF2_ITERATIONS }
    } catch {
      return { valid: false, needsRehash: false }
    }
  }

  // Legacy format: bare SHA-256 hex digest.
  try {
    const legacy = await legacyHash(password)
    if (!timingSafeEqual(hexToBytes(legacy), hexToBytes(stored))) {
      return { valid: false, needsRehash: false }
    }
    return { valid: true, needsRehash: true }
  } catch {
    return { valid: false, needsRehash: false }
  }
}

// ---------------------------------------------------------------------------
// SSRF protection
// ---------------------------------------------------------------------------

/** Hostnames that must never be proxied. */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata',
  'metadata.google.internal',
  'instance-data',
  'instance-data.ec2.internal',
  '169.254.169.254',
])

/** Internal / mDNS TLDs that can resolve to private addresses. */
const BLOCKED_TLDS = ['.local', '.internal', '.home.arpa', '.lan', '.intranet', '.private']

/** True when the address is in a range that is not routable on the public internet. */
export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(p => Number(p))
  if (parts.length !== 4) return false
  if (parts.some(p => !Number.isInteger(p) || p < 0 || p > 255)) return false

  const [a, b] = parts
  if (a === 0) return true                       // 0.0.0.0/8        "this network"
  if (a === 10) return true                      // 10.0.0.0/8       private
  if (a === 127) return true                     // 127.0.0.0/8      loopback
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10  CGNAT
  if (a === 169 && b === 254) return true        // 169.254.0.0/16  link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true  // 172.16.0.0/12 private
  if (a === 192 && b === 0) return true           // 192.0.0.0/24     IETF protocol assignments
  if (a === 192 && b === 168) return true         // 192.168.0.0/16   private
  if (a === 198 && (b === 18 || b === 19)) return true // 198.18.0.0/15 benchmarking
  if (a >= 224) return true                      // 224.0.0.0/4 multicast + reserved
  return false
}

/** True when the IPv6 address is loopback, link-local, unique-local or multicast. */
export function isPrivateIPv6(host: string): boolean {
  let h = host.toLowerCase()
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1)
  if (!h.includes(':')) return false

  // IPv4-mapped IPv6: ::ffff:127.0.0.1 (dotted) or ::ffff:7f00:1 (hex)
  const mappedDotted = h.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (mappedDotted) return isPrivateIPv4(mappedDotted[1])
  if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(h)) {
    // Hextets: high 16 bits = 0x7f00 => 127.x, 0x0a00 => 10.x
    const [, hi, lo] = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)!
    const high = parseInt(hi.padStart(4, '0'), 16)
    const low = parseInt(lo.padStart(4, '0'), 16)
    const ipv4 = `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`
    return isPrivateIPv4(ipv4)
  }

  if (h === '::' || h === '::1') return true

  const firstGroup = h.split(':')[0]
  const g = parseInt(firstGroup, 16)
  if (Number.isNaN(g)) return false
  if ((g & 0xfe00) === 0xfc00) return true  // fc00::/7  unique local
  if ((g & 0xffc0) === 0xfe80) return true  // fe80::/10  link-local
  if ((g & 0xff00) === 0xff00) return true  // ff00::/8   multicast
  return false
}

/**
 * True when a hostname points at loopback, private, link-local or otherwise
 * internal infrastructure.
 */
export function isPrivateHostname(hostname: string): boolean {
  if (!hostname) return true
  let host = hostname.toLowerCase().trim()
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1)

  if (BLOCKED_HOSTNAMES.has(host)) return true
  if (BLOCKED_TLDS.some(tld => host.endsWith(tld))) return true

  // IPv4 literal (the WHATWG URL parser already normalises decimal/octal/hex forms).
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return isPrivateIPv4(host)

  // IPv6 literal.
  if (host.includes(':')) return isPrivateIPv6(host)

  // Single-label names (e.g. "intranet") resolve via search domains -> internal.
  if (!host.includes('.')) return true

  return false
}

/**
 * Validate an outbound URL before fetching it.
 *
 * Blocks non-HTTP(S) schemes, credentials in the URL, and any host that
 * resolves to private/internal infrastructure.
 *
 * @param allowedDomains optional allowlist; when provided the host must match.
 */
export function isValidHttpUrl(url: string, allowedDomains?: string[]): boolean {
  try {
    const parsed = new URL(url)

    if (!['http:', 'https:'].includes(parsed.protocol)) return false

    // Embedded credentials (http://user:pass@host) can be used to confuse parsers.
    if (parsed.username || parsed.password) return false

    const hostname = parsed.hostname.toLowerCase()
    if (isPrivateHostname(hostname)) return false

    if (allowedDomains && allowedDomains.length > 0) {
      const domainAllowed = allowedDomains.some(allowed => {
        const normalized = allowed.toLowerCase().replace(/^\./, '')
        return hostname === normalized || hostname.endsWith('.' + normalized)
      })
      if (!domainAllowed) return false
    }

    return true
  } catch {
    return false
  }
}

export function isValidSubreddit(name: string): boolean {
  return /^[a-zA-Z0-9_]{1,21}$/.test(name)
}

// ---------------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------------

export function isValidApiKey(key: string, provider: 'groq' = 'groq'): boolean {
  if (!key || typeof key !== 'string') return false

  switch (provider) {
    case 'groq':
      return /^gsk_[a-zA-Z0-9]{52}$/.test(key)
    default:
      return key.length >= 20 && key.length <= 200
  }
}

// ---------------------------------------------------------------------------
// Response headers
// ---------------------------------------------------------------------------

/**
 * Security headers applied to every response.
 *
 * Notes:
 *  - `script-src` is strict (`'self'` only). The built bundle has no inline
 *    scripts, so `unsafe-inline`/`unsafe-eval` are unnecessary.
 *  - `style-src` keeps `unsafe-inline` because the app sets React inline
 *    `style` attributes and Tailwind utilities rely on it.
 *  - COEP is deliberately omitted: `require-corp` would block the third-party
 *    feed images (Reddit/Dev.to/Mastodon CDNs) that do not send CORP headers.
 */
export function getSecurityHeaders(): HeadersInit {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'accelerometer=(), autoplay=(), camera=(), cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-visible=(), execution-while-out-of-viewport=(), fullscreen=(self), geolocation=(), gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), midi=(), navigation-override=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-DNS-Prefetch-Control': 'on',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' data: https: blob:",
      "connect-src 'self' https://api.groq.com https://www.reddit.com https://*.reddit.com https://oauth.reddit.com https://old.reddit.com",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests"
    ].join('; ')
  }
}
