# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for a security problem.

Report it privately via GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
(Security → Report a vulnerability on the repository), or by email to
**llakterian@gmail.com**.

Include: affected endpoint or file, reproduction steps, and impact. You should
receive an acknowledgement within 72 hours.

---

## Immediate action required: rotate exposed credentials

A copy of the project's `.env` file was distributed inside a source archive
(`Uplift.tar.gz`). That file contained live credentials in plain text:

| Credential | Where it came from | Status |
|---|---|---|
| Telegram bot token (`8861480156:AA…`) | `Uplift/.env`, first line | **Rotate now** |
| NVIDIA `LLAMA_API_KEY` (`nvapi-…`) | `Uplift/.env` | **Rotate now** |
| NVIDIA `MISTRAL_LARGE_API_KEY` (`nvapi-…`) | `Uplift/.env` | **Rotate now** |

The file was never committed to git (it is covered by `.gitignore`, and the
history has been scanned), so the exposure is limited to whoever received the
archive. **Treat these keys as compromised and rotate them regardless.**

### How to rotate

**Telegram bot token**
1. Open [@BotFather](https://t.me/BotFather) → `/revoke` for the bot.
2. Put the new token in `server/.dev.vars` as `TG_BOT_TOKEN` and, for
   production, `cd server && npx wrangler secret put TG_BOT_TOKEN`.
3. Re-register the webhook with the same secret:
   ```
   curl "https://api.telegram.org/bot<NEW_TOKEN>/setWebhook?url=https://uplift.llakterian.workers.dev/telegram-webhook/webhook&secret_token=<TG_WEBHOOK_SECRET>"
   ```

**NVIDIA API keys**
1. Revoke the keys in the NVIDIA API catalogue.
2. Note that **the current code does not use these keys** — AI features call
   Groq (`GROQ_API_KEY`). They were dead configuration, so simply removing
   them is safe. They are kept commented-out in `.env.example` for reference.

**Also do this**
- Ensure a `TG_WEBHOOK_SECRET` is set (see below). Without it the webhook
  refuses all traffic, which is the intended fail-closed behaviour.
- Rotate the bot token any time the archive is shared again.

---

## Security model

### Authentication

- Passwords are hashed with **PBKDF2-SHA256**, 100 000 iterations (the
  Cloudflare Workers ceiling), using a 16-byte random per-user salt.
  Stored format: `pbkdf2$<iterations>$<saltBase64>$<hashBase64>`.
- Passwords hashed with the legacy scheme (`SHA-256` + a **static** salt) are
  transparently upgraded to PBKDF2 on the next successful login.
- Sessions are opaque random UUIDs stored in KV and presented by the client as
  `Authorization: Bearer <token>`.
- **The user id is always derived from a validated session token.** It is never
  read from a client-supplied header. (An earlier version trusted an
  `X-User-Id` header, which allowed full account impersonation; that is fixed.)
- Login is rate-limited to 10 attempts per IP per 5 minutes; registration to 5
  per IP per hour.

### Secrets

- Secrets live in Cloudflare Workers Secrets (`wrangler secret put`), never in
  `wrangler.toml` or in git.
- Local development secrets live in `server/.dev.vars`, which is git-ignored.
  `server/.dev.vars.example` documents every variable.
- `.env` and `.env.*` are git-ignored, with an explicit `!.env.example` so the
  template stays tracked.

### SSRF protection

`/api/image-proxy` fetches arbitrary URLs, so it is the highest-risk endpoint.
It is protected by:

- Scheme allowlist (`http:`/`https:` only) and rejection of embedded
  credentials (`http://user:pass@host`).
- Blocking of every non-public address range: loopback, RFC1918, CGNAT,
  link-local (**including `169.254.169.254`** cloud metadata), multicast,
  reserved, IPv6 unique-local / link-local / loopback, IPv4-mapped IPv6, and
  decimal/hex/octal IP encodings (the WHATWG URL parser normalises these).
- Blocking of internal TLDs (`.local`, `.internal`, `.home.arpa`, `.lan`, …)
  and single-label hostnames.
- **Redirects are followed manually**, up to 3 hops, and every hop is
  re-validated — a public URL that redirects to cloud metadata is rejected.
- Response size cap (8 MB) and a 10 s timeout.
- Optional domain allowlist via `IMAGE_PROXY_ALLOWED_DOMAINS`.
- A stricter rate limit (30/min/IP) than the global limit.

> **Known limitation:** Workers cannot resolve DNS, so a hostname whose DNS
> record points at a private address cannot be detected here. Set
> `IMAGE_PROXY_ALLOWED_DOMAINS` to the known CDN hosts to close this off
> entirely.

### XSS

- React escapes all interpolated text; the codebase contains **no**
  `dangerouslySetInnerHTML` and no `innerHTML` assignment.
- `sanitizeHtml()` strips markup and dangerous protocols from upstream content
  as defence in depth.
- The Content-Security-Policy is `script-src 'self'` with **no** `unsafe-inline`
  and **no** `unsafe-eval`. The built bundle contains no inline scripts, so
  this holds without a nonce.
- `style-src` keeps `unsafe-inline` because the app sets React inline `style`
  attributes. Style injection is materially less dangerous than script
  injection; a nonce-based policy is the upgrade path.

### CORS

- The allowlist is read from the `ALLOWED_ORIGINS` environment variable
  (previously hard-coded, which silently ignored the configured value).
- Only allowlisted origins are echoed back. The SSE digest stream previously
  sent `Access-Control-Allow-Origin: *` alongside
  `Access-Control-Allow-Credentials: true`; that is fixed.

### Rate limiting

A KV-backed sliding window. KV is eventually consistent, so this is a **soft**
limit that blunts brute force and scraping — it is not a hard security
boundary, and it fails open if KV is unavailable.

### Webhook authentication

The Telegram webhook validates `X-Telegram-Bot-Api-Secret-Token` against
`TG_WEBHOOK_SECRET` and **fails closed** when the secret is unset.
Without this check, anyone could subscribe or unsubscribe arbitrary chats.

---

## Known limitations and planned upgrades

| Issue | Impact | Planned fix |
|---|---|---|
| Session token in `localStorage` | Any script on the origin can read it | Move to an httpOnly, `SameSite` cookie plus CSRF tokens |
| KV-based rate limiter is eventually consistent | Small window where a burst slips through | Durable Objects, or Cloudflare WAF rate limiting |
| DNS rebinding in the image proxy | A hostname resolving to a private IP is not blocked | Set `IMAGE_PROXY_ALLOWED_DOMAINS` |
| `style-src 'unsafe-inline'` | Style injection possible | Nonce-based style policy |
| X OAuth (`/api/auth/x`) is a stub | X sign-in does not work | Implement the PKCE flow with `X_CLIENT_ID` / `X_CLIENT_SECRET` |
| No email verification on registration | Accounts can be created for any address | Add a verification step before activating an account |
| No password reset | Users cannot recover an account | Add a reset flow with a signed, expiring token |

---

## Hardening checklist for deployment

- [ ] All secrets set via `wrangler secret put` (never in `wrangler.toml`)
- [ ] `TG_WEBHOOK_SECRET` set and the webhook re-registered with it
- [ ] `ALLOWED_ORIGINS` narrowed to the real production origins
- [ ] `IMAGE_PROXY_ALLOWED_DOMAINS` set to the known CDN hosts
- [ ] Database schema applied (`schema.sql`)
- [ ] Credentials from the exposed `.env` rotated
- [ ] `main` branch protected (see the note in the README about GitHub plan limits)
