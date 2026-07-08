import React, { createContext, useContext, useState, useMemo, useEffect, useRef, useCallback } from 'react'
import type {
  TrackContextValue, Tweaks, Track, TrackLine,
  MondaiType, TrackLength, TrackStatus, JlptLevel, Theme, Question, CustomMondai
} from './types'
import { synthesizeJlpt, checkHealth } from './voicevox'
import { AudioEngine } from './audioEngine'
import { getScenarioImage, getDefaultScenarioImage } from './scenarios'
import { VOICEVOX_SPEAKERS, getDefaultVoiceId, getSpeakerColor } from './voicevoxSpeakers'
import { getJlptProfile, computePauseForLine } from './jlptConfig'

const TrackContext = createContext<TrackContextValue | null>(null)

export const useTrack = () => {
  const ctx = useContext(TrackContext)
  if (!ctx) throw new Error('useTrack outside TrackProvider')
  return ctx
}

/* ── default speaker mapping for legacy prefixes ── */
const PREFIX_MAP: Record<string, { name: string; voiceId: number }> = {
  '店員': { name: '雨晴はう', voiceId: 10 },
  'shop': { name: '雨晴はう', voiceId: 10 },
  // Female variants — spread across different voices so two women never clash by default
  '女': { name: '春日部つむぎ', voiceId: 8 },
  'woman': { name: '雨晴はう', voiceId: 10 },
  'female': { name: '四国めたん', voiceId: 2 },
  'female1': { name: '四国めたん', voiceId: 2 },
  'female2': { name: '雨晴はう', voiceId: 10 },
  'female3': { name: '春日部つむぎ', voiceId: 8 },
  'woman1': { name: '雨晴はう', voiceId: 10 },
  'woman2': { name: '冥鳴ひまり', voiceId: 14 },
  '女1': { name: '春日部つむぎ', voiceId: 8 },
  '女2': { name: '冥鳴ひまり', voiceId: 14 },
  // Male variants
  '男': { name: '玄野武宏', voiceId: 11 },
  'man': { name: '青山龍星', voiceId: 13 },
  'male': { name: '玄野武宏', voiceId: 11 },
  'male1': { name: '玄野武宏', voiceId: 11 },
  'male2': { name: '青山龍星', voiceId: 13 },
  'man1': { name: '青山龍星', voiceId: 13 },
  'man2': { name: '白上虎太郎', voiceId: 12 },
  '男1': { name: '玄野武宏', voiceId: 11 },
  '男2': { name: '青山龍星', voiceId: 13 },
  // Other roles
  '先生': { name: '冥鳴ひまり', voiceId: 14 },
  'teacher': { name: '冥鳴ひまり', voiceId: 14 },
  'ナレーター': { name: '九州そら', voiceId: 16 },
  'narrator': { name: '九州そら', voiceId: 16 },
  'n': { name: '九州そら', voiceId: 16 },
  'ずんだもん': { name: 'ずんだもん', voiceId: 3 },
  'zundamon': { name: 'ずんだもん', voiceId: 3 },
}

/* ── rotation pool for unknown prefixes ── */
const VOICE_POOL = [
  { name: '四国めたん', voiceId: 2 },
  { name: '玄野武宏', voiceId: 11 },
  { name: '雨晴はう', voiceId: 10 },
  { name: '青山龍星', voiceId: 13 },
  { name: '春日部つむぎ', voiceId: 8 },
  { name: '白上虎太郎', voiceId: 12 },
  { name: '冥鳴ひまり', voiceId: 14 },
  { name: '九州そら', voiceId: 16 },
  { name: '波音リツ', voiceId: 9 },
  { name: 'ちび式じい', voiceId: 42 },
]

/* ── templates ── */
interface LineTemplate { speaker: string; style: string; voiceId: number; jp: string; bn: string; pauseAfter: number }
interface QuestionTemplate {
  jp: string
  options: { k: string; jp: string; bn: string; correct?: boolean; imageUrl?: string }[]
  explanation_bn: string
}
interface Template {
  title_jp: string
  title_bn: string
  mondai: string
  scenarioImage?: string
  lines: LineTemplate[]
  question: QuestionTemplate
}
type Templates = Partial<Record<MondaiType, Partial<Record<TrackLength, Template>>>>

const TEMPLATES: Templates = {
  1: {
    short: {
      title_jp: '会議の準備', title_bn: 'মিটিং প্রস্তুতি', mondai: 'もんだい1 · 課題理解',
      scenarioImage: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80',
      lines: [
        { speaker: '九州そら', style: 'ノーマル', voiceId: 16, jp: '会社で男の人と女の人が話しています。男の人はこのあと何をしますか。', bn: 'অফিসে এক পুরুষ ও মহিলা কথা বলছেন। পুরুষটি এরপর কী করবেন?', pauseAfter: 800 },
        { speaker: '四国めたん', style: 'ノーマル', voiceId: 2, jp: '田中さん、会議の資料はもうコピーしましたか。', bn: 'তানাকা সান, মিটিংয়ের ডকুমেন্ট কপি করেছেন?', pauseAfter: 600 },
        { speaker: '玄野武宏', style: 'ノーマル', voiceId: 11, jp: 'すみません、まだです。今からします。', bn: 'দুঃখিত, এখনো করিনি। এখনই করছি।', pauseAfter: 600 },
        { speaker: '四国めたん', style: 'ノーマル', voiceId: 2, jp: 'コピーの前に、参加者にメールを送ってください。', bn: 'কপি করার আগে অংশগ্রহণকারীদের ইমেইল পাঠান।', pauseAfter: 1400 },
        { speaker: '九州そら', style: 'ノーマル', voiceId: 16, jp: '男の人はこのあとまず何をしますか。', bn: 'পুরুষটি প্রথমে কী করবেন?', pauseAfter: 6000 },
      ],
      question: {
        jp: '男の人はこのあとまず何をしますか。',
        options: [
          { k: 'A', jp: '資料をコピーする', bn: 'ডকুমেন্ট কপি করা' },
          { k: 'B', jp: '参加者にメールする', bn: 'অংশগ্রহণকারীদের মেইল', correct: true },
          { k: 'C', jp: '会議室に行く', bn: 'মিটিং রুমে যাওয়া' },
          { k: 'D', jp: '部長に電話する', bn: 'বসকে ফোন' },
        ],
        explanation_bn: 'মহিলা স্পষ্ট নির্দেশ দিয়েছেন: "コピーの前に、メールを送ってください" — তাই সঠিক উত্তর B।',
      },
    },
  },
  2: {
    short: {
      title_jp: '喫茶店で', title_bn: 'কফি শপে অর্ডার', mondai: 'もんだい2 · ポイント理解',
      scenarioImage: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1200&q=80',
      lines: [
        { speaker: '九州そら', style: 'ノーマル', voiceId: 16, jp: '喫茶店で女の人と店員が話しています。', bn: 'কফি শপে এক মহিলা এবং দোকানদার কথা বলছেন।', pauseAfter: 800 },
        { speaker: '雨晴はう', style: 'ノーマル', voiceId: 10, jp: 'いらっしゃいませ。ご注文はお決まりですか。', bn: 'স্বাগতম। অর্ডার ঠিক করেছেন?', pauseAfter: 500 },
        { speaker: '四国めたん', style: 'ノーマル', voiceId: 2, jp: 'はい、ホットコーヒーを一つお願いします。', bn: 'হ্যাঁ, একটা হট কফি দিন।', pauseAfter: 500 },
        { speaker: '雨晴はう', style: 'ノーマル', voiceId: 10, jp: 'かしこまりました。サイズはどうなさいますか。', bn: 'ঠিক আছে। সাইজ কী হবে?', pauseAfter: 500 },
        { speaker: '四国めたん', style: 'ノーマル', voiceId: 2, jp: 'Mサイズで、ミルクは入れないでください。', bn: 'M সাইজ, দুধ ছাড়া।', pauseAfter: 1400 },
        { speaker: '九州そら', style: 'ノーマル', voiceId: 16, jp: '女の人は何を注文しましたか。', bn: 'মহিলা কী অর্ডার করেছেন?', pauseAfter: 6000 },
      ],
      question: {
        jp: '女の人は何を注文しましたか。',
        options: [
          { k: 'A', jp: 'アイスコーヒー', bn: 'আইস কফি' },
          { k: 'B', jp: 'ホットコーヒー、Mサイズ、ミルクなし', bn: 'হট কফি, M, দুধ ছাড়া', correct: true },
          { k: 'C', jp: 'ホットコーヒー、Sサイズ', bn: 'হট কফি, S সাইজ' },
          { k: 'D', jp: '紅茶', bn: 'চা' },
        ],
        explanation_bn: 'মহিলা স্পষ্টভাবে বলেছেন "ホットコーヒー", "Mサイズ", এবং "ミルクは入れないで"। তাই সঠিক উত্তর B।',
      },
    },
    medium: {
      title_jp: '駅で道を聞く', title_bn: 'স্টেশনে রাস্তা জিজ্ঞেস', mondai: 'もんだい2 · ポイント理解',
      scenarioImage: 'https://images.unsplash.com/photo-1535535112387-56ffe8db21ff?w=1200&q=80',
      lines: [
        { speaker: '九州そら', style: 'ノーマル', voiceId: 16, jp: '駅で女の人と男の人が話しています。', bn: 'স্টেশনে এক মহিলা ও পুরুষ কথা বলছেন।', pauseAfter: 800 },
        { speaker: '四国めたん', style: 'ノーマル', voiceId: 2, jp: 'すみません、東京駅へ行きたいんですが。', bn: 'মাফ করবেন, আমি টোকিও স্টেশন যেতে চাই।', pauseAfter: 500 },
        { speaker: '玄野武宏', style: 'ノーマル', voiceId: 11, jp: 'あ、それなら、ここから2番線です。', bn: 'আহ্, তাহলে এখান থেকে ২ নম্বর প্ল্যাটফর্ম।', pauseAfter: 500 },
        { speaker: '四国めたん', style: 'ノーマル', voiceId: 2, jp: '何分くらいかかりますか。', bn: 'কত মিনিট লাগবে?', pauseAfter: 500 },
        { speaker: '玄野武宏', style: 'ノーマル', voiceId: 11, jp: 'えっと、急行で15分くらいですね。', bn: 'উঁহু, এক্সপ্রেসে প্রায় ১৫ মিনিট।', pauseAfter: 500 },
        { speaker: '四国めたん', style: 'ノーマル', voiceId: 2, jp: '次の電車は何時ですか。', bn: 'পরের ট্রেন কখন?', pauseAfter: 500 },
        { speaker: '玄野武宏', style: 'ノーマル', voiceId: 11, jp: '3時12分の発車です。', bn: '৩টা ১২ মিনিটে ছাড়বে।', pauseAfter: 1400 },
        { speaker: '九州そら', style: 'ノーマル', voiceId: 16, jp: '次の電車は何時に出ますか。', bn: 'পরের ট্রেন কখন ছাড়বে?', pauseAfter: 6000 },
      ],
      question: {
        jp: '次の電車は何時に出ますか。',
        options: [
          { k: 'A', jp: '3時2分', bn: '৩:০২' },
          { k: 'B', jp: '3時12分', bn: '৩:১২', correct: true },
          { k: 'C', jp: '3時20分', bn: '৩:২০' },
          { k: 'D', jp: '3時15分', bn: '৩:১৫' },
        ],
        explanation_bn: 'পুরুষটি স্পষ্ট বলেছেন "3時12分の発車" — তাই সঠিক উত্তর B।',
      },
    },
  },
  3: {
    medium: {
      title_jp: 'お知らせ', title_bn: 'ঘোষণা', mondai: 'もんだい3 · 概要理解',
      scenarioImage: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=1200&q=80',
      lines: [
        { speaker: '九州そら', style: 'ノーマル', voiceId: 16, jp: 'スーパーで店内放送が流れています。', bn: 'সুপারমার্কেটে ইনস্টোর ঘোষণা চলছে।', pauseAfter: 800 },
        { speaker: '雨晴はう', style: 'ノーマル', voiceId: 10, jp: 'お客様にお知らせいたします。', bn: 'গ্রাহকদের জন্য ঘোষণা।', pauseAfter: 400 },
        { speaker: '雨晴はう', style: 'ノーマル', voiceId: 10, jp: '本日3時より、地下1階の鮮魚売り場で、', bn: 'আজ ৩টা থেকে আন্ডারগ্রাউন্ড ১-এর মাছের সেকশনে,', pauseAfter: 400 },
        { speaker: '雨晴はう', style: 'ノーマル', voiceId: 10, jp: '北海道直送のホタテを特別価格で販売いたします。', bn: 'হোক্কাইডো থেকে আনা স্ক্যালপ বিশেষ দামে বিক্রি হবে।', pauseAfter: 400 },
        { speaker: '雨晴はう', style: 'ノーマル', voiceId: 10, jp: 'なお、お一人様3パックまでとさせていただきます。', bn: 'একজন সর্বোচ্চ ৩ প্যাক নিতে পারবেন।', pauseAfter: 1400 },
        { speaker: '九州そら', style: 'ノーマル', voiceId: 16, jp: 'このお知らせは何についてですか。', bn: 'এই ঘোষণা কী সম্পর্কে?', pauseAfter: 6000 },
      ],
      question: {
        jp: 'このお知らせは何についてですか。',
        options: [
          { k: 'A', jp: '店の閉店時間', bn: 'দোকান বন্ধের সময়' },
          { k: 'B', jp: '魚の特売', bn: 'মাছের বিশেষ ছাড়', correct: true },
          { k: 'C', jp: '新商品の発売', bn: 'নতুন পণ্য' },
          { k: 'D', jp: '会員カード', bn: 'মেম্বারশিপ কার্ড' },
        ],
        explanation_bn: 'পুরো ঘোষণাটি স্ক্যালপের বিশেষ মূল্যে বিক্রি সম্পর্কে — গিস্ট হলো মাছের সেল।',
      },
    },
  },
  4: {
    short: {
      title_jp: '即時応答', title_bn: 'তাৎক্ষণিক প্রতিক্রিয়া', mondai: 'もんだい4 · 即時応答',
      scenarioImage: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200&q=80',
      lines: [
        { speaker: '九州そら', style: 'ノーマル', voiceId: 16, jp: '会社で同僚に声をかけられました。何と答えますか。', bn: 'অফিসে সহকর্মী ডাকল। কী উত্তর দেবেন?', pauseAfter: 600 },
        { speaker: '四国めたん', style: 'ノーマル', voiceId: 2, jp: 'お先に失礼します。', bn: 'আমি আগে যাচ্ছি।', pauseAfter: 4000 },
      ],
      question: {
        jp: 'これに対する正しい応答はどれですか。',
        options: [
          { k: 'A', jp: 'おかえりなさい。', bn: 'স্বাগতম (ঘরে ফেরার সময়)।' },
          { k: 'B', jp: 'お疲れさまでした。', bn: 'কষ্ট করেছেন (কাজ শেষে)।', correct: true },
          { k: 'C', jp: 'ごちそうさま。', bn: 'খাওয়া শেষ (খাওয়ার পর)।' },
        ],
        explanation_bn: 'কেউ "お先に失礼します" (আগে যাচ্ছি) বললে স্ট্যান্ডার্ড উত্তর "お疲れさまでした"।',
      },
    },
  },
  5: {
    long: {
      title_jp: '旅行の計画', title_bn: 'ভ্রমণ পরিকল্পনা', mondai: 'もんだい5 · 統合理解',
      scenarioImage: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80',
      lines: [
        { speaker: '九州そら', style: 'ノーマル', voiceId: 16, jp: '家族で旅行の計画を話し合っています。', bn: 'পরিবার ভ্রমণের পরিকল্পনা করছে।', pauseAfter: 800 },
        { speaker: '玄野武宏', style: 'ノーマル', voiceId: 11, jp: '今年の夏はどこに行く?海とか温泉とかいろいろあるけど。', bn: 'এ গ্রীষ্মে কোথায় যাব? সমুদ্র, গরম স্প্রিং, অনেক কিছু আছে।', pauseAfter: 500 },
        { speaker: '四国めたん', style: 'ノーマル', voiceId: 2, jp: '私は去年も海に行ったから、今年は温泉がいいな。', bn: 'গত বছর তো সমুদ্রে গেছি, এবার গরম স্প্রিং ভালো হবে।', pauseAfter: 500 },
        { speaker: '冥鳴ひまり', style: 'ノーマル', voiceId: 14, jp: '温泉もいいけど、子どもが退屈するんじゃない?', bn: 'গরম স্প্রিং ভালো, কিন্তু বাচ্চারা বিরক্ত হবে না?', pauseAfter: 500 },
        { speaker: '四国めたん', style: 'ノーマル', voiceId: 2, jp: 'じゃあ、温泉とテーマパークの両方ある所はどう?', bn: 'তাহলে দুটোই আছে এমন জায়গা কেমন?', pauseAfter: 500 },
        { speaker: '玄野武宏', style: 'ノーマル', voiceId: 11, jp: 'いいね、箱根なら近いし、両方楽しめる。', bn: 'ভালো, হাকোনে কাছে, দুটোই উপভোগ করা যাবে।', pauseAfter: 500 },
        { speaker: '冥鳴ひまり', style: 'ノーマル', voiceId: 14, jp: 'じゃあ、箱根に決めましょう。', bn: 'তাহলে হাকোনে ঠিক করি।', pauseAfter: 1400 },
        { speaker: '九州そら', style: 'ノーマル', voiceId: 16, jp: '家族はどこに行くことにしましたか。', bn: 'পরিবার কোথায় যাবে ঠিক করল?', pauseAfter: 6000 },
      ],
      question: {
        jp: '家族はどこへ行くことにしましたか。',
        options: [
          { k: 'A', jp: '海', bn: 'সমুদ্র' },
          { k: 'B', jp: '箱根', bn: 'হাকোনে', correct: true },
          { k: 'C', jp: 'テーマパークだけ', bn: 'শুধু থিম পার্ক' },
          { k: 'D', jp: '決まらなかった', bn: 'ঠিক হয়নি' },
        ],
        explanation_bn: 'সবশেষে সবাই একমত হয়ে "箱根に決めましょう" বলেছে — হাকোনে চূড়ান্ত হয়েছে।',
      },
    },
  },
}

function pickTemplate(mondai: MondaiType, length: TrackLength): Template {
  const m = TEMPLATES[mondai] ?? TEMPLATES[2]!
  return m[length] ?? m.short ?? m.medium ?? m.long ?? TEMPLATES[2]!.short!
}

function adjustLength(lines: LineTemplate[], length: TrackLength): LineTemplate[] {
  const targets = { short: 6, medium: 8, long: 12 }
  const target = targets[length]
  if (lines.length >= target) return lines.slice(0, target)
  const middle = lines.filter(l => l.speaker !== '九州そら')
  const padding: LineTemplate[] = []
  for (let i = lines.length; i < target; i++) {
    padding.push({ ...middle[i % middle.length], pauseAfter: 500 })
  }
  return [...lines.slice(0, lines.length - 1), ...padding, lines[lines.length - 1]]
}

function parseSource(text: string, level: JlptLevel = 'N5'): LineTemplate[] | null {
  if (!text.trim()) return null
  const profile = getJlptProfile(level)
  const seen = new Map<string, { name: string; voiceId: number }>()
  let unknownIndex = 0

  const lines = text.split('\n').map((line, i) => {
    const m = line.trim().match(/^([^:：]+)[:：]\s*(.+)$/)
    if (m) {
      const prefix = m[1].trim()
      const cached = seen.get(prefix)
      if (cached) {
        return { speaker: cached.name, style: 'ノーマル', voiceId: cached.voiceId, jp: m[2].trim(), bn: '— (translate)', pauseAfter: profile.pauseBetweenLines }
      }
      const mapped = PREFIX_MAP[prefix]
      if (mapped) {
        seen.set(prefix, mapped)
        return { speaker: mapped.name, style: 'ノーマル', voiceId: mapped.voiceId, jp: m[2].trim(), bn: '— (translate)', pauseAfter: profile.pauseBetweenLines }
      }
      // Unknown prefix — rotate through the voice pool so A:/B:/C: never all sound the same
      const pick = VOICE_POOL[unknownIndex % VOICE_POOL.length]
      unknownIndex++
      seen.set(prefix, pick)
      return { speaker: pick.name, style: 'ノーマル', voiceId: pick.voiceId, jp: m[2].trim(), bn: '— (translate)', pauseAfter: profile.pauseBetweenLines }
    }
    // No prefix: first line = narrator, rest rotate through pool as well
    const fallback = i === 0 ? { name: '九州そら', voiceId: 16 } : VOICE_POOL[unknownIndex % VOICE_POOL.length]
    if (i !== 0) unknownIndex++
    return { speaker: fallback.name, style: 'ノーマル', voiceId: fallback.voiceId, jp: line.trim(), bn: '— (translate)', pauseAfter: profile.pauseBetweenLines }
  }).filter(l => l.jp)

  // Re-compute pauses based on narrator position
  return lines.map((l, i) => ({
    ...l,
    pauseAfter: computePauseForLine(i, lines, profile),
  }))
}

function buildLinesFromTweaks(tweaks: Tweaks, level: JlptLevel = 'N5'): TrackLine[] {
  const tpl = pickTemplate(tweaks.mondai, tweaks.length)
  let rawLines: LineTemplate[]
  const parsed = parseSource(tweaks.sourceText, level)
  if (parsed && parsed.length) {
    rawLines = parsed
  } else {
    rawLines = adjustLength(tpl.lines, tweaks.length)
  }
  const profile = getJlptProfile(level)
  return rawLines.map((l, i) => ({
    id: `l${i + 1}`,
    speaker: l.speaker,
    style: l.style,
    voiceId: l.voiceId,
    jp: l.jp,
    bn: l.bn,
    pauseAfter: computePauseForLine(i, rawLines, profile),
    audio: 'queued' as const,
    speed: profile.speed,
    pitch: profile.pitch,
    intonation: profile.intonation,
    volume: profile.volume,
  }))
}

/* ── AI heuristics ── */
function extractFacts(lines: TrackLine[]): { type: string; fact: string; context: string }[] {
  const facts: { type: string; fact: string; context: string }[] = []
  const nonNarrator = lines.filter(l => l.speaker !== '九州そら' && l.jp.length > 3)

  for (const line of nonNarrator) {
    const jp = line.jp
    // Numbers / times
    const timeMatch = jp.match(/(\d{1,2})[:時](\d{1,2})?/)
    if (timeMatch) facts.push({ type: 'time', fact: timeMatch[0], context: jp })
    const numMatch = jp.match(/(\d+)[分秒円個パック本枚台階]/)
    if (numMatch) facts.push({ type: 'number', fact: numMatch[0], context: jp })
    // Locations / directions
    const placeMatch = jp.match(/(東京|大阪|京都|箱根|海|温泉|駅|空港|地下|階|部屋|店|スーパー|喫茶店|会社|家|学校|病院)/)
    if (placeMatch) facts.push({ type: 'place', fact: placeMatch[0], context: jp })
    // Actions with verbs
    const actionMatch = jp.match(/(行く|来る|する|買う|食べる|飲む|見る|聞く|話す|読む|書く|待つ|帰る|起きる|寝る|勉強|仕事|コピー|メール|電話|注文|支払)/)
    if (actionMatch) facts.push({ type: 'action', fact: actionMatch[0], context: jp })
    // Objects / items
    const itemMatch = jp.match(/(コーヒー|紅茶|水|ジュース|ビール|寿司|ラーメン|カレー|パン|ケーキ|魚|肉|野菜|果物|本|雑誌|新聞|資料|メール|電話|カバン|傘|靴|服|時計|眼鏡|傘|財布|鍵)/)
    if (itemMatch) facts.push({ type: 'item', fact: itemMatch[0], context: jp })
    // Negations / conditions
    const negMatch = jp.match(/(ない|ません|なかった|ずに|なくて|ないで)/)
    if (negMatch && jp.length > 6) facts.push({ type: 'negation', fact: negMatch[0], context: jp })
  }

  return facts
}

function generateQuestionFromScript(lines: TrackLine[]): Question {
  const nonNarrator = lines.filter(l => l.speaker !== '九州そら')
  const lastNarrator = lines.filter(l => l.speaker === '九州そら').pop()
  const facts = extractFacts(lines)

  // Build question based on the most specific fact found
  let jp = lastNarrator?.jp ?? '何が正しいですか。'
  let explanation = lastNarrator?.bn ?? 'স্ক্রিপ্ট থেকে তৈরি।'
  let correctJp = 'はい'
  let correctBn = 'হ্যাঁ'

  // Prioritize facts: time > place > item > action > number > negation
  const priority = ['time', 'place', 'item', 'action', 'number', 'negation']
  const bestFact = priority.map(t => facts.find(f => f.type === t)).find(Boolean)

  if (bestFact) {
    const speakers = [...new Set(nonNarrator.map(l => l.speaker))]
    const speakerLabel = speakers.length === 1 ? `${speakers[0].replace(/(.{3}).+/, '$1…')}さん` : '話している人'

    switch (bestFact.type) {
      case 'time':
        jp = `次は何時ですか。`
        correctJp = bestFact.fact
        correctBn = bestFact.fact
        explanation = `স্ক্রিপ্টে বলা হয়েছে "${bestFact.context}" — সময়টি হলো ${bestFact.fact}।`
        break
      case 'place':
        jp = `${speakerLabel}はどこへ行きますか。`
        correctJp = bestFact.fact
        correctBn = bestFact.fact
        explanation = `স্ক্রিপ্টে উল্লেখ করা জায়গা: "${bestFact.context}" — সঠিক উত্তর ${bestFact.fact}।`
        break
      case 'item':
        jp = `${speakerLabel}は何を注文しましたか。`
        correctJp = bestFact.fact
        correctBn = bestFact.fact
        explanation = `স্ক্রিপ্টে উল্লেখিত জিনিস: "${bestFact.context}" — সঠিক উত্তর ${bestFact.fact}।`
        break
      case 'action':
        jp = `${speakerLabel}は何をしますか。`
        correctJp = bestFact.fact
        correctBn = bestFact.fact
        explanation = `স্ক্রিপ্টের কার্যক্রম: "${bestFact.context}" — সঠিক উত্তর ${bestFact.fact}।`
        break
      case 'number':
        jp = `いくらですか。`
        correctJp = bestFact.fact
        correctBn = bestFact.fact
        explanation = `স্ক্রিপ্টে সংখ্যা উল্লেখ আছে: "${bestFact.context}" — সঠিক উত্তর ${bestFact.fact}।`
        break
      case 'negation':
        jp = `どうしてですか。`
        correctJp = '〜ないから'
        correctBn = 'না করার কারণে'
        explanation = `স্ক্রিপ্টে নেতিবাচক বিবৃতি: "${bestFact.context}" — কারণটি হলো না করা।`
        break
    }
  } else {
    // Fallback: use the most substantive non-narrator line
    const substantive = nonNarrator.find(l => l.jp.length > 10) ?? nonNarrator[0]
    if (substantive) {
      correctJp = substantive.jp.slice(0, 20)
      correctBn = substantive.bn?.slice(0, 30) ?? correctJp
      explanation = `স্ক্রিপ্টের মূল অংশ: "${substantive.jp}"`
    }
  }

  // Generate plausible distractors by mixing other facts or using negations
  const otherFacts = facts.filter(f => f.fact !== correctJp).map(f => f.fact).slice(0, 3)
  const distractorsJp = otherFacts.length >= 3
    ? otherFacts.slice(0, 3)
    : [
        ...otherFacts,
        'わかりません',
        'また今度',
        'ちがいます',
      ].filter((v, i, a) => a.indexOf(v) === i && v !== correctJp).slice(0, 3)

  const opts = [
    { k: 'A', jp: correctJp, bn: correctBn, correct: true },
    ...distractorsJp.map((d, i) => ({ k: String.fromCharCode(66 + i), jp: d, bn: d })),
  ]

  return { jp, options: opts, explanation_bn: explanation }
}

function rewriteN4(lines: TrackLine[]): TrackLine[] {
  const n4Patterns: Record<string, string> = {
    'ましたか': 'ましたか',
    'まだです': 'まだなんです',
    '今からします': 'これからします',
    'ください': 'ていただけますか',
    '行きたい': '行きたいんですが',
    'かかりますか': 'かかるでしょうか',
    'ですね': 'でしょう',
    'あります': 'ありますか',
  }
  return lines.map(l => {
    let jp = l.jp
    for (const [from, to] of Object.entries(n4Patterns)) {
      if (jp.includes(from) && !jp.includes(to)) {
        jp = jp.replace(from, to)
        break
      }
    }
    return { ...l, jp }
  })
}

function translateToBangla(lines: TrackLine[]): TrackLine[] {
  const dict: Record<string, string> = {
    'すみません': 'মাফ করবেন',
    'はい': 'হ্যাঁ',
    'いいえ': 'না',
    'ありがとう': 'ধন্যবাদ',
    'お願いします': 'অনুগ্রহ করে',
    'かしこまりました': 'ঠিক আছে',
    'いらっしゃいませ': 'স্বাগতম',
    'お先に失礼します': 'আমি আগে যাচ্ছি',
    'お疲れさまでした': 'কষ্ট করেছেন',
  }
  return lines.map(l => {
    if (l.bn && l.bn !== '— (translate)') return l
    let bn = l.jp
    for (const [jp, b] of Object.entries(dict)) {
      bn = bn.replaceAll(jp, b)
    }
    if (bn === l.jp) bn = l.jp + ' (translate)'
    return { ...l, bn }
  })
}

export function TrackProvider({ children }: { children: React.ReactNode }) {
  const [tweaks, setTweaks] = useState<Tweaks>({
    sourceText: '',
    mondai: 2,
    length: 'short',
    density: 'comfortable',
    showBN: true,
    status: 'draft',
  })

  const initialLines = buildLinesFromTweaks({
    sourceText: '', mondai: 2, length: 'short',
    density: 'comfortable', showBN: true, status: 'draft',
  }, 'N5')

  const initialTpl = pickTemplate(2, 'short')

  const [trackLines, setTrackLines] = useState<TrackLine[]>(initialLines)
  const [question, setQuestion] = useState<Question>(initialTpl.question)
  const [meta, setMeta] = useState({
    title_jp: initialTpl.title_jp,
    title_bn: initialTpl.title_bn,
    mondai: initialTpl.mondai,
    level: 'N5' as JlptLevel,
    scenarioImage: initialTpl.scenarioImage ?? getDefaultScenarioImage(),
  })

  const [selectedLineId, setSelectedLineId] = useState('l1')
  const [playing, setPlaying] = useState(false)
  const [playhead, setPlayhead] = useState(0)
  const [playingLineId, setPlayingLineId] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>('brand')
  const [vvConnected, setVvConnected] = useState(false)
  const [synthesisQueue, setSynthesisQueue] = useState<string[]>([])

  // Published tracks persisted to localStorage
  const [publishedTracks, setPublishedTracks] = useState<{ id: string; publishedAt: string; track: Track }[]>(() => {
    try {
      const raw = localStorage.getItem('shikhi-published-tracks')
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })

  // Custom mondais persisted to localStorage
  const [customMondais, setCustomMondais] = useState<CustomMondai[]>(() => {
    try {
      const raw = localStorage.getItem('shikhi-custom-mondais')
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })

  const audioEngineRef = useRef(new AudioEngine())
  const audioBuffersRef = useRef<Map<string, AudioBuffer>>(new Map())
  const audioBlobsRef = useRef<Map<string, Blob>>(new Map())
  const playbackScheduleRef = useRef<{ lineId: string; start: number; end: number }[]>([])
  const playbackGenRef = useRef(0)
  const rafRef = useRef(0)

  // Regenerate when template settings or JLPT level change
  useEffect(() => {
    const newLines = buildLinesFromTweaks(tweaks, meta.level)
    setTrackLines(prev => {
      const byJp = new Map(prev.map(l => [l.jp, l]))
      return newLines.map(l => {
        const existing = byJp.get(l.jp)
        if (existing) {
          const paramsChanged =
            existing.speed !== l.speed ||
            existing.pitch !== l.pitch ||
            existing.intonation !== l.intonation ||
            existing.volume !== l.volume ||
            existing.pauseAfter !== l.pauseAfter
          return {
            ...existing,
            id: l.id,
            speed: l.speed,
            pitch: l.pitch,
            intonation: l.intonation,
            volume: l.volume,
            pauseAfter: l.pauseAfter,
            audio: paramsChanged ? ('queued' as const) : existing.audio,
            audioUrl: paramsChanged ? undefined : existing.audioUrl,
            duration: paramsChanged ? undefined : existing.duration,
          }
        }
        return l
      })
    })
    const tpl = pickTemplate(tweaks.mondai, tweaks.length)
    setQuestion(tpl.question)
    setMeta(prev => ({
      ...prev,
      title_jp: tpl.title_jp,
      title_bn: tpl.title_bn,
      mondai: tpl.mondai,
      scenarioImage: tpl.scenarioImage ?? getScenarioImage(tpl.title_jp) ?? getDefaultScenarioImage(),
    }))
  }, [tweaks.mondai, tweaks.length, tweaks.sourceText, meta.level])

  // Check VOICEVOX health
  useEffect(() => {
    checkHealth().then(setVvConnected)
    const iv = setInterval(() => checkHealth().then(setVvConnected), 10000)
    return () => clearInterval(iv)
  }, [])

  const track = useMemo((): Track => {
    const duration = trackLines.reduce((s, l) => s + (l.duration ?? 2.4) + l.pauseAfter / 1000, 0)
    const readyCount = trackLines.filter(l => l.audio === 'ready').length
    let status: TrackStatus = tweaks.status
    if (status === 'published') {
      // keep
    } else if (readyCount === trackLines.length && trackLines.length > 0) {
      status = 'ready'
    } else if (readyCount > 0 || synthesisQueue.length > 0) {
      status = 'synthesizing'
    } else {
      status = 'draft'
    }
    return {
      id: 'tr_2401',
      title_jp: meta.title_jp,
      title_bn: meta.title_bn,
      mondai: meta.mondai,
      level: meta.level,
      duration: Math.round(duration),
      lines: trackLines,
      question,
      status,
      scenarioImage: meta.scenarioImage,
    }
  }, [trackLines, question, meta, tweaks.status, synthesisQueue])

  const updateLine = useCallback((lineId: string, patch: Partial<Omit<TrackLine, 'id'>>) => {
    setTrackLines(prev => prev.map(l => {
      if (l.id !== lineId) return l
      const next = { ...l, ...patch }
      if (patch.jp !== undefined && patch.jp !== l.jp) {
        next.audio = 'queued'
        next.audioUrl = undefined
        next.duration = undefined
        audioBuffersRef.current.delete(lineId)
        audioBlobsRef.current.delete(lineId)
      }
      return next
    }))
  }, [])

  const assignSpeaker = useCallback((lineId: string, speakerName: string, voiceId: number, styleName: string) => {
    setTrackLines(prev => prev.map(l => {
      if (l.id !== lineId) return l
      return { ...l, speaker: speakerName, voiceId, style: styleName, audio: 'queued' as const, audioUrl: undefined, duration: undefined }
    }))
  }, [])

  const addLine = useCallback((afterId?: string) => {
    setTrackLines(prev => {
      const idx = afterId ? prev.findIndex(l => l.id === afterId) : prev.length - 1
      const insertAt = idx >= 0 ? idx + 1 : prev.length
      const maxNum = prev.reduce((m, l) => {
        const n = parseInt(l.id.slice(1)) || 0
        return Math.max(m, n)
      }, 0)
      const prevLine = prev[idx] ?? prev[0]
      const profile = getJlptProfile(track.level)
      const newLine: TrackLine = {
        id: `l${maxNum + 1}`,
        speaker: prevLine?.speaker ?? '四国めたん',
        style: prevLine?.style ?? 'ノーマル',
        voiceId: prevLine?.voiceId ?? 2,
        jp: '（新しいセリフ）',
        bn: '(নতুন লাইন)',
        pauseAfter: profile.pauseBetweenLines,
        audio: 'queued',
        speed: profile.speed,
        pitch: profile.pitch,
        intonation: profile.intonation,
        volume: profile.volume,
      }
      const next = [...prev]
      next.splice(insertAt, 0, newLine)
      // Recompute pauses for all lines so narrator/question timing stays correct
      return next.map((l, i) => ({
        ...l,
        pauseAfter: computePauseForLine(i, next, profile),
      }))
    })
  }, [track.level])

  const removeLine = useCallback((lineId: string) => {
    setTrackLines(prev => {
      if (prev.length <= 2) return prev
      return prev.filter(l => l.id !== lineId)
    })
  }, [])

  const updateQuestion = useCallback((patch: Partial<Question>) => {
    setQuestion(prev => ({ ...prev, ...patch }))
  }, [])

  const updateTrackMeta = useCallback((patch: Partial<Pick<Track, 'title_jp' | 'title_bn' | 'level' | 'scenarioImage'>>) => {
    setMeta(prev => ({ ...prev, ...patch }))
    if (patch.level) {
      const profile = getJlptProfile(patch.level)
      setTrackLines(prev => {
        const next = prev.map((l, i) => ({
          ...l,
          speed: profile.speed,
          pitch: profile.pitch,
          intonation: profile.intonation,
          volume: profile.volume,
          pauseAfter: computePauseForLine(i, prev, profile),
          audio: 'queued' as const,
          audioUrl: undefined,
          duration: undefined,
        }))
        audioBuffersRef.current.clear()
        audioBlobsRef.current.clear()
        return next
      })
    }
  }, [])

  const synthesizeLine = useCallback(async (lineId: string) => {
    const line = trackLines.find(l => l.id === lineId)
    if (!line || line.audio === 'rendering') return
    if (!vvConnected) {
      setTrackLines(prev => prev.map(l => l.id === lineId ? { ...l, audio: 'error' as const } : l))
      return
    }
    setTrackLines(prev => prev.map(l => l.id === lineId ? { ...l, audio: 'rendering' as const } : l))
    setSynthesisQueue(prev => [...prev.filter(id => id !== lineId), lineId])
    try {
      const profile = getJlptProfile(track.level)
      // Pass raw Japanese; synthesizeJlpt normalizes it and strips spurious
      // junction pauses inside accent_phrases before hitting /synthesis.
      const buf = await synthesizeJlpt(line.jp, line.voiceId, {
        speed: line.speed,
        pitch: line.pitch,
        intonation: line.intonation,
        volume: line.volume,
        prePhonemeLength: profile.prePhonemeLength,
        postPhonemeLength: profile.postPhonemeLength,
        pauseLengthScale: profile.pauseLengthScale,
      })
      const engine = audioEngineRef.current
      const audioBuf = await engine.decode(buf)
      audioBuffersRef.current.set(lineId, audioBuf)
      const blob = new Blob([buf], { type: 'audio/wav' })
      audioBlobsRef.current.set(lineId, blob)
      const url = URL.createObjectURL(blob)
      setTrackLines(prev => prev.map(l => l.id === lineId ? {
        ...l,
        audio: 'ready' as const,
        audioUrl: url,
        duration: audioBuf.duration,
      } : l))
    } catch {
      setTrackLines(prev => prev.map(l => l.id === lineId ? { ...l, audio: 'error' as const } : l))
    } finally {
      setSynthesisQueue(prev => prev.filter(id => id !== lineId))
    }
  }, [trackLines, vvConnected, track.level])

  const synthesizeAll = useCallback(async () => {
    for (const line of trackLines) {
      if (line.audio !== 'ready' && line.audio !== 'rendering') {
        await synthesizeLine(line.id)
      }
    }
  }, [trackLines, synthesizeLine])

  const stopPlayback = useCallback(() => {
    playbackGenRef.current++
    audioEngineRef.current.stop()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setPlaying(false)
    setPlayhead(0)
    setPlayingLineId(null)
  }, [])

  const startPlaybackLoop = useCallback(() => {
    const tick = () => {
      const elapsed = audioEngineRef.current.playbackTime
      const schedule = playbackScheduleRef.current
      const total = schedule.length ? schedule[schedule.length - 1].end : 1
      const item = schedule.find(s => elapsed >= s.start && elapsed < s.end)
      setPlayingLineId(item?.lineId ?? null)
      setPlayhead(Math.min(1, elapsed / total))
      if (!audioEngineRef.current.playing || elapsed >= total) {
        if (elapsed >= total) {
          setPlaying(false)
          setPlayhead(0)
          setPlayingLineId(null)
        }
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const playLine = useCallback(async (lineId: string) => {
    stopPlayback()
    const line = trackLines.find(l => l.id === lineId)
    if (!line) return
    let buf = audioBuffersRef.current.get(lineId)
    if (!buf) {
      await synthesizeLine(lineId)
      buf = audioBuffersRef.current.get(lineId)
    }
    if (!buf) return
    setPlaying(true)
    setPlayingLineId(lineId)
    audioEngineRef.current.setOnEnded(() => {
      setPlaying(false)
      setPlayingLineId(null)
    })
    audioEngineRef.current.play(buf, line.speed, line.pitch)
  }, [trackLines, synthesizeLine, stopPlayback])

  const playTrack = useCallback(async () => {
    stopPlayback()
    const gen = playbackGenRef.current
    const notReady = trackLines.filter(l => l.audio !== 'ready')
    if (notReady.length) await synthesizeAll()
    if (gen !== playbackGenRef.current) return // aborted during synthesis
    const items: { buffer: AudioBuffer; speed: number; pitch: number; pauseAfter: number; onStart?: () => void }[] = []
    const schedule: { lineId: string; start: number; end: number }[] = []
    let t = 0
    for (const line of trackLines) {
      const buf = audioBuffersRef.current.get(line.id)
      if (!buf) continue
      const dur = buf.duration / line.speed
      items.push({
        buffer: buf,
        speed: line.speed,
        pitch: line.pitch,
        pauseAfter: line.pauseAfter / 1000,
        onStart: () => setPlayingLineId(line.id),
      })
      schedule.push({ lineId: line.id, start: t, end: t + dur })
      t += dur + line.pauseAfter / 1000
    }
    if (!items.length) return
    playbackScheduleRef.current = schedule
    setPlaying(true)
    audioEngineRef.current.setOnEnded(() => {
      setPlaying(false)
      setPlayhead(0)
      setPlayingLineId(null)
    })
    audioEngineRef.current.schedule(items)
    startPlaybackLoop()
  }, [trackLines, synthesizeAll, stopPlayback, startPlaybackLoop])

  const pausePlayback = useCallback(() => {
    audioEngineRef.current.pause()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setPlaying(false)
  }, [])

  const resumePlayback = useCallback(() => {
    audioEngineRef.current.resume()
    setPlaying(true)
    startPlaybackLoop()
  }, [startPlaybackLoop])

  const exportTrackAudio = useCallback(async () => {
    const items: { buffer: AudioBuffer; speed: number; pitch: number; pauseAfter: number }[] = []
    for (const line of trackLines) {
      const buf = audioBuffersRef.current.get(line.id)
      if (!buf) continue
      items.push({ buffer: buf, speed: line.speed, pitch: line.pitch, pauseAfter: line.pauseAfter / 1000 })
    }
    if (!items.length) return null
    return audioEngineRef.current.exportWav(items)
  }, [trackLines])

  const exportLineAudio = useCallback(async (lineId: string) => {
    const blob = audioBlobsRef.current.get(lineId)
    if (blob) return blob
    const line = trackLines.find(l => l.id === lineId)
    if (!line) return null
    await synthesizeLine(lineId)
    return audioBlobsRef.current.get(lineId) ?? null
  }, [trackLines, synthesizeLine])

  const applyJlptDefaults = useCallback(() => {
    const profile = getJlptProfile(track.level)
    setTrackLines(prev => {
      const next = prev.map((l, i) => ({
        ...l,
        speed: profile.speed,
        pitch: profile.pitch,
        intonation: profile.intonation,
        volume: profile.volume,
        pauseAfter: computePauseForLine(i, prev, profile),
        audio: 'queued' as const,
        audioUrl: undefined,
        duration: undefined,
      }))
      // clear cached buffers so they re-synth with new breathing params
      audioBuffersRef.current.clear()
      audioBlobsRef.current.clear()
      return next
    })
  }, [track.level])

  const generateCaptions = useCallback(() => {
    const srtLines: string[] = []
    const vttLines: string[] = ['WEBVTT\n']
    const textLines: string[] = []
    let t = 0
    trackLines.forEach((line, i) => {
      const dur = line.duration ?? 2.4
      const start = t
      const end = t + dur
      const ts = (s: number) => {
        const m = Math.floor(s / 60)
        const sec = Math.floor(s % 60)
        const ms = Math.floor((s % 1) * 1000)
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`
      }
      const vttTs = (s: number) => {
        const m = Math.floor(s / 60)
        const sec = Math.floor(s % 60)
        const ms = Math.floor((s % 1) * 1000)
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
      }
      srtLines.push(`${i + 1}\n${ts(start)} --> ${ts(end)}\n${line.jp}\n${line.bn}\n`)
      vttLines.push(`${vttTs(start)} --> ${vttTs(end)}\n${line.jp}\n${line.bn}\n`)
      textLines.push(`${line.jp} / ${line.bn}`)
      t = end + line.pauseAfter / 1000
    })
    return { srt: srtLines.join('\n'), vtt: vttLines.join('\n'), text: textLines.join('\n') }
  }, [trackLines])

  // Auto-playhead updater
  useEffect(() => {
    if (!playing || playbackScheduleRef.current.length) return
    const iv = setInterval(() => {
      setPlayhead(p => {
        if (p >= 1) { setPlaying(false); return 0 }
        return p + 0.005
      })
    }, 80)
    return () => clearInterval(iv)
  }, [playing])

  useEffect(() => {
    if (!playing || playbackScheduleRef.current.length) return
    const idx = Math.min(track.lines.length - 1, Math.floor(playhead * track.lines.length))
    setPlayingLineId(track.lines[idx]?.id ?? null)
  }, [playhead, playing, track.lines])

  const aiGenerateQuestion = useCallback(() => {
    const q = generateQuestionFromScript(trackLines)
    setQuestion(q)
  }, [trackLines])

  const aiRewriteN4 = useCallback(() => {
    setTrackLines(prev => rewriteN4(prev))
  }, [])

  const aiTranslateBangla = useCallback(() => {
    setTrackLines(prev => translateToBangla(prev))
  }, [])

  const aiSuggestDistractors = useCallback(() => {
    const correct = question.options.find(o => o.correct)
    if (!correct) return
    const distractors = [
      correct.jp + '（違う文脈）',
      'ちがう' + correct.jp,
      'まだ' + correct.jp,
    ]
    setQuestion(prev => ({
      ...prev,
      options: prev.options.map((o, i) => ({
        ...o,
        jp: o.correct ? o.jp : (distractors[i - 1] ?? o.jp),
      })),
    }))
  }, [question])

  const publishTrack = useCallback(() => {
    const id = `shk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    const published: { id: string; publishedAt: string; track: Track } = {
      id,
      publishedAt: new Date().toISOString(),
      track: { ...track, id, status: 'published' },
    }
    setPublishedTracks(prev => {
      const next = [published, ...prev].slice(0, 50)
      localStorage.setItem('shikhi-published-tracks', JSON.stringify(next))
      return next
    })
    setTweaks(p => ({ ...p, status: 'published' }))
    return published
  }, [track])

  const loadPublishedTrack = useCallback((id: string) => {
    const pt = publishedTracks.find(p => p.id === id)
    if (!pt) return
    const t = pt.track
    setTrackLines(t.lines)
    setQuestion(t.question)
    setMeta({
      title_jp: t.title_jp,
      title_bn: t.title_bn,
      mondai: t.mondai,
      level: t.level,
      scenarioImage: t.scenarioImage ?? getDefaultScenarioImage(),
    })
    setTweaks(p => ({ ...p, status: 'draft' }))
  }, [publishedTracks])

  const addCustomMondai = useCallback((m: CustomMondai) => {
    setCustomMondais(prev => {
      const next = [...prev.filter(cm => cm.id !== m.id), m]
      localStorage.setItem('shikhi-custom-mondais', JSON.stringify(next))
      return next
    })
  }, [])

  const removeCustomMondai = useCallback((id: number) => {
    setCustomMondais(prev => {
      const next = prev.filter(cm => cm.id !== id)
      localStorage.setItem('shikhi-custom-mondais', JSON.stringify(next))
      return next
    })
  }, [])

  const value = useMemo<TrackContextValue>(() => ({
    tweaks, setTweaks,
    track,
    selectedLineId, setSelectedLineId,
    playing, setPlaying,
    playhead, setPlayhead,
    playingLineId,
    theme, setTheme,
    synthesizeLine,
    synthesizeAll,
    playLine,
    playTrack,
    stopPlayback,
    pausePlayback,
    resumePlayback,
    updateLine,
    addLine,
    removeLine,
    updateQuestion,
    updateTrackMeta,
    assignSpeaker,
    vvConnected,
    synthesisQueue,
    aiGenerateQuestion,
    aiRewriteN4,
    aiTranslateBangla,
    aiSuggestDistractors,
    applyJlptDefaults,
    exportTrackAudio,
    exportLineAudio,
    generateCaptions,
    publishTrack, publishedTracks, loadPublishedTrack,
    customMondais, addCustomMondai, removeCustomMondai,
  }), [
    tweaks, track, selectedLineId, playing, playhead, playingLineId,
    theme, synthesizeLine, synthesizeAll, playLine, playTrack,
    stopPlayback, pausePlayback, resumePlayback, updateLine, addLine, removeLine,
    updateQuestion, updateTrackMeta, assignSpeaker, vvConnected, synthesisQueue,
    aiGenerateQuestion, aiRewriteN4, aiTranslateBangla, aiSuggestDistractors,
    applyJlptDefaults, exportTrackAudio, exportLineAudio, generateCaptions,
    publishTrack, publishedTracks, loadPublishedTrack,
    customMondais, addCustomMondai, removeCustomMondai,
  ])

  return (
    <TrackContext.Provider value={value}>
      {children}
    </TrackContext.Provider>
  )
}
