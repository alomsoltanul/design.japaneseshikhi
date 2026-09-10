export type SlideType = 'qa-grid' | 'conversation' | 'title' | 'vocab-list'

export interface QACardItem {
  id?: string
  japanese: string
  romaji?: string
  translation: string
  reply: string
  replyRomaji?: string
  replyTranslation?: string
}

export interface QACard {
  id: string
  title?: string
  items: QACardItem[]
}

export interface QAColumn {
  id: string
  cards: QACard[]
}

export interface DialogueLine {
  id?: string
  speaker: string
  speakerColor?: string
  text: string
  romaji?: string
  translation?: string
}

export interface BaseSlide {
  id: string
  type: SlideType
  brand?: string
  brandColor?: string
  keyword?: string
  title: string
  titleHighlight?: string
  subtitle?: string
  speakerNotes?: string
}

export interface QAGridSlide extends BaseSlide {
  type: 'qa-grid'
  columns: QAColumn[]
}

export interface ConversationSlide extends BaseSlide {
  type: 'conversation'
  image?: {
    url?: string
    prompt?: string
    alt?: string
  }
  dialogue: {
    title?: string
    lines: DialogueLine[]
  }
}

export interface TitleSlide extends BaseSlide {
  type: 'title'
  level?: string
  topicEn?: string
  topicBn?: string
  bulletPoints?: string[]
}

export interface VocabItem {
  id?: string
  word: string
  furigana?: string
  romaji?: string
  meaning: string
  example?: string
  exampleRomaji?: string
  exampleMeaning?: string
}

export interface VocabSlide extends BaseSlide {
  type: 'vocab-list'
  items: VocabItem[]
}

export type Slide = QAGridSlide | ConversationSlide | TitleSlide | VocabSlide

export interface PresentationDeck {
  id: string
  title: string
  description?: string
  brand: string
  brandColor: string
  slides: Slide[]
}
