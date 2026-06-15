import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ListeningTest } from './schema'

/**
 * Content store with two backends:
 *  - Supabase Storage when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set
 *  - Local /tmp file cache otherwise (so the pipeline is testable without credentials)
 *
 * Layout (bucket = SUPABASE_BUCKET, default "content"):
 *   content/listening/{level}/t{test}_m{mondai}.json   -> generated ListeningTest
 *   content/social/{level}/t{test}_m{mondai}_q{q}.json -> cached SocialPack
 * Audio (bucket = SUPABASE_AUDIO_BUCKET, default same as content):
 *   mock-audio/listening/{level}/{audio_file}
 */

const BUCKET = process.env.SUPABASE_BUCKET ?? 'content'
const AUDIO_BUCKET = process.env.SUPABASE_AUDIO_BUCKET ?? BUCKET

let supabase: SupabaseClient | null = null

export function hasSupabase(): boolean {
  return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY))
}

function getClient(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL!
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY!
    supabase = createClient(url, key, { auth: { persistSession: false } })
  }
  return supabase
}

const tmpDir = path.join(os.tmpdir(), 'js-content-factory')

function tmpPath(key: string): string {
  return path.join(tmpDir, key.replace(/[/\\]/g, '__'))
}

async function putJsonLocal(key: string, value: unknown): Promise<void> {
  await fs.mkdir(tmpDir, { recursive: true })
  await fs.writeFile(tmpPath(key), JSON.stringify(value), 'utf8')
}

async function getJsonLocal<T>(key: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(tmpPath(key), 'utf8')) as T
  } catch {
    return null
  }
}

export async function putJson(key: string, value: unknown): Promise<void> {
  if (!hasSupabase()) return putJsonLocal(key, value)
  const body = new Blob([JSON.stringify(value)], { type: 'application/json' })
  const { error } = await getClient().storage.from(BUCKET).upload(key, body, {
    contentType: 'application/json',
    upsert: true,
  })
  if (error) throw new Error(`store.putJson(${key}): ${error.message}`)
}

export async function getJson<T>(key: string): Promise<T | null> {
  if (!hasSupabase()) return getJsonLocal<T>(key)
  const { data, error } = await getClient().storage.from(BUCKET).download(key)
  if (error || !data) return null
  return JSON.parse(await data.text()) as T
}

/** Fetch audio bytes; null if missing or no Supabase. */
export async function getAudio(level: string, audioFile: string): Promise<Buffer | null> {
  const key = `mock-audio/listening/${level}/${audioFile}`
  if (!hasSupabase()) return null
  const { data, error } = await getClient().storage.from(AUDIO_BUCKET).download(key)
  if (error || !data) return null
  return Buffer.from(await data.arrayBuffer())
}

/** Public URL for an audio file (used by the Studio play button). */
export function audioPublicUrl(level: string, audioFile: string): string | null {
  const key = `mock-audio/listening/${level}/${audioFile}`
  if (!hasSupabase()) return null
  return getClient().storage.from(AUDIO_BUCKET).getPublicUrl(key).data.publicUrl
}

// ── Key builders ──
export function testKey(level: string, test: number, mondai: number): string {
  return `content/listening/${level}/t${test}_m${mondai}.json`
}
export function socialKey(level: string, test: number, mondai: number, q: number): string {
  return `content/social/${level}/t${test}_m${mondai}_q${q}.json`
}

export async function loadTest(level: string, test: number, mondai: number): Promise<ListeningTest | null> {
  return getJson<ListeningTest>(testKey(level, test, mondai))
}
export async function saveTest(level: string, test: number, mondai: number, t: ListeningTest): Promise<void> {
  return putJson(testKey(level, test, mondai), t)
}
