import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guard, bad } from '../_lib/http'
import { getScene, setScene, SCENES, type SceneId } from '../_lib/sceneState'

// Module 2/5 — current Studio scene state for OBS auto-switching.
//   GET  /api/studio/scene-state            -> { scene, level, test, mondai, question, updatedAt }
//   POST /api/studio/scene-state { scene }  -> updates current scene
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, ['GET', 'POST'])) return

  if (req.method === 'GET') {
    return res.status(200).json(await getScene())
  }

  const body = (typeof req.body === 'string' ? safeParse(req.body) : req.body) ?? {}
  const scene = String(body.scene || '') as SceneId
  if (!SCENES.includes(scene)) return bad(res, `scene must be one of ${SCENES.join(', ')}`)

  const next = await setScene({
    scene,
    level: body.level != null ? String(body.level) : undefined,
    test: body.test != null ? Number(body.test) : undefined,
    mondai: body.mondai != null ? Number(body.mondai) : undefined,
    question: body.question != null ? Number(body.question) : undefined,
  })
  res.status(200).json(next)
}

function safeParse(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
