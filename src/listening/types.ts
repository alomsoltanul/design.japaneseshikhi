export type AudioStatus = 'ready' | 'rendering' | 'queued' | 'error'
export type TrackStatus = 'draft' | 'synthesizing' | 'ready' | 'published'
export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
export type MondaiType = number
export type TrackLength = 'short' | 'medium' | 'long'
export type Density = 'compact' | 'comfortable'
export type Theme = 'brand' | 'dark' | 'zen'
/** TTS backend. VOICEVOX = local engine (dev-only). Azure = cloud, works on prod. */
export type TtsProvider = 'voicevox' | 'azure'

export interface TrackLine {
  id: string
  /** VOICEVOX speaker name e.g. "四国めたん" */
  speaker: string
  /** VOICEVOX style name e.g. "ノーマル" */
  style: string
  /** Actual VOICEVOX style ID for synthesis */
  voiceId: number
  jp: string
  bn: string
  pauseAfter: number
  audio: AudioStatus
  speed: number
  pitch: number
  intonation: number
  volume: number
  audioUrl?: string
  duration?: number
}

export interface QuestionOption {
  k: string
  jp: string
  bn: string
  correct?: boolean
  /** Optional image for 4-panel JLPT-style visual options */
  imageUrl?: string
}

export interface CustomMondai {
  id: number
  label: string
  description?: string
}

export interface Question {
  jp: string
  options: QuestionOption[]
  explanation_bn: string
}

export interface Track {
  id: string
  title_jp: string
  title_bn: string
  mondai: string
  level: JlptLevel
  duration: number
  lines: TrackLine[]
  question: Question
  status: TrackStatus
  /** Scenario image URL for this topic */
  scenarioImage?: string
  /** TTS backend for this track. Defaults to 'voicevox' for legacy behavior. */
  provider?: TtsProvider
}

export interface LibraryItem {
  kind: 'reading' | 'vocab' | 'grammar'
  level: JlptLevel
  title: string
  bn: string
  words: number
  status: 'new' | 'used' | 'queued'
  text: string
  scenarioImage?: string
}

export interface Tweaks {
  sourceText: string
  mondai: MondaiType
  length: TrackLength
  density: Density
  showBN: boolean
  status: TrackStatus
}

/**
 * Track-wide VOICEVOX engine tuning — mirrors the seven sliders in the
 * VOICEVOX desktop app, editable in English before building reels.
 * 話速=speed · 音高=pitch · 抑揚=intonation · 音量=volume ·
 * 間の長さ=pauseLengthScale · 開始無音=prePhonemeLength · 終了無音=postPhonemeLength
 */
export interface VoiceTuning {
  speed: number
  pitch: number
  intonation: number
  volume: number
  /** Multiplier for 、/。 pauses inside a line (VOICEVOX 間の長さ). */
  pauseLengthScale: number
  /** Silence before each line, seconds (VOICEVOX 開始無音). */
  prePhonemeLength: number
  /** Silence after each line, seconds (VOICEVOX 終了無音). */
  postPhonemeLength: number
}

export interface PublishedTrack {
  id: string
  publishedAt: string
  track: Track
}

export interface TrackContextValue {
  tweaks: Tweaks
  setTweaks: React.Dispatch<React.SetStateAction<Tweaks>>
  track: Track
  selectedLineId: string
  setSelectedLineId: (id: string) => void
  playing: boolean
  setPlaying: (v: boolean) => void
  playhead: number
  setPlayhead: (v: number) => void
  playingLineId: string | null
  theme: Theme
  setTheme: (t: Theme) => void
  /** Audio synthesis & playback */
  synthesizeLine: (lineId: string) => Promise<void>
  synthesizeAll: () => Promise<void>
  playLine: (lineId: string) => Promise<void>
  playTrack: () => Promise<void>
  stopPlayback: () => void
  pausePlayback: () => void
  resumePlayback: () => void
  updateLine: (lineId: string, patch: Partial<Omit<TrackLine, 'id'>>) => void
  addLine: (afterId?: string) => void
  removeLine: (lineId: string) => void
  updateQuestion: (patch: Partial<Question>) => void
  updateTrackMeta: (patch: Partial<Pick<Track, 'title_jp' | 'title_bn' | 'level' | 'scenarioImage'>>) => void
  assignSpeaker: (lineId: string, speakerName: string, voiceId: number, styleName: string) => void
  vvConnected: boolean
  synthesisQueue: string[]
  /** Active TTS backend + toggle. Switching remaps every line to the peer voice. */
  provider: TtsProvider
  setProvider: (p: TtsProvider) => void
  azureConnected: boolean
  /** Assign an Azure voice to a line (used by the Azure voice picker). */
  assignAzureVoice: (lineId: string, voiceName: string) => void
  /** AI assist */
  aiGenerateQuestion: () => void
  aiRewriteN4: () => void
  aiTranslateBangla: () => void
  aiSuggestDistractors: () => void
  /** JLPT tuning */
  applyJlptDefaults: () => void
  /** Track-wide VOICEVOX engine tuning (English mirror of VOICEVOX sliders) */
  voiceTuning: VoiceTuning
  updateVoiceTuning: (patch: Partial<VoiceTuning>) => void
  resetVoiceTuning: () => void
  /** Social export */
  exportTrackAudio: () => Promise<Blob | null>
  exportLineAudio: (lineId: string) => Promise<Blob | null>
  generateCaptions: () => { srt: string; vtt: string; text: string }
  /** Publish */
  publishTrack: () => PublishedTrack
  publishedTracks: PublishedTrack[]
  loadPublishedTrack: (id: string) => void
  /** Custom mondais */
  customMondais: CustomMondai[]
  addCustomMondai: (m: CustomMondai) => void
  removeCustomMondai: (id: number) => void
}
