#!/usr/bin/env node
// One-command dev for the content factory.
//   npm run factory
// Starts the Vercel functions server + the Vite SPA (with /api proxied to it),
// loads .env.local, and opens the Studio/Content Factory in your browser.
import { spawn } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { createConnection } from 'node:net'

const API_PORT = process.env.API_PORT || 3009
const SPA_PORT = process.env.SPA_PORT || 5180
const OPEN_URL = `http://localhost:${SPA_PORT}/listening`

// ── load .env.local ──
function loadEnv(file) {
  if (!existsSync(file)) return {}
  const env = {}
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}
const fileEnv = loadEnv('.env.local')
const env = { ...process.env, ...fileEnv }

if (!env.ANTHROPIC_API_KEY) {
  console.log('\n⚠  No ANTHROPIC_API_KEY found in .env.local.')
  console.log('   AI generation will fail until you add it. Copy .env.example → .env.local and fill it in.\n')
} else {
  console.log('✓ ANTHROPIC_API_KEY loaded from .env.local')
}

// ── spawn helpers ──
const procs = []
function run(name, cmd, args, extraEnv = {}) {
  const p = spawn(cmd, args, { env: { ...env, ...extraEnv }, shell: false })
  const tag = `[${name}] `
  p.stdout.on('data', d => process.stdout.write(tag + d.toString().replace(/\n(?!$)/g, '\n' + tag)))
  p.stderr.on('data', d => process.stderr.write(tag + d.toString().replace(/\n(?!$)/g, '\n' + tag)))
  p.on('exit', code => {
    console.log(`${tag}exited (${code})`)
    shutdown()
  })
  procs.push(p)
  return p
}
function shutdown() {
  for (const p of procs) {
    try { p.kill('SIGTERM') } catch { /* already gone */ }
  }
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

function waitForPort(port, cb, tries = 120) {
  const sock = createConnection({ port, host: '127.0.0.1' })
  sock.on('connect', () => { sock.destroy(); cb() })
  sock.on('error', () => {
    sock.destroy()
    if (tries <= 0) return
    setTimeout(() => waitForPort(port, cb, tries - 1), 1000)
  })
}

// ── start both servers ──
console.log(`\nStarting content factory…`)
console.log(`  functions → http://localhost:${API_PORT}`)
console.log(`  app       → ${OPEN_URL}\n`)

run('api', 'npx', ['vercel', 'dev', '--listen', String(API_PORT), '--yes'])
run('spa', 'npx', ['vite', '--port', String(SPA_PORT), '--strictPort'], {
  VITE_API_PROXY: `http://localhost:${API_PORT}`,
})

// open the browser once the SPA port is live
waitForPort(SPA_PORT, () => {
  console.log(`\n✓ Ready. Opening ${OPEN_URL}`)
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  spawn(opener, [OPEN_URL], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' }).unref()
})
