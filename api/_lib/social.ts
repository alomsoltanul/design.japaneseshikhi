import { generateJson } from './anthropic'
import { socialPackSystemPrompt } from './prompts'
import { getJson, putJson, socialKey } from './store'
import type { ListeningQuestion } from './schema'

export interface CarouselSlide {
  slide: number
  type: 'hook' | 'listen' | 'options' | 'answer' | 'explain'
  text: string
  cta?: string
}

export interface ReelSegment {
  time: string
  overlay: string
  action: 'show_question' | 'play_audio' | 'countdown' | 'reveal_answer' | 'show_feedback'
}

export interface SocialPack {
  instagram_caption: string
  hashtags: string[]
  facebook_post: string
  carousel_slides: CarouselSlide[]
  reel_script: ReelSegment[]
}

/** Generate a social content pack for one question via Claude. */
export async function generateSocialPack(question: ListeningQuestion): Promise<SocialPack> {
  const pack = await generateJson<SocialPack>({
    system: socialPackSystemPrompt(),
    user: `Question JSON:\n${JSON.stringify(question)}`,
    maxTokens: 2048,
    temperature: 0.8,
  })
  return ensureShape(pack, question)
}

/**
 * Get a pack from cache, or generate + cache it. Used by carousel/bundle so they
 * don't re-call the model on every image request.
 */
export async function getOrCreateSocialPack(
  level: string,
  test: number,
  mondai: number,
  questionNum: number,
  question: ListeningQuestion,
): Promise<SocialPack> {
  const key = socialKey(level, test, mondai, questionNum)
  const cached = await getJson<SocialPack>(key)
  if (cached?.carousel_slides?.length === 5) return cached
  const pack = await generateSocialPack(question)
  await putJson(key, pack).catch(() => {})
  return pack
}

/** Guarantee 5 ordered slides + a deterministic fallback if the model drifts. */
function ensureShape(pack: SocialPack, q: ListeningQuestion): SocialPack {
  const slides = Array.isArray(pack.carousel_slides) ? pack.carousel_slides : []
  if (slides.length !== 5) {
    pack.carousel_slides = fallbackSlides(q)
  } else {
    pack.carousel_slides = slides
      .sort((a, b) => a.slide - b.slide)
      .map((s, i) => ({ ...s, slide: i + 1 }))
  }
  if (!Array.isArray(pack.hashtags) || pack.hashtags.length < 6) {
    pack.hashtags = ['#JLPT', '#日本語', '#JapaneseLearning', '#LanguageLearning', '#StudyGram', '#Nihongo']
  }
  if (!Array.isArray(pack.reel_script) || pack.reel_script.length === 0) {
    pack.reel_script = fallbackReel()
  }
  pack.instagram_caption ||= `Can you answer this JLPT question? ${q.question_text_en}`
  pack.facebook_post ||= pack.instagram_caption
  return pack
}

function fallbackSlides(q: ListeningQuestion): CarouselSlide[] {
  const correct = q.options.find(o => o.id === q.correct_option_id)
  return [
    { slide: 1, type: 'hook', text: `${q.question_text} — Can you guess?` },
    { slide: 2, type: 'listen', text: '🎧 Listen first!' },
    { slide: 3, type: 'options', text: q.options.map(o => `${o.id}. ${o.text}`).join('\n') },
    { slide: 4, type: 'answer', text: `✅ ${correct ? correct.text : ''}` },
    {
      slide: 5,
      type: 'explain',
      text: `${q.feedback.advice}\n${q.feedback.hint}`,
      cta: 'Follow for daily JLPT practice',
    },
  ]
}

function fallbackReel(): ReelSegment[] {
  return [
    { time: '0:00-0:02', overlay: 'Can you answer this?', action: 'show_question' },
    { time: '0:02-0:10', overlay: '🎧 Listen', action: 'play_audio' },
    { time: '0:10-0:15', overlay: 'Think!', action: 'countdown' },
    { time: '0:15-0:17', overlay: 'Answer', action: 'reveal_answer' },
    { time: '0:17-0:22', overlay: 'Here is why', action: 'show_feedback' },
  ]
}
