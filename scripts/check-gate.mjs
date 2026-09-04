/**
 * Behaviour checks for the site access gate in middleware.ts.
 * Run: npm run check:gate
 *
 * Node 24 strips the TypeScript types on import, so the middleware is exercised
 * directly with no build step and no test-runner dependency.
 *
 * What is NOT covered here: the happy path with a genuine Supabase token. That
 * needs a real ES256 signature from the project's private key, which only
 * Supabase holds — so it is verified against the deployed site by signing in.
 * Everything reachable without that signature is covered below.
 */
import { mw, req, H, check, report } from './gate-harness.mjs'

const SUP = 'https://fpbvbmindazpkqnnkwnh.supabase.co'

// ── 1. fails closed when unconfigured ───────────────────────────────────────
delete process.env.SUPABASE_URL
delete process.env.SUPABASE_ANON_KEY
delete process.env.ALLOWED_EMAILS
let r = await mw(req('/'))
check('unconfigured fails closed (503)', r.status === 503, `got ${r.status}`)
check('unconfigured still says noindex', r.headers.get('x-robots-tag')?.includes('noindex'))
check('unconfigured leaks no app content', !(await r.text()).includes('id="root"'))

// A token without an allowlist must not be enough on its own.
process.env.SUPABASE_URL = SUP
process.env.SUPABASE_ANON_KEY = 'sb_publishable_test'
r = await mw(req('/'))
check('allowlist missing also fails closed', r.status === 503, `got ${r.status}`)

process.env.ALLOWED_EMAILS = 'owner@example.com, Helper@Example.com '
process.env.OBS_ACCESS_TOKEN = 'obs-token-123'

// ── 2. robots.txt stays reachable ───────────────────────────────────────────
r = await mw(req('/robots.txt'))
check('robots.txt served ungated', r.status === 200)
const robots = await r.text()
check('robots.txt allows crawl so noindex is visible', robots.includes('Allow: /'))
check('robots.txt is not the login page', !robots.includes('<html'))

// ── 3. anonymous requests are refused everywhere ────────────────────────────
for (const p of ['/', '/clips', '/subtitles', '/api/clips/search', '/assets/index.js', '/manifest.json']) {
  const res = await mw(req(p))
  check(`anonymous ${p} -> 401`, res.status === 401, `got ${res.status}`)
}
r = await mw(req('/clips'))
const body = await r.text()
check('401 body is the sign-in page, not app content', body.includes('Sign in'))
check('401 is not cached', r.headers.get('cache-control')?.includes('no-store'))
check('401 carries noindex', r.headers.get('x-robots-tag')?.includes('noindex'))
check('sign-in page never embeds the allowlist', !body.includes('owner@example.com'))
check('sign-in page uses the publishable key only', body.includes('sb_publishable_test'))
check('returnTo is preserved', body.includes('/clips'))

// ── 4. bad tokens are refused ───────────────────────────────────────────────
const withToken = (p, t) => req(p, { headers: { cookie: `sb-access-token=${t}` } })
for (const [name, tok] of [
  ['garbage', 'not-a-jwt'],
  ['empty', ''],
  ['structurally valid but unsigned', 'eyJhbGciOiJub25lIn0.eyJlbWFpbCI6Im93bmVyQGV4YW1wbGUuY29tIn0.'],
  ['alg=none forgery', btoa('{"alg":"none"}') + '.' + btoa('{"email":"owner@example.com","exp":9999999999}') + '.'],
]) {
  const res = await mw(withToken('/clips', tok))
  check(`${name} token -> 401`, res.status === 401, `got ${res.status}`)
}

// ── 5. off-site redirect is refused ─────────────────────────────────────────
r = await mw(req('//evil.example.com/x'))
check('protocol-relative path not echoed as returnTo', !(await r.text()).includes('//evil.example.com'))

// ── 6. logout clears both cookies ───────────────────────────────────────────
r = await mw(req('/__gate/logout'))
check('logout -> 303', r.status === 303, `got ${r.status}`)
const cookies = r.headers.getSetCookie?.() ?? []
check('logout clears the access token', cookies.some(c => c.startsWith('sb-access-token=;')))
check('logout clears the refresh token', cookies.some(c => c.startsWith('sb-refresh-token=;')))

// ── 7. OBS bypass ───────────────────────────────────────────────────────────
r = await mw(req('/listening/studio?k=wrong'))
check('OBS wrong token -> 401', r.status === 401, `got ${r.status}`)
let obs = 'no'
try { await mw(req('/listening/studio?k=obs-token-123')); obs = 'yes' }
catch (e) { obs = /vercel|context|next/i.test(e.message) ? 'yes (next() needs the Vercel runtime)' : 'no: ' + e.message }
check('OBS correct token reaches the allow branch', obs.startsWith('yes'), obs)
r = await mw(req('/clips?k=obs-token-123'))
check('OBS token does not unlock other routes', r.status === 401, `got ${r.status}`)

report()
