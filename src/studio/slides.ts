// Offline social content: build carousel slides, caption, hashtags and a reel
// script deterministically from a question. No API call.
import { panelsOf, hasPanels, imageUrl, type LevelQuestion, type Panel } from './levels'

export interface CarouselSlide {
  slide: number
  type: 'hook' | 'listen' | 'options' | 'answer' | 'explain'
  text: string
  cta?: string
  imageUrl?: string
  panels?: Panel[]
}

export interface ReelSegment {
  time: string
  overlay: string
  action: 'show_question' | 'play_audio' | 'countdown' | 'reveal_answer' | 'show_feedback'
}

export interface SocialPack {
  caption: string
  hashtags: string[]
  carousel_slides: CarouselSlide[]
  reel_script: ReelSegment[]
}

function defaultHashtags(level: string): string[] {
  return ['#JLPT', `#JLPT${level}`, '#日本語', '#JapaneseLearning', '#LanguageLearning', '#StudyGram', '#Nihongo', '#LearnJapanese']
}

export function buildSlides(q: LevelQuestion): CarouselSlide[] {
  const correct = q.options.find(o => o.id === q.correct_option_id)
  const grid = hasPanels(q) ? panelsOf(q) : undefined
  return [
    { slide: 1, type: 'hook', text: `${q.question_text}\nCan you guess? 🤔`, imageUrl: imageUrl(q.image_file) ?? undefined, panels: grid },
    { slide: 2, type: 'listen', text: '🎧 Listen first!' },
    { slide: 3, type: 'options', text: q.options.map(o => `${o.id}. ${o.text}`).join('\n'), panels: grid },
    { slide: 4, type: 'answer', text: `✅ ${correct ? correct.text : ''}`, panels: grid },
    {
      slide: 5,
      type: 'explain',
      text: `${q.feedback.advice}\n\n💡 ${q.feedback.hint}`,
      cta: 'Follow @japaneseshikhi for daily JLPT practice',
    },
  ]
}

export function buildReel(): ReelSegment[] {
  return [
    { time: '0:00-0:02', overlay: 'Can you answer this?', action: 'show_question' },
    { time: '0:02-0:09', overlay: '🎧 Listen', action: 'play_audio' },
    { time: '0:09-0:14', overlay: 'Think!', action: 'countdown' },
    { time: '0:14-0:16', overlay: 'Answer', action: 'reveal_answer' },
    { time: '0:16-0:22', overlay: 'Here is why', action: 'show_feedback' },
  ]
}

export function buildCaption(q: LevelQuestion, level: string): string {
  if (q.social?.caption) return q.social.caption
  return `Can you catch the answer to this ${level} listening question? 🎧\n${q.question_text_en}\nGuess before the reveal — train your ear! 💪`
}

export function buildSocialPack(q: LevelQuestion, level: string): SocialPack {
  return {
    caption: buildCaption(q, level),
    hashtags: q.social?.hashtags?.length ? q.social.hashtags : defaultHashtags(level),
    carousel_slides: buildSlides(q),
    reel_script: buildReel(),
  }
}
