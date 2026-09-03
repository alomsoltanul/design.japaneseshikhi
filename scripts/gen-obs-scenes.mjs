#!/usr/bin/env node
// Generate an OBS Scene Collection JSON for the Studio Mode pipeline.
// Usage:
//   node scripts/gen-obs-scenes.mjs --level N5 --test 3 --mondai 1 --question 2 \
//        --base http://localhost:5173 --out obs/scenes-jlpt-content.json
//
// Against the deployed site, pass --token: middleware.ts gates every route, and
// an OBS browser source cannot fill in the login form. The token is the
// OBS_ACCESS_TOKEN set in the Vercel project; it is read from the environment
// when the flag is omitted, so it need not appear in shell history.
//   OBS_ACCESS_TOKEN=... node scripts/gen-obs-scenes.mjs \
//        --base https://designjapaneseshikhi.vercel.app --out obs/scenes.json
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]])
    return acc
  }, []),
)

const level = args.level ?? 'N5'
const test = Number(args.test ?? 3)
const mondai = Number(args.mondai ?? 1)
const question = Number(args.question ?? 1)
const base = args.base ?? 'http://localhost:5173'
const out = args.out ?? 'obs/scenes-jlpt-content.json'
const token = args.token ?? process.env.OBS_ACCESS_TOKEN ?? ''

// Localhost runs through Vite, which never invokes the middleware, so the token
// is only needed — and only appended — for a deployed origin.
const needsToken = !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(base)
if (needsToken && !token) {
  console.warn(
    `! ${base} is gated by middleware.ts and no token was given.\n` +
    '  OBS will load the login page instead of the studio.\n' +
    '  Pass --token <OBS_ACCESS_TOKEN>, or export it before running.',
  )
}

const SCENES = [
  ['question', 'Question'],
  ['think', 'Think Time'],
  ['answer', 'Answer Reveal'],
  ['feedback', 'Feedback'],
  ['outro', 'Outro'],
]

const url = scene =>
  `${base}/listening/studio?level=${level}&test=${test}&mondai=${mondai}&question=${question}&scene=${scene}`
  + (needsToken && token ? `&k=${encodeURIComponent(token)}` : '')

const scene = ([id, name]) => ({
  name,
  sources: [
    {
      name: `${name} Browser`,
      id: 'browser_source',
      settings: {
        url: url(id),
        width: 1080,
        height: 1920,
        css: 'body { overflow: hidden; margin: 0; }',
        reroute_audio: true,
        restart_when_active: true,
      },
    },
  ],
})

const collection = {
  name: 'JLPT Content',
  current_scene: 'Question',
  scene_order: SCENES.map(([, name]) => ({ name })),
  scenes: SCENES.map(scene),
}

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(collection, null, 2))
console.log(`Wrote ${out} (${level} t${test} m${mondai} q${question}, base ${base})`)
