import { loadTest } from './store'
import { findQuestion, type ListeningQuestion } from './schema'
import { getOrCreateSocialPack, type SocialPack } from './social'

export interface Resolved {
  level: string
  test: number
  mondai: number
  questionNum: number
  question: ListeningQuestion
}

/** Load the stored test and pull one question. Throws a typed message if missing. */
export async function resolveQuestion(
  level: string,
  test: number,
  mondai: number,
  questionNum: number,
): Promise<Resolved> {
  const data = await loadTest(level, test, mondai)
  if (!data) throw new NotFound(`No content for ${level} t${test} m${mondai}. Generate it first.`)
  const question = findQuestion(data, mondai, questionNum)
  if (!question) throw new NotFound(`question ${questionNum} not found`)
  return { level, test, mondai, questionNum, question }
}

export async function resolvePack(r: Resolved): Promise<SocialPack> {
  return getOrCreateSocialPack(r.level, r.test, r.mondai, r.questionNum, r.question)
}

export class NotFound extends Error {}
