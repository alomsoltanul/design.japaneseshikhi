// OBS scene-collection helpers (Module 5 + the single-scene snippet in Module 6).
import { SCENES, type SceneId } from './sceneState'

export interface ObsParams {
  level: string
  test: number
  mondai: number
  question: number
  /** Base URL of the Studio app, e.g. http://localhost:5173 or https://app.example.com */
  baseUrl?: string
}

const SCENE_LABEL: Record<SceneId, string> = {
  question: 'Question',
  think: 'Think Time',
  answer: 'Answer Reveal',
  feedback: 'Feedback',
  outro: 'Outro',
}

const BROWSER_CSS = 'body { overflow: hidden; margin: 0; }'

function studioUrl(p: ObsParams, scene: SceneId): string {
  const base = p.baseUrl ?? 'http://localhost:5173'
  return `${base}/listening/studio?level=${p.level}&test=${p.test}&mondai=${p.mondai}&question=${p.question}&scene=${scene}`
}

/** One OBS scene = one Browser Source (1080x1920). */
export function buildScene(p: ObsParams, scene: SceneId) {
  return {
    name: SCENE_LABEL[scene],
    sources: [
      {
        name: `${SCENE_LABEL[scene]} Browser`,
        id: 'browser_source',
        settings: {
          url: studioUrl(p, scene),
          width: 1080,
          height: 1920,
          css: BROWSER_CSS,
          reroute_audio: true,
          restart_when_active: true,
        },
      },
    ],
  }
}

/** Full OBS Scene Collection JSON (importable as scenes-jlpt-content.json). */
export function buildCollection(p: ObsParams) {
  return {
    name: 'JLPT Content',
    current_scene: SCENE_LABEL.question,
    scene_order: SCENES.map(s => ({ name: SCENE_LABEL[s] })),
    scenes: SCENES.map(s => buildScene(p, s)),
  }
}
