/**
 * Behaviour checks for the site access gate in middleware.ts.
 * Run: npm run check:gate
 *
 * Node 24 strips the TypeScript types on import, so the middleware is exercised
 * directly with no build step and no test-runner dependency.
 */
const mw = (await import('../middleware.ts')).default
const H = { 'content-type': 'application/x-www-form-urlencoded' }
const req = (path, opts = {}) => new Request('https://designjapaneseshikhi.vercel.app' + path, opts)
let pass = 0, fail = 0
const check = (name, ok, detail = '') => { ok ? (pass++, console.log('  ok   ' + name)) : (fail++, console.log(`  FAIL ${name} ${detail}`)) }

// 1. fails closed with no configuration
delete process.env.SITE_PASSWORD; delete process.env.SESSION_SECRET
let r = await mw(req('/'))
check('unconfigured fails closed (503)', r.status === 503, `got ${r.status}`)
check('unconfigured still says noindex', r.headers.get('x-robots-tag')?.includes('noindex'))

process.env.SITE_PASSWORD = 'correct horse battery staple'
process.env.SESSION_SECRET = 'test-secret-value-for-signing-only'
process.env.OBS_ACCESS_TOKEN = 'obs-token-123'

// 2. robots.txt is reachable without the gate
r = await mw(req('/robots.txt'))
check('robots.txt served ungated', r.status === 200)
check('robots.txt allows crawl so noindex is visible', (await r.text()).includes('Allow: /'))

// 3. anonymous requests are refused everywhere
for (const p of ['/', '/clips', '/subtitles', '/api/tts/azure', '/assets/index.js', '/manifest.json']) {
  const res = await mw(req(p))
  check(`anonymous ${p} -> 401`, res.status === 401, `got ${res.status}`)
}
r = await mw(req('/clips'))
const body = await r.text()
check('401 body is the gate, not app content', body.includes('Access password'))
check('401 is not cached', r.headers.get('cache-control')?.includes('no-store'))
check('401 carries noindex', r.headers.get('x-robots-tag')?.includes('noindex'))

// 4. wrong password
r = await mw(req('/__gate/login', { method: 'POST', headers: H, body: 'password=wrong&returnTo=/clips' }))
check('wrong password -> 401', r.status === 401, `got ${r.status}`)
check('wrong password sets no cookie', !r.headers.get('set-cookie'))

// 5. right password
r = await mw(req('/__gate/login', { method: 'POST', headers: H, body: 'password=' + encodeURIComponent('correct horse battery staple') + '&returnTo=/clips' }))
check('right password -> 303', r.status === 303, `got ${r.status}`)
check('redirects back to the requested page', r.headers.get('location') === '/clips')
const cookie = r.headers.get('set-cookie') || ''
check('cookie is HttpOnly', cookie.includes('HttpOnly'))
check('cookie is Secure on https', cookie.includes('Secure'))
check('cookie is SameSite=Lax', cookie.includes('SameSite=Lax'))

// 6. open redirect is refused
r = await mw(req('/__gate/login', { method: 'POST', headers: H, body: 'password=' + encodeURIComponent('correct horse battery staple') + '&returnTo=//evil.example.com' }))
check('off-site returnTo rejected', r.headers.get('location') === '/', `got ${r.headers.get('location')}`)

// 7. the issued cookie is accepted, a tampered one is not
const token = cookie.split(';')[0].split('=')[1]
const withCookie = (p, t) => req(p, { headers: { cookie: `js_gate=${t}` } })
let reached = 'no'
try { await mw(withCookie('/clips', token)); reached = 'yes' }
catch (e) { reached = /vercel|context|next/i.test(e.message) ? 'yes (next() needs the Vercel runtime)' : 'no: ' + e.message }
check('valid cookie reaches the allow branch', reached.startsWith('yes'), reached)

const tampered = token.slice(0, -3) + 'AAA'
r = await mw(withCookie('/clips', tampered))
check('tampered signature -> 401', r.status === 401, `got ${r.status}`)
r = await mw(withCookie('/clips', 'v1.' + (Date.now() + 999999) + '.forged'))
check('forged signature -> 401', r.status === 401, `got ${r.status}`)
r = await mw(withCookie('/clips', 'v1.1.' + token.split('.')[2]))
check('expired token -> 401', r.status === 401, `got ${r.status}`)

// 8. OBS token
r = await mw(req('/listening/studio?k=wrong'))
check('OBS wrong token -> 401', r.status === 401, `got ${r.status}`)
let obs = 'no'
try { await mw(req('/listening/studio?k=obs-token-123')); obs = 'yes' }
catch (e) { obs = /vercel|context|next/i.test(e.message) ? 'yes (next() needs the Vercel runtime)' : 'no: ' + e.message }
check('OBS correct token reaches allow branch', obs.startsWith('yes'), obs)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
