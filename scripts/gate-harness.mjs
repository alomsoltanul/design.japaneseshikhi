/** Shared plumbing for scripts/check-gate.mjs. */
export const mod = await import('../middleware.ts')
export const mw = mod.default

export const H = { 'content-type': 'application/x-www-form-urlencoded' }
export const req = (path, opts = {}) =>
  new Request('https://designjapaneseshikhi.vercel.app' + path, opts)

let pass = 0, fail = 0
export function check(name, ok, detail = '') {
  ok ? (pass++, console.log('  ok   ' + name))
     : (fail++, console.log(`  FAIL ${name} ${detail}`))
}
export function report() {
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
