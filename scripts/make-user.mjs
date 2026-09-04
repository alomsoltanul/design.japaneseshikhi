#!/usr/bin/env node
/**
 * Create a studio account entry for STUDIO_USERS.
 *
 *   npm run user -- someone@example.com            # generates a password
 *   npm run user -- someone@example.com "a pass"   # uses the one you give
 *
 * Prints the `email:scrypt$…` entry to append to STUDIO_USERS, and the
 * password once. Only the hash is ever stored, so the environment variable is
 * safe to keep in project settings.
 */
import { randomBytes, scryptSync } from 'node:crypto'

const [email, given] = process.argv.slice(2)
if (!email || !email.includes('@')) {
  console.error('Usage: npm run user -- <email> [password]')
  process.exit(1)
}

const words = ['amber', 'basil', 'cedar', 'delta', 'ember', 'flint', 'grove', 'harbor',
  'indigo', 'jasper', 'kite', 'linen', 'maple', 'nimbus', 'onyx', 'pepper',
  'quartz', 'rowan', 'slate', 'thistle', 'umber', 'violet', 'willow', 'zephyr']
const pick = () => words[randomBytes(2).readUInt16BE(0) % words.length]
const password = given || `${pick()}-${pick()}-${pick()}-${randomBytes(1)[0] % 90 + 10}`

const N = 16384, r = 8, p = 1
const salt = randomBytes(16)
const hash = scryptSync(password, salt, 64, { N, r, p, maxmem: 256 * 1024 * 1024 })
const entry = `${email.trim().toLowerCase()}:scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${hash.toString('hex')}`

console.log('\nPassword (share it once, it is not recoverable):\n')
console.log('  ' + password)
console.log('\nAppend this to STUDIO_USERS (comma-separate multiple people):\n')
console.log('  ' + entry + '\n')
