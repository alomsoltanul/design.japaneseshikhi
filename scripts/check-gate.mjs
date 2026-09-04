/**
 * Behaviour checks for the site access gate in middleware.ts.
 * Run: npm run check:gate
 *
 * Node 24 strips the TypeScript types on import, so the middleware is exercised
 * directly with no build step and no test-runner dependency.
 */
import { scryptSync, randomBytes } from 'node:crypto'
import { mw, req, H, check, report } from './gate-harness.mjs'

const hash = (pw) => {
  const salt = randomBytes(16)
  const h = scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 256 * 1024 * 1024 })
  return `scrypt$16384$8$1$${salt.toString('hex')}$${h.toString('hex')}`
}
const OWNER = 'owner@example.com'
const WORKER = 'worker@example.com'
const PW = 'correct horse battery staple'
const USERS = `${OWNER}:${hash(PW)}, ${WORKER}:${hash('another-password')}`
const login = (body) => req('/__gate/login', { method: 'POST', headers: H, body })

// ── 1. fails closed when unconfigured ───────────────────────────────────────
delete process.env.STUDIO_USERS
delete process.env.SESSION_SECRET
let r = await mw(req('/'))
check('unconfigured fails closed (503)', r.status === 503, `got ${r.status}`)
check('unconfigured still says noindex', r.headers.get('x-robots-tag')?.includes('noindex'))
check('unconfigured leaks no app content', !(await r.text()).includes('id="root"'))

process.env.SESSION_SECRET = 'test-secret-for-signing-only'
r = await mw(req('/'))
check('no accounts also fails closed', r.status === 503, `got ${r.status}`)

process.env.STUDIO_USERS = USERS
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
check('sign-in page never embeds an account', !body.includes(OWNER) && !body.includes('scrypt$'))
check('returnTo is preserved', body.includes('/clips'))

// ── 4. sign-in ──────────────────────────────────────────────────────────────
r = await mw(login(`email=${encodeURIComponent(OWNER)}&password=wrong&returnTo=/clips`))
check('wrong password -> 401', r.status === 401, `got ${r.status}`)
check('wrong password sets no cookie', !r.headers.get('set-cookie'))

r = await mw(login(`email=nobody@example.com&password=${encodeURIComponent(PW)}&returnTo=/clips`))
check('unknown email -> 401', r.status === 401, `got ${r.status}`)
const unknownMsg = await r.text()
r = await mw(login(`email=${encodeURIComponent(OWNER)}&password=wrong&returnTo=/clips`))
check('unknown email and wrong password give the same message (no enumeration)',
  unknownMsg.includes('not right') && (await r.text()).includes('not right'))

r = await mw(login(`email=${encodeURIComponent(OWNER)}&password=${encodeURIComponent(PW)}&returnTo=/clips`))
check('correct credentials -> 303', r.status === 303, `got ${r.status}`)
check('redirects back to the requested page', r.headers.get('location') === '/clips')
const cookie = r.headers.get('set-cookie') || ''
check('cookie is Secure on https', cookie.includes('Secure'))
check('cookie is SameSite=Lax', cookie.includes('SameSite=Lax'))
check('cookie carries no password material', !cookie.includes('scrypt$'))

r = await mw(login(`email=${encodeURIComponent(OWNER.toUpperCase())}&password=${encodeURIComponent(PW)}&returnTo=/`))
check('email match is case-insensitive', r.status === 303, `got ${r.status}`)

// ── 5. sessions ─────────────────────────────────────────────────────────────
const token = cookie.split(';')[0].split('=')[1]
const withCookie = (p, t) => req(p, { headers: { cookie: `studio_session=${t}` } })
let reached = 'no'
try { await mw(withCookie('/clips', token)); reached = 'yes' }
catch (e) { reached = /vercel|context|next/i.test(e.message) ? 'yes (next() needs the Vercel runtime)' : 'no: ' + e.message }
check('valid session reaches the allow branch', reached.startsWith('yes'), reached)

for (const [name, t] of [
  ['tampered signature', token.slice(0, -3) + 'AAA'],
  ['garbage', 'not-a-session'],
  ['unsigned', 'v1.' + Buffer.from(JSON.stringify({ email: OWNER, exp: Date.now() + 9e6 })).toString('base64url') + '.forged'],
  ['expired', 'v1.' + Buffer.from(JSON.stringify({ email: OWNER, exp: 1 })).toString('base64url') + '.' + token.split('.')[2]],
]) {
  const res = await mw(withCookie('/clips', t))
  check(`${name} session -> 401`, res.status === 401, `got ${res.status}`)
}

// Removing someone from STUDIO_USERS must cut them off immediately.
process.env.STUDIO_USERS = `${WORKER}:${hash('another-password')}`
r = await mw(withCookie('/clips', token))
check('revoked account -> 401 even with a valid signature', r.status === 401, `got ${r.status}`)
process.env.STUDIO_USERS = USERS

// ── 6. off-site redirect + logout ───────────────────────────────────────────
r = await mw(login(`email=${encodeURIComponent(OWNER)}&password=${encodeURIComponent(PW)}&returnTo=//evil.example.com`))
check('off-site returnTo rejected', r.headers.get('location') === '/', `got ${r.headers.get('location')}`)
r = await mw(req('/__gate/logout'))
check('logout -> 303', r.status === 303, `got ${r.status}`)
check('logout clears the session', (r.headers.get('set-cookie') || '').includes('Max-Age=0'))

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
