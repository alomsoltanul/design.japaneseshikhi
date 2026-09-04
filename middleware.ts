import { next } from '@vercel/functions'
import { createRemoteJWKSet, jwtVerify } from 'jose'
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
 * Two account backends, chosen automatically:
 *
 *   Firebase   when FIREBASE_PROJECT_ID and FIREBASE_WEB_API_KEY are both set.
 *              Sign-in runs server-side against Google's REST API, so the ID
 *              token cookie can be HttpOnly and is never exposed to page JS.
 *              Tokens are RS256 and verified against Google's JWKS.
 *   Local      otherwise. Accounts live in STUDIO_USERS as
 *              `email:scrypt$N$r$p$salt$hash` entries; only hashes are stored.
 *              Add people with `npm run user -- <email>`.
 *
 * With Firebase configured, STUDIO_USERS keeps working as break-glass — but
 * ONLY when Google is unreachable, never as an alternative to a real account.
 * A wrong Firebase password is a refusal, not a fallback.
 *
 * Every request is checked here before any file is served, so this is the real
 * boundary — the in-app UI is a name badge, not a gate.
 *
 * Runs on Vercel only. `npm run dev` serves through Vite and never reaches this
 * file, so local work is unaffected.
 *
 * Environment (Vercel project settings):
 *   FIREBASE_PROJECT_ID   e.g. designjapaneseshikhi-studio
 *   FIREBASE_WEB_API_KEY  public by design, like any Firebase web config
 *   ALLOWED_EMAILS        optional; restricts which Firebase accounts may enter
 *   STUDIO_USERS          email:hash entries — primary, or break-glass
 *   SESSION_SECRET        signs the local session cookie
 *   OBS_ACCESS_TOKEN      optional; lets an OBS browser source in
 *
 * With no usable backend the gate fails closed.
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

// ── Firebase ────────────────────────────────────────────────────────────────

const FB_ID = 'fb_id'
const FB_RT = 'fb_rt'
const FB_EMAIL = 'studio_email'
const FB_RT_MAX_AGE = 60 * 60 * 24 * 30

const IDENTITY = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword'
const SECURETOKEN = 'https://securetoken.googleapis.com/v1/token'
const GOOGLE_JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

/** Module scope: Fluid Compute reuses instances, so Google's keys are fetched once. */
let googleKeys: ReturnType<typeof createRemoteJWKSet> | null = null
const getGoogleKeys = () => (googleKeys ??= createRemoteJWKSet(new URL(GOOGLE_JWKS)))

type FirebaseConfig = { projectId: string; apiKey: string }

export function firebaseConfig(): FirebaseConfig | null {
  const projectId = (process.env.FIREBASE_PROJECT_ID || '').trim()
  const apiKey = (process.env.FIREBASE_WEB_API_KEY || '').trim()
  return projectId && apiKey ? { projectId, apiKey } : null
}

/** Verifies a Firebase ID token per Google's published rules. */
async function verifyIdToken(token: string, cfg: FirebaseConfig): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getGoogleKeys(), {
      issuer: `https://securetoken.google.com/${cfg.projectId}`,
      audience: cfg.projectId,
    })
    const email = String((payload as { email?: unknown }).email ?? '').toLowerCase().trim()
    // `sub` is the Firebase uid and must be present on a real token.
    return email && payload.sub ? email : null
  } catch {
    return null
  }
}

/** Optional second gate. Unset means "any account in our own project". */
export function emailAllowed(email: string): boolean {
  const list = (process.env.ALLOWED_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return list.length === 0 || list.includes(email)
}

type FirebaseOutcome =
  | { kind: 'ok'; idToken: string; refreshToken: string; email: string }
  | { kind: 'rejected'; message: string }
  | { kind: 'misconfigured'; message: string }
  | { kind: 'unreachable' }

/**
 * Google reports a bad API key and a bad password through the same 400. Telling
 * them apart matters: otherwise a mistyped key looks exactly like everyone
 * suddenly having the wrong password, which is a miserable thing to debug.
 */
const CONFIG_ERRORS = [
  // Verified against the live endpoint: a bad key returns the prose sentence,
  // not the symbolic code, so matching only on API_KEY_INVALID misses it and a
  // mistyped key masquerades as everyone having the wrong password.
  'API key not valid',
  'API_KEY_INVALID', 'CONFIGURATION_NOT_FOUND', 'PROJECT_NOT_FOUND',
  'OPERATION_NOT_ALLOWED', 'PASSWORD_LOGIN_DISABLED', 'ADMIN_ONLY_OPERATION',
]

async function firebaseSignIn(email: string, password: string, cfg: FirebaseConfig): Promise<FirebaseOutcome> {
  let res: Response
  try {
    res = await fetch(`${IDENTITY}?key=${encodeURIComponent(cfg.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    })
  } catch {
    // Network failure, not a credential failure — this is what break-glass is for.
    return { kind: 'unreachable' }
  }
  if (res.status >= 500) return { kind: 'unreachable' }

  const data = await res.json().catch(() => ({})) as
    { idToken?: string; refreshToken?: string; email?: string; error?: { message?: string } }
  if (!res.ok || !data.idToken || !data.refreshToken) {
    const message = data.error?.message || 'INVALID_LOGIN_CREDENTIALS'
    if (CONFIG_ERRORS.some(c => message.includes(c))) return { kind: 'misconfigured', message }
    return { kind: 'rejected', message }
  }
  return {
    kind: 'ok',
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    email: (data.email || email).toLowerCase(),
  }
}

/** ID tokens last an hour; swap the refresh token for a fresh one rather than bouncing people. */
async function firebaseRefresh(refreshToken: string, cfg: FirebaseConfig): Promise<{ idToken: string; refreshToken: string } | null> {
  try {
    const res = await fetch(`${SECURETOKEN}?key=${encodeURIComponent(cfg.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    })
    if (!res.ok) return null
    const d = await res.json() as { id_token?: string; refresh_token?: string }
    return d.id_token && d.refresh_token ? { idToken: d.id_token, refreshToken: d.refresh_token } : null
  } catch {
    return null
  }
}

function firebaseCookies(idToken: string, refreshToken: string, email: string, secure: boolean): string[] {
  const base = `Path=/; SameSite=Lax${secure ? '; Secure' : ''}`
  return [
    // HttpOnly: sign-in happens server-side, so page JS never needs these.
    `${FB_ID}=${encodeURIComponent(idToken)}; ${base}; HttpOnly; Max-Age=3600`,
    `${FB_RT}=${encodeURIComponent(refreshToken)}; ${base}; HttpOnly; Max-Age=${FB_RT_MAX_AGE}`,
    // Display only — the app shows a name badge from it. Tampering changes a
    // label and nothing else; the HttpOnly token above is the actual gate.
    `${FB_EMAIL}=${encodeURIComponent(email)}; ${base}; Max-Age=${FB_RT_MAX_AGE}`,
  ]
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
function gatePage(opts: {
  returnTo: string
  error?: string
  notice?: string
  firebase?: FirebaseConfig | null
}): string {
  // Google sign-in is inherently a browser flow, so it is the one part that
  // cannot happen server-side. The SDK hands us an ID token, which we post to
  // /__gate/session; the middleware verifies it and sets the HttpOnly cookies,
  // so the token still never persists anywhere page JS can reach.
  const google = opts.firebase ? `
  <div class="or"><span>or</span></div>
  <button id="g" type="button" class="google">Continue with Google</button>
  <script type="module">
    import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
    import { getAuth, GoogleAuthProvider, signInWithPopup }
      from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
    const app = initializeApp({
      apiKey: ${JSON.stringify(opts.firebase.apiKey)},
      authDomain: ${JSON.stringify(`${opts.firebase.projectId}.firebaseapp.com`)},
      projectId: ${JSON.stringify(opts.firebase.projectId)},
    });
    const btn = document.getElementById('g');
    const msg = document.getElementById('gm');
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.textContent = 'Opening Google…'; msg.style.display = 'none';
      try {
        const cred = await signInWithPopup(getAuth(app), new GoogleAuthProvider());
        const res = await fetch('${GATE_PATH}/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken: await cred.user.getIdToken(),
            refreshToken: cred.user.refreshToken,
          }),
        });
        if (res.ok) return location.replace(${JSON.stringify(opts.returnTo)});
        msg.textContent = res.status === 403
          ? 'That Google account is not on the access list for this studio.'
          : 'Google sign-in was refused.';
      } catch (e) {
        msg.textContent = (e && e.code === 'auth/popup-closed-by-user')
          ? 'Sign-in was cancelled.' : 'Google sign-in failed. ' + (e && e.code || '');
      }
      msg.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Continue with Google';
    });
  </script>` : ''

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
  .or{display:flex;align-items:center;gap:12px;margin:20px 0 4px;color:#5c6577;font-size:11px;
      letter-spacing:.1em;text-transform:uppercase}
  .or::before,.or::after{content:'';flex:1;height:1px;background:#232a3a}
  .google{background:#fff;color:#1f2430}
  .google:disabled{background:#4a4f5e;color:#fff}
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
  ${google}
  <div id="gm" class="msg err" style="display:none"></div>
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
  const firebase = firebaseConfig()

  // Local accounts still need a signing secret; Firebase does not.
  const localUsable = Boolean(secret && accounts.length)
  if (!firebase && !localUsable) {
    // Fail closed. A missing setting must never mean "let everyone in".
    return new Response(
      gatePage({
        returnTo: '/',
        notice: 'The access gate is not configured. Set FIREBASE_PROJECT_ID and FIREBASE_WEB_API_KEY (or STUDIO_USERS and SESSION_SECRET) in the Vercel project environment, then redeploy.',
      }),
      { status: 503, headers: htmlHeaders() },
    )
  }

  if (path === `${GATE_PATH}/logout`) {
    const kill = (n: string) => `${n}=; Path=/; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`
    const headers = new Headers(htmlHeaders({ Location: GATE_PATH }))
    for (const n of [COOKIE, FB_ID, FB_RT, FB_EMAIL]) headers.append('Set-Cookie', kill(n))
    return new Response(null, { status: 303, headers })
  }

  // Google sign-in finishes here: the browser hands over the ID token it just
  // received, and this verifies it before any cookie is issued. The token is
  // never trusted because the client sent it — only because it verifies.
  if (path === `${GATE_PATH}/session` && request.method === 'POST') {
    if (!firebase) return new Response('Not enabled', { status: 404, headers: htmlHeaders() })
    const payload = await request.json().catch(() => ({})) as
      { idToken?: string; refreshToken?: string }
    const email = payload.idToken ? await verifyIdToken(payload.idToken, firebase) : null
    if (!email) return new Response('Invalid token', { status: 401, headers: htmlHeaders() })
    if (!emailAllowed(email)) return new Response('Not on the access list', { status: 403, headers: htmlHeaders() })

    const headers = new Headers(htmlHeaders())
    for (const c of firebaseCookies(payload.idToken!, payload.refreshToken || '', email, secure)) {
      headers.append('Set-Cookie', c)
    }
    return new Response(null, { status: 204, headers })
  }

  if (path === `${GATE_PATH}/login` && request.method === 'POST') {
    const form = new URLSearchParams(await request.text())
    const returnTo = safeReturnTo(form.get('returnTo'))
    const email = form.get('email') ?? ''
    const password = form.get('password') ?? ''

    if (firebase) {
      const outcome = await firebaseSignIn(email, password, firebase)

      if (outcome.kind === 'ok') {
        if (!emailAllowed(outcome.email)) {
          return new Response(
            gatePage({ returnTo, error: 'That account is not on the access list for this studio.', firebase }),
            { status: 403, headers: htmlHeaders() },
          )
        }
        const headers = new Headers(htmlHeaders({ Location: returnTo }))
        for (const c of firebaseCookies(outcome.idToken, outcome.refreshToken, outcome.email, secure)) {
          headers.append('Set-Cookie', c)
        }
        return new Response(null, { status: 303, headers })
      }

      // A wrong password is a refusal. Break-glass is ONLY for Google being
      // unreachable — otherwise it would quietly become a second way in.
      if (outcome.kind === 'rejected') {
        return new Response(
          gatePage({ returnTo, error: 'Those details are not right.', firebase }),
          { status: 401, headers: htmlHeaders() },
        )
      }
      if (outcome.kind === 'misconfigured') {
        return new Response(
          gatePage({
            returnTo,
            firebase,
            notice: `Firebase is not set up correctly (${outcome.message}). Check FIREBASE_PROJECT_ID and FIREBASE_WEB_API_KEY, and that Email/Password sign-in is enabled.`,
          }),
          { status: 503, headers: htmlHeaders() },
        )
      }
      if (!localUsable) {
        return new Response(
          gatePage({ returnTo, notice: 'The sign-in service is unreachable. Try again shortly.', firebase }),
          { status: 503, headers: htmlHeaders() },
        )
      }
      // falls through to the local accounts below
    }

    const account = localUsable ? authenticate(email, password, accounts) : null
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
      gatePage({ returnTo, error: 'Those details are not right.', firebase }),
      { status: 401, headers: htmlHeaders() },
    )
  }

  if (firebase) {
    const idToken = readCookie(request, FB_ID)
    if (idToken) {
      const email = await verifyIdToken(idToken, firebase)
      if (email && emailAllowed(email)) return next({ headers: { 'X-Robots-Tag': ROBOTS } })
    }
    // Expired after an hour is the normal case, not an error: swap the refresh
    // token for a new ID token rather than bouncing someone mid-task.
    const refreshToken = readCookie(request, FB_RT)
    if (refreshToken) {
      const fresh = await firebaseRefresh(refreshToken, firebase)
      if (fresh) {
        const email = await verifyIdToken(fresh.idToken, firebase)
        if (email && emailAllowed(email)) {
          const headers = new Headers({ 'X-Robots-Tag': ROBOTS })
          for (const c of firebaseCookies(fresh.idToken, fresh.refreshToken, email, secure)) {
            headers.append('Set-Cookie', c)
          }
          return next({ headers })
        }
      }
    }
  }

  if (localUsable && readSession(readCookie(request, COOKIE), secret, accounts)) {
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
    gatePage({ returnTo: path === GATE_PATH ? '/' : safeReturnTo(path + url.search), firebase }),
    { status: path === GATE_PATH ? 200 : 401, headers: htmlHeaders() },
  )
}

export const config = {
  runtime: 'nodejs',
  matcher: '/((?!_vercel/).*)',
}
