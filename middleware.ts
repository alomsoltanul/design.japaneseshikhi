import { next } from '@vercel/functions'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { timingSafeEqual } from 'node:crypto'

/**
 * Site-wide access gate for designjapaneseshikhi.
 *
 * Every request is checked here before any file is served, so this is the real
 * boundary — not the in-app UI. Identity comes from Supabase Auth: the browser
 * holds a Supabase access token in a cookie, and this verifies its ES256
 * signature against the project's JWKS before letting anything through.
 *
 * A valid token is necessary but NOT sufficient. The Supabase project has
 * signup enabled and Google/Facebook providers on, so anyone could mint a valid
 * token for themselves. ALLOWED_EMAILS is the actual authorisation list; a
 * verified stranger gets 403, not 200.
 *
 * Runs on Vercel only. `npm run dev` serves through Vite and never reaches this
 * file, so local work is unaffected.
 *
 * Environment (Vercel project settings):
 *   SUPABASE_URL          https://<ref>.supabase.co
 *   SUPABASE_ANON_KEY     publishable key — safe in the client by design
 *   ALLOWED_EMAILS        comma-separated list of who may enter
 *   SESSION_SECRET        still used to sign the OBS bypass cookie
 *   OBS_ACCESS_TOKEN      optional; lets an OBS browser source in
 *
 * With SUPABASE_URL or ALLOWED_EMAILS missing the gate fails closed.
 */

const GATE_PATH = '/__gate'
const TOKEN_COOKIE = 'sb-access-token'
const ROBOTS = 'noindex, nofollow, noarchive, nosnippet, noimageindex'

const ROBOTS_TXT = `# designjapaneseshikhi is a private studio, not a public site.
# Every route is behind an access gate and every response carries
# X-Robots-Tag: noindex. Crawling is allowed only so that header is visible —
# blocking it here would stop search engines from ever seeing the noindex.
User-agent: *
Allow: /
`

// ── Supabase token verification ─────────────────────────────────────────────

/**
 * Module scope on purpose: Fluid Compute reuses instances, so the JWKS is
 * fetched once and reused across requests rather than on every page load.
 */
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

function getJwks(supabaseUrl: string) {
  if (!jwks) jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`))
  return jwks
}

async function verifySupabaseToken(token: string, supabaseUrl: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwks(supabaseUrl), {
      issuer: `${supabaseUrl}/auth/v1`,
      // `exp` is enforced by jwtVerify; a stale token simply fails.
    })
    return payload
  } catch {
    return null
  }
}

/** Authorisation, separate from authentication. */
function isAllowed(payload: JWTPayload, allowed: string[]): boolean {
  const email = String((payload as { email?: unknown }).email ?? '').toLowerCase().trim()
  if (!email) return false
  return allowed.includes(email)
}

// ── cookies ─────────────────────────────────────────────────────────────────

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

/** Constant-time where it matters; the length check leaks only the length. */
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

/**
 * The login page is served by the middleware itself, not by the app, so the
 * application bundle stays behind the gate. It talks to Supabase's REST auth
 * endpoint directly with the publishable key and writes the returned access
 * token to a cookie the middleware can read on the next request.
 */
function loginPage(opts: { supabaseUrl: string; anonKey: string; returnTo: string; notice?: string }): string {
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
  .mark{width:44px;height:44px;border-radius:12px;background:#E63946;display:flex;align-items:center;
        justify-content:center;font-size:22px;font-weight:800;margin-bottom:18px}
  h1{margin:0 0 6px;font-size:20px;letter-spacing:-.01em}
  p.sub{margin:0 0 24px;font-size:13px;color:#8a94a6}
  label{display:block;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
        color:#8a94a6;margin:14px 0 6px}
  input{width:100%;padding:11px 13px;border-radius:9px;border:1px solid #2c3448;background:#0f1320;
        color:#f4f7fa;font-size:15px;outline:none}
  input:focus{border-color:#E63946}
  button{width:100%;margin-top:20px;padding:11px;border:0;border-radius:9px;background:#E63946;
         color:#fff;font-size:15px;font-weight:700;cursor:pointer}
  button:disabled{background:#4a4f5e;cursor:not-allowed}
  .msg{margin-top:16px;padding:10px 12px;border-radius:9px;font-size:13px;display:none}
  .err{background:#2a1418;border:1px solid #64232c;color:#ff9aa4}
  .note{background:#1a1d2b;border:1px solid #2c3448;color:#8a94a6;display:block}
</style>
</head><body>
<div class="card">
  <div class="mark">文</div>
  <h1>Content Studio</h1>
  <p class="sub">Private workspace. Sign in with your account.</p>
  <form id="f">
    <label for="e">Email</label>
    <input id="e" type="email" autocomplete="username" required autofocus>
    <label for="p">Password</label>
    <input id="p" type="password" autocomplete="current-password" required>
    <button id="b" type="submit">Sign in</button>
  </form>
  <div id="m" class="msg err"></div>
  ${opts.notice ? `<div class="msg note">${escapeHtml(opts.notice)}</div>` : ''}
</div>
<script>
const URL_ = ${JSON.stringify(opts.supabaseUrl)};
const KEY = ${JSON.stringify(opts.anonKey)};
const RETURN_TO = ${JSON.stringify(opts.returnTo)};
const f = document.getElementById('f'), m = document.getElementById('m'), b = document.getElementById('b');
function fail(t){ m.textContent = t; m.style.display = 'block'; b.disabled = false; b.textContent = 'Sign in'; }
f.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  m.style.display = 'none'; b.disabled = true; b.textContent = 'Signing in…';
  try {
    const r = await fetch(URL_ + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY },
      body: JSON.stringify({ email: document.getElementById('e').value, password: document.getElementById('p').value }),
    });
    const d = await r.json();
    if (!r.ok || !d.access_token) return fail(d.error_description || d.msg || 'Those details are not right.');
    // Not HttpOnly by necessity: the app reads the same session client-side.
    // Scoped, Secure, SameSite=Lax, and short-lived — Supabase expires it in an hour.
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = 'sb-access-token=' + encodeURIComponent(d.access_token) +
      '; Path=/; Max-Age=' + (d.expires_in || 3600) + '; SameSite=Lax' + secure;
    if (d.refresh_token) document.cookie = 'sb-refresh-token=' + encodeURIComponent(d.refresh_token) +
      '; Path=/; Max-Age=2592000; SameSite=Lax' + secure;
    location.replace(RETURN_TO);
  } catch (e) { fail('Could not reach the sign-in service.'); }
});
</script>
</body></html>`
}

function noticePage(message: string, status: number): Response {
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="${ROBOTS}"><title>Content Studio</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#0b0d13;color:#f4f7fa;font:15px/1.6 -apple-system,BlinkMacSystemFont,sans-serif;padding:24px}
div{max-width:440px;background:#141824;border:1px solid #232a3a;border-radius:16px;padding:30px}
a{color:#E63946}</style></head><body><div>${escapeHtml(message)}
<p><a href="${GATE_PATH}/logout">Sign in as someone else</a></p></div></body></html>`,
    { status, headers: htmlHeaders() })
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

  // Reachable without the gate: a crawler that cannot fetch this learns
  // nothing, and every other response already says noindex.
  if (path === '/robots.txt') {
    return new Response(ROBOTS_TXT, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': ROBOTS },
    })
  }

  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
  const anonKey = process.env.SUPABASE_ANON_KEY || ''
  const allowed = (process.env.ALLOWED_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

  if (!supabaseUrl || !anonKey || !allowed.length) {
    // Fail closed. A missing setting must never mean "let everyone in".
    return noticePage(
      'The access gate is not configured. Set SUPABASE_URL, SUPABASE_ANON_KEY and ALLOWED_EMAILS in the Vercel project environment, then redeploy.',
      503,
    )
  }

  if (path === `${GATE_PATH}/logout`) {
    const kill = (n: string) => `${n}=; Path=/; Max-Age=0; SameSite=Lax${secure ? '; Secure' : ''}`
    const headers = new Headers(htmlHeaders({ Location: GATE_PATH }))
    headers.append('Set-Cookie', kill(TOKEN_COOKIE))
    headers.append('Set-Cookie', kill('sb-refresh-token'))
    return new Response(null, { status: 303, headers })
  }

  const token = readCookie(request, TOKEN_COOKIE)
  if (token) {
    const payload = await verifySupabaseToken(token, supabaseUrl)
    if (payload) {
      if (isAllowed(payload, allowed)) {
        return next({ headers: { 'X-Robots-Tag': ROBOTS } })
      }
      // Authenticated but not authorised — signup is open on this project, so
      // a real Supabase account is not by itself permission to be here.
      return noticePage(
        'That account is not on the access list for this studio. Ask the owner to add your email.',
        403,
      )
    }
  }

  // OBS browser sources cannot sign in, so the chromeless studio route accepts
  // a token in the URL.
  const obsToken = process.env.OBS_ACCESS_TOKEN
  if (obsToken && path.startsWith('/listening/studio')) {
    const given = url.searchParams.get('k') ?? ''
    if (given && tokenMatches(given, obsToken)) {
      return next({ headers: { 'X-Robots-Tag': ROBOTS } })
    }
  }

  const returnTo = path === GATE_PATH ? '/' : safeReturnTo(path + url.search)
  // 401 rather than a redirect: a crawler or scraper gets a refusal, not content.
  return new Response(
    loginPage({ supabaseUrl, anonKey, returnTo }),
    { status: path === GATE_PATH ? 200 : 401, headers: htmlHeaders() },
  )
}

export const config = {
  runtime: 'nodejs',
  // Everything the deployment serves — pages, assets and /api alike. Vercel's
  // own internals under /_vercel are the only exclusion.
  matcher: '/((?!_vercel/).*)',
}
