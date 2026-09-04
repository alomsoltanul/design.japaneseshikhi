import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import type { IncomingMessage, ServerResponse } from 'http'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { nadeshikoSearch } from './api/_lib/nadeshiko'
import { translateLines } from './api/_lib/translate'

/** Display names for the four reel languages, matching scripts/reel-frame.mjs. */
const LANG_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', bn: 'Bangla', vi: 'Vietnamese', ne: 'Nepali',
}

/**
 * Runs the ffmpeg pipeline for the Clip Finder's one-click export.
 *
 * Dev only, on purpose: it needs ffmpeg and headless Chrome on the machine, so
 * it cannot run on Vercel. The panel is used locally, which is where the render
 * belongs — the finished mp4 lands in reels/ next to the repo.
 */
async function renderReel(manifest: Record<string, unknown>) {
  const word = String(manifest?.word ?? '').trim()
  if (!word) throw Object.assign(new Error('Manifest has no word.'), { status: 400 })
  if (!Array.isArray(manifest?.clips) || !manifest.clips.length) {
    throw Object.assign(new Error('Manifest has no clips.'), { status: 400 })
  }
  const langs = (Array.isArray(manifest.langs) ? manifest.langs as string[] : ['en'])
    .map(l => String(l).toLowerCase())
    .filter(l => LANG_NAMES[l])
  if (!langs.length) throw Object.assign(new Error('Pick at least one subtitle language.'), { status: 400 })

  const slug = word.replace(/[^\p{L}\p{N}_-]/gu, '') || 'reel'
  const outDir = resolve(__dirname, 'reels')
  await mkdir(outDir, { recursive: true })
  const manifestPath = resolve(outDir, `${slug}-manifest.json`)
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')

  const log = await new Promise<string>((res, rej) => {
    const p = spawn(process.execPath, [
      resolve(__dirname, 'scripts/merge-reel.mjs'), manifestPath, '--lang', langs.join(','),
    ], { cwd: __dirname })
    let out = ''
    p.stdout.on('data', d => { out += d; process.stdout.write(d) })
    p.stderr.on('data', d => { out += d; process.stderr.write(d) })
    p.on('error', rej)
    // Nine clips download once, then encode per language; allow headroom.
    const kill = setTimeout(() => { p.kill('SIGKILL'); rej(new Error('Render timed out after 20 minutes.')) }, 1200000)
    p.on('close', code => {
      clearTimeout(kill)
      code === 0 ? res(out) : rej(new Error(`Render failed:\n${out.slice(-1500)}`))
    })
  })

  return {
    manifest: manifestPath,
    log,
    reels: langs.map(lang => {
      const video = resolve(outDir, `${slug}-reel-${lang}.mp4`)
      return {
        lang,
        name: LANG_NAMES[lang],
        video,
        subtitles: resolve(outDir, `${slug}-subtitles-${lang}.json`),
        // Vite serves files under the project root through /@fs, so the panel
        // can offer each finished mp4 as a download with no second copy.
        downloadUrl: `/@fs${video}`,
      }
    }),
  }
}

function clipsDevApi(env: Record<string, string>): Plugin {
  return {
    name: 'clips-dev-api',
    apply: 'serve',
    configureServer(server) {
      if (process.env.VITE_API_PROXY) return

      const readJson = (req: IncomingMessage) => new Promise<Record<string, unknown>>((res, rej) => {
        let buf = ''
        req.on('data', c => { buf += c })
        req.on('end', () => { try { res(buf ? JSON.parse(buf) : {}) } catch (e) { rej(e) } })
        req.on('error', rej)
      })

      const send = (res: ServerResponse, status: number, body: unknown) => {
        res.statusCode = status
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(body))
      }

      const routes: Record<string, (body: any) => Promise<unknown>> = {
        '/api/clips/search': body => nadeshikoSearch(body),
        '/api/clips/translate': body => translateLines(body || {}),
        '/api/clips/render': body => renderReel(body),
      }

      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0]
        const route = routes[path]
        if (!route) return next()
        if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }
        if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' })
        // Vite loads .env.local for VITE_* only; the API keys need to be on
        // process.env for the shared handlers to see them.
        for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v
        try {
          send(res, 200, await route(await readJson(req)))
        } catch (e) {
          const err = e as Error & { status?: number }
          console.error(`[clips-dev-api] ${path}:`, err.message)
          send(res, err.status ?? 500, { error: err.message })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), clipsDevApi(env)],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    base: '/',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    },
    server: {
      proxy: {
        '/api/voicevox': {
          target: 'http://127.0.0.1:50021',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/voicevox/, ''),
        },
        // Dev only: forward /api/* to the Vercel functions server (`vercel dev`).
        // Set VITE_API_PROXY=http://localhost:3009 to run the SPA on vite while
        // the serverless content-factory routes run under vercel dev.
        ...(process.env.VITE_API_PROXY
          ? { '/api': { target: process.env.VITE_API_PROXY, changeOrigin: true } }
          : {}),
      },
    },
  }
})
