// Tiny scene-state store for OBS auto-switching (Module 5).
// In-memory per serverless instance, with a /tmp mirror so it survives
// across different functions on the same machine during `vercel dev`.
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export type SceneId = 'question' | 'think' | 'answer' | 'feedback' | 'outro'
export const SCENES: SceneId[] = ['question', 'think', 'answer', 'feedback', 'outro']

export interface SceneState {
  scene: SceneId
  level?: string
  test?: number
  mondai?: number
  question?: number
  updatedAt: number
}

const file = path.join(os.tmpdir(), 'js-studio-scene-state.json')
let current: SceneState = { scene: 'question', updatedAt: Date.now() }

export async function setScene(next: Partial<SceneState> & { scene: SceneId }): Promise<SceneState> {
  current = { ...current, ...next, updatedAt: Date.now() }
  try {
    await fs.writeFile(file, JSON.stringify(current), 'utf8')
  } catch {
    /* best-effort mirror */
  }
  return current
}

export async function getScene(): Promise<SceneState> {
  try {
    const disk = JSON.parse(await fs.readFile(file, 'utf8')) as SceneState
    if (disk.updatedAt >= current.updatedAt) current = disk
  } catch {
    /* use in-memory */
  }
  return current
}
