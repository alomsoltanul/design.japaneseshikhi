#!/usr/bin/env node
/**
 * Create a studio account in Firebase Auth.
 *
 *   npm run fbuser -- sister@example.com            # generates a password
 *   npm run fbuser -- sister@example.com "a pass"   # uses the one you give
 *
 * Reads FIREBASE_WEB_API_KEY from .env.local. Prints the password once and
 * reminds you to add the address to ALLOWED_EMAILS — signup is open by default
 * on a Firebase project, so the allowlist is what actually grants entry.
 *
 * People signing in with Google do not need an account created here; they only
 * need to be on ALLOWED_EMAILS.
 */
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)

const key = env.FIREBASE_WEB_API_KEY
if (!key) {
  console.error('FIREBASE_WEB_API_KEY is missing from .env.local')
  process.exit(1)
}

const [email, given] = process.argv.slice(2)
if (!email || !email.includes('@')) {
  console.error('Usage: npm run fbuser -- <email> [password]')
  process.exit(1)
}

const words = ['amber', 'basil', 'cedar', 'delta', 'ember', 'flint', 'grove', 'harbor',
  'indigo', 'jasper', 'maple', 'onyx', 'quartz', 'rowan', 'slate', 'willow', 'zephyr']
const pick = () => words[randomBytes(2).readUInt16BE(0) % words.length]
const password = given || `${pick()}-${pick()}-${pick()}-${randomBytes(1)[0] % 90 + 10}`

const res = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(key)}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password, returnSecureToken: true }),
  },
)
const data = await res.json()

if (!res.ok) {
  const msg = data?.error?.message || 'unknown error'
  console.error(msg === 'EMAIL_EXISTS'
    ? `\n${email} already has an account. Add them to ALLOWED_EMAILS if they cannot get in.\n`
    : `\nFirebase refused: ${msg}\n`)
  process.exit(1)
}

const current = env.ALLOWED_EMAILS || ''
const next = current ? `${current},${email.trim().toLowerCase()}` : email.trim().toLowerCase()

console.log(`\nCreated ${data.email} in Firebase Auth.`)
console.log('\nPassword (share it once, it is not recoverable):\n')
console.log('  ' + password)
console.log('\nNow add them to ALLOWED_EMAILS — in .env.local and in the Vercel project:\n')
console.log('  ALLOWED_EMAILS=' + next + '\n')
