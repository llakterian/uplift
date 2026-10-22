/**
 * Client-side session management.
 *
 * The session token is an opaque random value issued by the Worker on
 * login/registration and stored in localStorage. It is sent as a Bearer token
 * on every request that needs to be attributed to a user.
 *
 * Trade-off: localStorage is readable by any script running on the origin, so
 * this depends on the strict Content-Security-Policy (no inline scripts, no
 * unsafe-eval) to limit XSS exposure. The upgrade path is an httpOnly,
 * SameSite cookie plus CSRF tokens — see SECURITY.md.
 */

const TOKEN_KEY = 'uplift_session'

export interface AuthUser {
  id: number | string
  email: string
  streak: number
  level: string
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch { /* storage unavailable (private mode) — session stays in memory */ }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch { /* ignore */ }
}

export function isLoggedIn(): boolean {
  return getToken() !== null
}

/** Authorization headers for an authenticated request. */
export function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json()
    return typeof data?.error === 'string' ? data.error : fallback
  } catch {
    return fallback
  }
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    throw new Error(await readError(res, 'Unable to sign in'))
  }

  const data = await res.json()
  if (data?.token) setToken(data.token)
  return data.user as AuthUser
}

export async function register(email: string, password: string): Promise<AuthUser> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    throw new Error(await readError(res, 'Unable to create account'))
  }

  const data = await res.json()
  if (data?.token) setToken(data.token)
  return data.user as AuthUser
}

export async function logout(): Promise<void> {
  const token = getToken()
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch { /* best effort — the local token is cleared regardless */ }
  }
  clearToken()
}

/**
 * Resolve the signed-in user from the stored token.
 * Returns null when there is no token or the token is no longer valid.
 */
export async function fetchSessionUser(): Promise<AuthUser | null> {
  const token = getToken()
  if (!token) return null

  try {
    const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      // Expired or revoked session — drop the stale token.
      if (res.status === 401) clearToken()
      return null
    }
    const data = await res.json()
    return data.user as AuthUser
  } catch {
    return null
  }
}
