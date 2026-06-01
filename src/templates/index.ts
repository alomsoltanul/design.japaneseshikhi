import type { TemplateDef } from '@/types'

import { grammarDefaults, GrammarPoster, GrammarCtrl } from './grammar'
import { kanjiDefaults, KanjiPoster, KanjiCtrl } from './kanji'
import { vocabDefaults, VocabPoster, VocabCtrl } from './vocab'
import { wordDefaults, WordPoster, WordCtrl } from './word'
import { challengeDefaults, ChallengePoster, ChallengeCtrl } from './challenge'
import { promoDefaults, PromoPoster, PromoCtrl } from './promo'
import { tipDefaults, TipPoster, TipCtrl } from './tip'
import { announceDefaults, AnnouncePoster, AnnounceCtrl } from './announce'
import { imgBGDefaults, ImgBGPoster, ImgBGCtrl } from './imgbg'
import { imgCardDefaults, ImgCardPoster, ImgCardCtrl } from './imgcard'
import { newsTxtDefaults, NewsTxtPoster, NewsTxtCtrl } from './newstxt'
import { newsWireDefaults, NewsWirePoster, NewsWireCtrl } from './newswire'
import { newsFlashDefaults, NewsFlashPoster, NewsFlashCtrl } from './newsflash'
import { newsPanelDefaults, NewsPanelPoster, NewsPanelCtrl } from './newspanel'
import { kanjiQuizDefaults, KanjiQuizPoster, KanjiQuizCtrl } from './kanji-quiz'

export const TEMPLATES = [
  { id: 'grammar',   jp: '文法',    en: 'Grammar'   },
  { id: 'kanji',     jp: '漢字',    en: 'Kanji'     },
  { id: 'vocab',     jp: '語彙',    en: 'Vocab'     },
  { id: 'word',      jp: '単語',    en: 'Word'      },
  { id: 'challenge', jp: '問題',    en: 'Challenge' },
  { id: 'kanji-quiz',jp: 'クイズ',  en: 'Kanji Quiz' },
  { id: 'promo',     jp: '広告',    en: 'Promo'     },
  { id: 'tip',       jp: 'ヒント',  en: 'Tip'       },
  { id: 'announce',  jp: '告知',    en: 'Announce'  },
  { id: 'imgbg',     jp: '写真',    en: 'Photo BG'  },
  { id: 'imgcard',   jp: '画像',    en: 'Img Card'  },
  { id: 'newstxt',   jp: '速报',    en: 'News Txt'  },
  { id: 'newswire',  jp: '见出し',  en: 'Wire'      },
  { id: 'newsflash', jp: '速写',    en: 'Img Flash' },
  { id: 'newspanel', jp: '面板',    en: 'Img Panel' },
]

export const TEMPLATE_MAP: Record<string, TemplateDef> = {
  grammar:    { meta: TEMPLATES[0],  defaultData: grammarDefaults as Record<string, unknown>,    Poster: GrammarPoster,    Controls: GrammarCtrl    },
  kanji:      { meta: TEMPLATES[1],  defaultData: kanjiDefaults as Record<string, unknown>,      Poster: KanjiPoster,      Controls: KanjiCtrl      },
  vocab:      { meta: TEMPLATES[2],  defaultData: vocabDefaults as Record<string, unknown>,      Poster: VocabPoster,      Controls: VocabCtrl      },
  word:       { meta: TEMPLATES[3],  defaultData: wordDefaults as Record<string, unknown>,       Poster: WordPoster,       Controls: WordCtrl       },
  challenge:  { meta: TEMPLATES[4],  defaultData: challengeDefaults as Record<string, unknown>,  Poster: ChallengePoster,  Controls: ChallengeCtrl  },
  'kanji-quiz':{ meta: TEMPLATES[5],  defaultData: kanjiQuizDefaults as Record<string, unknown>, Poster: KanjiQuizPoster,  Controls: KanjiQuizCtrl  },
  promo:      { meta: TEMPLATES[6],  defaultData: promoDefaults as Record<string, unknown>,      Poster: PromoPoster,      Controls: PromoCtrl      },
  tip:        { meta: TEMPLATES[7],  defaultData: tipDefaults as Record<string, unknown>,        Poster: TipPoster,        Controls: TipCtrl        },
  announce:   { meta: TEMPLATES[8],  defaultData: announceDefaults as Record<string, unknown>,   Poster: AnnouncePoster,   Controls: AnnounceCtrl   },
  imgbg:      { meta: TEMPLATES[9],  defaultData: imgBGDefaults as Record<string, unknown>,      Poster: ImgBGPoster,      Controls: ImgBGCtrl      },
  imgcard:    { meta: TEMPLATES[10], defaultData: imgCardDefaults as Record<string, unknown>,    Poster: ImgCardPoster,    Controls: ImgCardCtrl    },
  newstxt:    { meta: TEMPLATES[11], defaultData: newsTxtDefaults as Record<string, unknown>,    Poster: NewsTxtPoster,    Controls: NewsTxtCtrl    },
  newswire:   { meta: TEMPLATES[12], defaultData: newsWireDefaults as Record<string, unknown>,   Poster: NewsWirePoster,   Controls: NewsWireCtrl   },
  newsflash:  { meta: TEMPLATES[13], defaultData: newsFlashDefaults as Record<string, unknown>,  Poster: NewsFlashPoster,  Controls: NewsFlashCtrl  },
  newspanel:  { meta: TEMPLATES[14], defaultData: newsPanelDefaults as Record<string, unknown>,  Poster: NewsPanelPoster,  Controls: NewsPanelCtrl  },
}
