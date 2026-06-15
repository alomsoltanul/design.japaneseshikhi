import type { VercelRequest, VercelResponse } from '@vercel/node'

/** Permissive CORS for studio/OBS browser sources + same-origin fetches. */
export function applyCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

/** Handle preflight + method gate. Returns true if the request was already terminated. */
export function guard(req: VercelRequest, res: VercelResponse, methods: string[]): boolean {
  applyCors(res)
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  if (!methods.includes(req.method ?? '')) {
    res.status(405).json({ error: `Method ${req.method} not allowed. Use ${methods.join(', ')}.` })
    return true
  }
  return false
}

export function bad(res: VercelResponse, message: string, status = 400) {
  res.status(status).json({ error: message })
}

/** Coerce a query value (string | string[] | undefined) to a single string. */
export function q(value: string | string[] | undefined, fallback = ''): string {
  if (Array.isArray(value)) return value[0] ?? fallback
  return value ?? fallback
}

export function qNum(value: string | string[] | undefined, fallback: number): number {
  const n = Number(q(value))
  return Number.isFinite(n) ? n : fallback
}
