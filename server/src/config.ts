/**
 * Shared runtime configuration helpers.
 */

import type { Env } from './types'

export const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://uplift.llakterian.workers.dev',
  'https://uplift.news',
  'https://www.uplift.news'
]

/**
 * Parse the comma-separated `ALLOWED_ORIGINS` variable, falling back to the
 * built-in defaults when it is unset or empty.
 */
export function allowedOrigins(env: Env): string[] {
  const configured = env.ALLOWED_ORIGINS?.split(',')
    .map(o => o.trim())
    .filter(Boolean)
  return configured && configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS
}

/** True when the request originates from an allowlisted browser. */
export function isAllowedOrigin(origin: string | undefined, allowed: string[]): boolean {
  if (!origin) return false
  return allowed.includes(origin)
}

/**
 * Resolve the `Access-Control-Allow-Origin` value for a request.
 * Returns undefined when the origin is not allowlisted.
 */
export function corsOriginFor(env: Env, origin: string | undefined): string | undefined {
  const allowed = allowedOrigins(env)
  return isAllowedOrigin(origin, allowed) ? origin : undefined
}

/**
 * Parse a bounded integer query parameter.
 * Returns `fallback` when the value is absent, non-numeric, out of range or
 * not a whole number.
 */
export function parseBoundedInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (raw === undefined || raw === null || raw === '') return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return fallback
  const truncated = Math.trunc(parsed)
  if (truncated < min || truncated > max) return fallback
  return truncated
}
