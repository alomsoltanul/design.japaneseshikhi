import Anthropic from '@anthropic-ai/sdk'

export const ANTHROPIC_MODEL = 'claude-sonnet-4-6'

let client: Anthropic | null = null

export function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
  if (!client) client = new Anthropic({ apiKey })
  return client
}

/** Extract the first text block from a messages response. */
function textOf(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim()
}

/** Strip ```json fences a model may wrap output in, then return the JSON substring. */
function extractJson(raw: string): string {
  let s = raw.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) s = fence[1].trim()
  const start = s.search(/[[{]/)
  const lastObj = s.lastIndexOf('}')
  const lastArr = s.lastIndexOf(']')
  const end = Math.max(lastObj, lastArr)
  if (start >= 0 && end > start) s = s.slice(start, end + 1)
  return s
}

/**
 * Call Claude and parse a JSON object/array from the reply.
 * Throws if the model returns unparseable JSON.
 */
export async function generateJson<T>(opts: {
  system: string
  user: string
  maxTokens?: number
  temperature?: number
}): Promise<T> {
  const msg = await getAnthropic().messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    temperature: opts.temperature ?? 0.7,
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
  })
  const raw = textOf(msg)
  try {
    return JSON.parse(extractJson(raw)) as T
  } catch (e) {
    throw new Error(`Model did not return valid JSON: ${(e as Error).message}\n--- raw ---\n${raw.slice(0, 2000)}`)
  }
}
