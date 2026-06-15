#!/usr/bin/env node
/**
 * OBS auto-switch driver (Module 5).
 * Polls the Studio scene-state endpoint and switches the OBS program scene to match,
 * so Studio Mode's keyboard/auto-advance navigation drives the recording.
 *
 * Requires: obs-websocket-js v5  (npm i obs-websocket-js)
 * Enable in OBS: Tools -> WebSocket Server Settings -> Enable.
 *
 * Env:
 *   OBS_URL       default ws://127.0.0.1:4455
 *   OBS_PASSWORD  WebSocket server password (if set)
 *   APP_URL       default http://localhost:5173  (where /api/studio/scene-state lives)
 *   POLL_MS       default 500
 */
import OBSWebSocket from 'obs-websocket-js'

const OBS_URL = process.env.OBS_URL || 'ws://127.0.0.1:4455'
const OBS_PASSWORD = process.env.OBS_PASSWORD || undefined
const APP_URL = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')
const POLL_MS = Number(process.env.POLL_MS || 500)

// Maps scene-state ids -> OBS scene names (must match the Scene Collection).
const SCENE_NAME = {
  question: 'Question',
  think: 'Think Time',
  answer: 'Answer Reveal',
  feedback: 'Feedback',
  outro: 'Outro',
}

const obs = new OBSWebSocket()
let lastScene = null

function ts() {
  return new Date().toISOString().slice(11, 23)
}

async function poll() {
  let state
  try {
    const res = await fetch(`${APP_URL}/api/studio/scene-state`)
    state = await res.json()
  } catch (e) {
    console.error(`[${ts()}] poll failed: ${e.message}`)
    return
  }
  const target = SCENE_NAME[state.scene]
  if (!target || target === lastScene) return

  try {
    await obs.call('SetCurrentProgramScene', { sceneName: target })
    console.log(`[${ts()}] switch -> "${target}" (q${state.question ?? '?'})`)
    lastScene = target
  } catch (e) {
    console.error(`[${ts()}] SetCurrentProgramScene("${target}") failed: ${e.message}`)
  }
}

async function main() {
  await obs.connect(OBS_URL, OBS_PASSWORD)
  console.log(`[${ts()}] connected to OBS at ${OBS_URL}; polling ${APP_URL} every ${POLL_MS}ms`)
  // Sync once immediately, then on an interval.
  await poll()
  setInterval(poll, POLL_MS)
}

obs.on('ConnectionClosed', () => {
  console.error(`[${ts()}] OBS connection closed. Exiting.`)
  process.exit(1)
})

main().catch(e => {
  console.error(`[${ts()}] fatal: ${e.message}`)
  process.exit(1)
})
