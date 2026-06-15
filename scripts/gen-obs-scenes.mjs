#!/usr/bin/env node
// Generate an OBS Scene Collection JSON for the Studio Mode pipeline.
// Usage:
//   node scripts/gen-obs-scenes.mjs --level N5 --test 3 --mondai 1 --question 2 \
//        --base http://localhost:5173 --out obs/scenes-jlpt-content.json
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

const SCENES = [
  ['question', 'Question'],
  ['think', 'Think Time'],
  ['answer', 'Answer Reveal'],
  ['feedback', 'Feedback'],
  ['outro', 'Outro'],
]

const url = scene =>
  `${base}/listening/studio?level=${level}&test=${test}&mondai=${mondai}&question=${question}&scene=${scene}`

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
