import { next } from '@vercel/functions'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Site-wide access gate for designjapaneseshikhi.
 *
 * Why this exists: the in-app login (src/auth/AuthContext.tsx) keeps its user
 * list in localStorage, so it decides what the UI renders and nothing more. It
 * never protected the served files — the bundle, every asset and every /api
 * route were public, and a visitor could grant themselves a session from the
 * browser console. This middleware is the first server-side check in front of
 * the deployment: it terminates unauthenticated requests before any file is
 * served, so it is a real gate rather than a UI convention.
 *
 * It runs on Vercel only. `npm run dev` serves through Vite and never reaches
 * this file, so local work is unaffected.
 *
 * Required environment variables (Project Settings -> Environment Variables):
 *   SITE_PASSWORD    the shared password people type to get in
 *   SESSION_SECRET   random string used to sign the session cookie
 *   OBS_ACCESS_TOKEN optional; lets an OBS browser source reach /listening/studio
 *
 * With SITE_PASSWORD or SESSION_SECRET missing the gate fails closed and serves
 * a configuration notice — it never falls open.
 */

const COOKIE = 'js_gate'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days
const GATE_PATH = '/__gate'

/** Applied to every response, authenticated or not. */
const ROBOTS = 'noindex, nofollow, noarchive, nosnippet, noimageindex'

const ROBOTS_TXT = `# designjapaneseshikhi is a private studio, not a public site.
# Every route is behind an access gate and every response carries
# X-Robots-Tag: noindex. Crawling is allowed only so that header is visible —
# blocking it here would stop search engines from ever seeing the noindex.
User-agent: *
Allow: /
`

// ── session cookie ──────────────────────────────────────────────────────────

const sign = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('base64url')

function issueToken(secret: string): string {
  const payload = `v1.${Date.now() + COOKIE_MAX_AGE * 1000}`
  return `${payload}.${sign(payload, secret)}`
}

function verifyToken(token: string | undefined, secret: string): boolean {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [version, expires, mac] = parts
  if (version !== 'v1') return false

  const expected = Buffer.from(sign(`${version}.${expires}`, secret))
  const given = Buffer.from(mac)
  if (given.length !== expected.length) return false
  if (!timingSafeEqual(given, expected)) return false

  const exp = Number(expires)
  return Number.isFinite(exp) && exp > Date.now()
}

/** Constant-time where it matters; the length check leaks only the length. */
function passwordMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie')
  if (!header) return undefined
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return undefined
}

const sessionCookie = (token: string, secure: boolean) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}${secure ? '; Secure' : ''}`

const clearedCookie = (secure: boolean) =>
  `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`

// ── pages ───────────────────────────────────────────────────────────────────

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

/** Self-contained: no scripts and no external assets, so nothing else needs unblocking. */
function gatePage(opts: { returnTo: string; error?: string; notice?: string }): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="${ROBOTS}">
<title>Japanese Shikhi — Content Studio</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#0b0d13;color:#f4f7fa;font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  .card{width:min(380px,92vw);background:#141824;border:1px solid #232a3a;border-radius:16px;padding:32px}
  h1{margin:0 0 6px;font-size:20px;letter-spacing:-.01em}
  p.sub{margin:0 0 24px;font-size:13px;color:#8a94a6}
  label{display:block;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a94a6;margin-bottom:6px}
  input{width:100%;padding:11px 13px;border-radius:9px;border:1px solid #2c3448;background:#0f1320;color:#f4f7fa;font-size:15px;outline:none}
  input:focus{border-color:#E63946}
  button{width:100%;margin-top:16px;padding:11px;border:0;border-radius:9px;background:#E63946;color:#fff;font-size:15px;font-weight:700;cursor:pointer}
  .msg{margin-top:16px;padding:10px 12px;border-radius:9px;font-size:13px}
  .err{background:#2a1418;border:1px solid #64232c;color:#ff9aa4}
  .note{background:#1a1d2b;border:1px solid #2c3448;color:#8a94a6}
</style>
</head><body>
<div class="card">
  <h1>Content Studio</h1>
  <p class="sub">Private workspace. Enter the access password to continue.</p>
  <form method="POST" action="${GATE_PATH}/login">
    <input type="hidden" name="returnTo" value="${escapeHtml(opts.returnTo)}">
    <label for="p">Access password</label>
    <input id="p" name="password" type="password" autocomplete="current-password" autofocus required>
    <button type="submit">Unlock</button>
  </form>
  ${opts.error ? `<div class="msg err">${escapeHtml(opts.error)}</div>` : ''}
  ${opts.notice ? `<div class="msg note">${escapeHtml(opts.notice)}</div>` : ''}
</div>
</body></html>`
}

const htmlHeaders = (extra: Record<string, string> = {}) => ({
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store, max-age=0',
  'X-Robots-Tag': ROBOTS,
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  ...extra,
})

/** Only same-origin absolute paths, so the form cannot bounce someone off-site. */
function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

// ── middleware ──────────────────────────────────────────────────────────────

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const secure = url.protocol === 'https:'
  const path = url.pathname

  // robots.txt stays reachable without the gate: a crawler that cannot fetch it
  // learns nothing, and every other response already says noindex.
  if (path === '/robots.txt') {
    return new Response(ROBOTS_TXT, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': ROBOTS },
    })
  }

  const password = process.env.SITE_PASSWORD
  const secret = process.env.SESSION_SECRET

  if (!password || !secret) {
    // Fail closed. A missing secret must never mean "let everyone in".
    return new Response(
      gatePage({
        returnTo: '/',
        notice: 'The access gate is not configured. Set SITE_PASSWORD and SESSION_SECRET in the Vercel project environment, then redeploy.',
      }),
      { status: 503, headers: htmlHeaders() },
    )
  }

  if (path === `${GATE_PATH}/logout`) {
    return new Response(null, {
      status: 303,
      headers: htmlHeaders({ Location: GATE_PATH, 'Set-Cookie': clearedCookie(secure) }),
    })
  }

  if (path === `${GATE_PATH}/login` && request.method === 'POST') {
    const form = new URLSearchParams(await request.text())
    const returnTo = safeReturnTo(form.get('returnTo'))
    if (passwordMatches(form.get('password') ?? '', password)) {
      return new Response(null, {
        status: 303,
        headers: htmlHeaders({ Location: returnTo, 'Set-Cookie': sessionCookie(issueToken(secret), secure) }),
      })
    }
    return new Response(
      gatePage({ returnTo, error: 'That password is not right.' }),
      { status: 401, headers: htmlHeaders() },
    )
  }

  if (verifyToken(readCookie(request, COOKIE), secret)) {
    return next({ headers: { 'X-Robots-Tag': ROBOTS } })
  }

  // OBS browser sources cannot fill in a form, so the chromeless studio route
  // accepts a token in the URL and is handed the same cookie for its assets.
  const obsToken = process.env.OBS_ACCESS_TOKEN
  if (obsToken && path.startsWith('/listening/studio')) {
    const given = url.searchParams.get('k') ?? ''
    if (given && passwordMatches(given, obsToken)) {
      return next({
        headers: { 'X-Robots-Tag': ROBOTS, 'Set-Cookie': sessionCookie(issueToken(secret), secure) },
      })
    }
  }

  if (path === GATE_PATH) {
    return new Response(gatePage({ returnTo: '/' }), { status: 200, headers: htmlHeaders() })
  }

  // 401 rather than a redirect: a crawler or scraper gets a refusal, not content.
  return new Response(
    gatePage({ returnTo: path + url.search }),
    { status: 401, headers: htmlHeaders() },
  )
}

export const config = {
  runtime: 'nodejs',
  // Everything the deployment serves — pages, assets and /api alike. Vercel's
  // own internals under /_vercel are the only exclusion.
  matcher: '/((?!_vercel/).*)',
}
