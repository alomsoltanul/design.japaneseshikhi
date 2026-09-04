import { next } from '@vercel/functions'
import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto'

/**
 * Access gate for designjapaneseshikhi.
 *
 * This tool is a private creator studio for the owner and their workers. It is
 * not customer-facing, must never be publicly reachable, and is deliberately
 * self-contained: it shares no database, auth pool or storage with any other
 * product. There is no external identity provider in this path — nothing to
 * pause, nothing to rate-limit, nothing to couple us to somebody else's outage.
 *
 * Accounts live in STUDIO_USERS as `email:scrypt$N$r$p$salt$hash` entries.
 * Passwords are never stored, only scrypt hashes, so the variable is safe to
 * hold in project settings. Add people with `npm run user -- <email>`.
 *
 * Every request is checked here before any file is served, so this is the real
 * boundary — the in-app UI is a name badge, not a gate.
 *
 * Runs on Vercel only. `npm run dev` serves through Vite and never reaches this
 * file, so local work is unaffected.
 *
 * Environment (Vercel project settings):
 *   STUDIO_USERS      email:hash entries, comma or newline separated
 *   SESSION_SECRET    signs the session cookie
 *   OBS_ACCESS_TOKEN  optional; lets an OBS browser source in
 *
 * With STUDIO_USERS or SESSION_SECRET missing the gate fails closed.
 */

const GATE_PATH = '/__gate'
const COOKIE = 'studio_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 14 // 14 days
const ROBOTS = 'noindex, nofollow, noarchive, nosnippet, noimageindex'

const ROBOTS_TXT = `# designjapaneseshikhi is a private creator tool, not a public site.
# Every route is behind an access gate and every response carries
# X-Robots-Tag: noindex. Crawling is allowed only so that header is visible —
# blocking it here would stop search engines from ever seeing the noindex.
User-agent: *
Allow: /
`

// ── passwords ───────────────────────────────────────────────────────────────

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 }

/** `scrypt$N$r$p$saltHex$hashHex` — the format scripts/make-user.mjs emits. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, nS, rS, pS, saltHex, hashHex] = parts
  const N = Number(nS), r = Number(rS), p = Number(pS)
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false

  let expected: Buffer
  try {
    expected = Buffer.from(hashHex, 'hex')
  } catch {
    return false
  }
  if (!expected.length) return false

  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, {
    N, r, p,
    // scrypt at N=16384 needs more than Node's default 32MB budget.
    maxmem: 256 * 1024 * 1024,
  })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

type Account = { email: string; hash: string }

function parseAccounts(raw: string): Account[] {
  return raw
    .split(/[,\n]+/)
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const at = entry.indexOf(':')
      if (at < 0) return null
      return {
        email: entry.slice(0, at).trim().toLowerCase(),
        hash: entry.slice(at + 1).trim(),
      }
    })
    .filter((a): a is Account => Boolean(a && a.email && a.hash))
}

/**
 * Always runs one scrypt, even for an unknown email, so a wrong address and a
 * wrong password take the same time and the response cannot be used to
 * enumerate who has an account.
 */
function authenticate(email: string, password: string, accounts: Account[]): Account | null {
  const wanted = email.trim().toLowerCase()
  const found = accounts.find(a => a.email === wanted)
  const target = found ?? accounts[0]
  if (!target) return null
  const ok = verifyPassword(password, target.hash)
  return found && ok ? found : null
}

// ── session cookie ──────────────────────────────────────────────────────────

const sign = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('base64url')

const b64url = (s: string) => Buffer.from(s, 'utf8').toString('base64url')

function issueSession(email: string, secret: string): string {
  const body = b64url(JSON.stringify({ email, exp: Date.now() + SESSION_MAX_AGE * 1000 }))
  return `v1.${body}.${sign(`v1.${body}`, secret)}`
}

function readSession(token: string | undefined, secret: string, accounts: Account[]): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== 'v1') return null

  const expected = Buffer.from(sign(`v1.${parts[1]}`, secret))
  const given = Buffer.from(parts[2])
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null

  try {
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as
      { email?: string; exp?: number }
    if (!claims.email || typeof claims.exp !== 'number' || claims.exp <= Date.now()) return null
    // Revocation: removing someone from STUDIO_USERS invalidates their cookie
    // immediately, without waiting for it to expire.
    if (!accounts.some(a => a.email === claims.email)) return null
    return claims.email
  } catch {
    return null
  }
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie')
  if (!header) return undefined
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim())
  }
  return undefined
}

const sessionCookie = (token: string, secure: boolean) =>
  `${COOKIE}=${token}; Path=/; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure ? '; Secure' : ''}`

function tokenMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

// ── pages ───────────────────────────────────────────────────────────────────

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

const htmlHeaders = (extra: Record<string, string> = {}) => ({
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store, max-age=0',
  'X-Robots-Tag': ROBOTS,
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  ...extra,
})

/** Served by the middleware itself, so the application bundle stays behind the gate. */
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
       background:radial-gradient(1100px 600px at 50% -10%,#1a1430 0%,#0b0d13 62%);
       color:#f4f7fa;font:15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  .card{width:min(390px,92vw);background:#141824;border:1px solid #232a3a;border-radius:18px;
        padding:34px;box-shadow:0 30px 70px -20px rgba(0,0,0,.7)}
  .mark{width:44px;height:44px;border-radius:12px;background:#E63946;display:flex;
        align-items:center;justify-content:center;font-size:22px;font-weight:800;margin-bottom:18px}
  h1{margin:0 0 6px;font-size:20px;letter-spacing:-.01em}
  p.sub{margin:0 0 10px;font-size:13px;color:#8a94a6}
  label{display:block;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
        color:#8a94a6;margin:14px 0 6px}
  input{width:100%;padding:11px 13px;border-radius:9px;border:1px solid #2c3448;background:#0f1320;
        color:#f4f7fa;font-size:15px;outline:none}
  input:focus{border-color:#E63946}
  button{width:100%;margin-top:20px;padding:11px;border:0;border-radius:9px;background:#E63946;
         color:#fff;font-size:15px;font-weight:700;cursor:pointer}
  .msg{margin-top:16px;padding:10px 12px;border-radius:9px;font-size:13px}
  .err{background:#2a1418;border:1px solid #64232c;color:#ff9aa4}
  .note{background:#1a1d2b;border:1px solid #2c3448;color:#8a94a6}
</style>
</head><body>
<div class="card">
  <div class="mark">文</div>
  <h1>Content Studio</h1>
  <p class="sub">Private workspace for the team.</p>
  <form method="POST" action="${GATE_PATH}/login">
    <input type="hidden" name="returnTo" value="${escapeHtml(opts.returnTo)}">
    <label for="e">Email</label>
    <input id="e" name="email" type="email" autocomplete="username" required autofocus>
    <label for="p">Password</label>
    <input id="p" name="password" type="password" autocomplete="current-password" required>
    <button type="submit">Sign in</button>
  </form>
  ${opts.error ? `<div class="msg err">${escapeHtml(opts.error)}</div>` : ''}
  ${opts.notice ? `<div class="msg note">${escapeHtml(opts.notice)}</div>` : ''}
</div>
</body></html>`
}

/** Only same-origin absolute paths, so the form cannot bounce someone off-site. */
function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

// ── middleware ──────────────────────────────────────────────────────────────

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const secure = url.protocol === 'https:'
  const path = url.pathname

  if (path === '/robots.txt') {
    return new Response(ROBOTS_TXT, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': ROBOTS },
    })
  }

  const secret = process.env.SESSION_SECRET || ''
  const accounts = parseAccounts(process.env.STUDIO_USERS || '')

  if (!secret || !accounts.length) {
    // Fail closed. A missing setting must never mean "let everyone in".
    return new Response(
      gatePage({
        returnTo: '/',
        notice: 'The access gate is not configured. Set STUDIO_USERS and SESSION_SECRET in the Vercel project environment, then redeploy.',
      }),
      { status: 503, headers: htmlHeaders() },
    )
  }

  if (path === `${GATE_PATH}/logout`) {
    return new Response(null, {
      status: 303,
      headers: htmlHeaders({
        Location: GATE_PATH,
        'Set-Cookie': `${COOKIE}=; Path=/; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`,
      }),
    })
  }

  if (path === `${GATE_PATH}/login` && request.method === 'POST') {
    const form = new URLSearchParams(await request.text())
    const returnTo = safeReturnTo(form.get('returnTo'))
    const account = authenticate(form.get('email') ?? '', form.get('password') ?? '', accounts)
    if (account) {
      return new Response(null, {
        status: 303,
        headers: htmlHeaders({
          Location: returnTo,
          'Set-Cookie': sessionCookie(issueSession(account.email, secret), secure),
        }),
      })
    }
    // One message for both cases, so the response cannot confirm an address.
    return new Response(
      gatePage({ returnTo, error: 'Those details are not right.' }),
      { status: 401, headers: htmlHeaders() },
    )
  }

  if (readSession(readCookie(request, COOKIE), secret, accounts)) {
    return next({ headers: { 'X-Robots-Tag': ROBOTS } })
  }

  // OBS browser sources cannot fill in a form, so the chromeless studio route
  // accepts a token in the URL.
  const obsToken = process.env.OBS_ACCESS_TOKEN
  if (obsToken && path.startsWith('/listening/studio')) {
    const given = url.searchParams.get('k') ?? ''
    if (given && tokenMatches(given, obsToken)) {
      return next({ headers: { 'X-Robots-Tag': ROBOTS } })
    }
  }

  // 401 rather than a redirect: a crawler or scraper gets a refusal, not content.
  return new Response(
    gatePage({ returnTo: path === GATE_PATH ? '/' : safeReturnTo(path + url.search) }),
    { status: path === GATE_PATH ? 200 : 401, headers: htmlHeaders() },
  )
}

export const config = {
  runtime: 'nodejs',
  matcher: '/((?!_vercel/).*)',
}
