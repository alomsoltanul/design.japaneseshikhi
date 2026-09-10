import type { PresentationDeck } from './types'

export const DARE_PRESENTATION_PRESET: PresentationDeck = {
  id: 'dare-question-guide',
  title: 'だれ？ (dare) — Japanese Question Guide',
  description: 'Master Japanese questions with だれ (who) through sentence patterns and real dialogue practice.',
  brand: 'Japanese Shikhi',
  brandColor: '#E63946',
  slides: [
    {
      id: 'slide-dare-qa',
      type: 'qa-grid',
      brand: 'Japanese Shikhi',
      brandColor: '#E63946',
      keyword: 'だれ？',
      title: '「だれ」 (dare) দিয়ে জাপানি প্রশ্ন শিখে নিন',
      titleHighlight: '「だれ」',
      subtitle: '',
      speakerNotes:
        'Slide 1 Guide: Introduce Japanese question word だれ (dare - who). Explain how dare works with particles: だれは / だれですか, だれと (with whom), and だれが (who does). Read questions clearly, pause for viewers to guess, then reveal the answer.',
      columns: [
        {
          id: 'col-1',
          cards: [
            {
              id: 'c1-1',
              items: [
                {
                  id: 'item-1',
                  japanese: '田中さんはだれですか？',
                  romaji: 'Tanaka-san wa dare desu ka?',
                  translation: 'তানাকা-সান কে?',
                  reply: '先生です。',
                },
                {
                  id: 'item-2',
                  japanese: 'あの人はだれですか？',
                  romaji: 'Ano hito wa dare desu ka?',
                  translation: 'ওই ব্যক্তিটি কে?',
                  reply: '私の友達です。',
                },
              ],
            },
            {
              id: 'c1-2',
              items: [
                {
                  id: 'item-3',
                  japanese: 'この人はだれですか？',
                  romaji: 'Kono hito wa dare desu ka?',
                  translation: 'এই ব্যক্তিটি কে?',
                  reply: '私のお兄さんです。',
                },
                {
                  id: 'item-4',
                  japanese: 'あの女の人はだれですか？',
                  romaji: 'Ano onna no hito wa dare desu ka?',
                  translation: 'ওই মহিলাটি কে?',
                  reply: '山田さんです。',
                },
                {
                  id: 'item-5',
                  japanese: 'あの男の人はだれですか？',
                  romaji: 'Ano otoko no hito wa dare desu ka?',
                  translation: 'ওই লোকটি কে?',
                  reply: '私の先生です。',
                },
              ],
            },
            {
              id: 'c1-3',
              items: [
                {
                  id: 'item-6',
                  japanese: 'この人はだれですか？',
                  romaji: 'Kono hito wa dare desu ka?',
                  translation: 'এই ব্যক্তিটি কে?',
                  reply: '私のお母さんです。',
                },
                {
                  id: 'item-7',
                  japanese: 'だれと学校へ行きますか？',
                  romaji: 'Dare to gakkou e ikimasu ka?',
                  translation: 'কার সাথে স্কুলে যান?',
                  reply: '友達と行きます。',
                },
              ],
            },
          ],
        },
        {
          id: 'col-2',
          cards: [
            {
              id: 'c2-1',
              items: [
                {
                  id: 'item-8',
                  japanese: 'だれと日本へ来ましたか？',
                  romaji: 'Dare to Nihon e kimashita ka?',
                  translation: 'কার সাথে জাপানে এসেছেন?',
                  reply: '兄と来ました。',
                },
                {
                  id: 'item-9',
                  japanese: 'だれが日本語を教えますか？',
                  romaji: 'Dare ga Nihongo o oshiemasu ka?',
                  translation: 'কে জাপানি ভাষা শেখান?',
                  reply: '田中先生が教えます。',
                },
                {
                  id: 'item-10',
                  japanese: 'だれが来ますか？',
                  romaji: 'Dare ga kimasu ka?',
                  translation: 'কে আসবে?',
                  reply: '山田さんが来ます。',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'slide-dare-kaiwa',
      type: 'conversation',
      brand: 'Japanese Shikhi',
      brandColor: '#E63946',
      keyword: 'だれ？',
      title: '会話 — full reading practice',
      subtitle: '',
      speakerNotes:
        'Slide 2 Guide: High school hallway conversation between Yuki and Haru. Read Yuki’s lines first, instruct student to shadow or reply with Haru’s lines. Emphasize casual particles: "da yo" (assertion) and "no?" (question).',
      image: {
        url: '/assets/slides-anime-hallway.png',
        prompt:
          'Anime illustration of high school hallway scene with two students talking, anime aesthetic, high quality Makoto Shinkai lighting',
      },
      dialogue: {
        title: 'ユキとハルの会話',
        lines: [
          { speaker: 'ユキ', text: 'あの人はだれ？' },
          { speaker: 'ハル', text: '田中さん。僕の友達だよ。' },
          { speaker: 'ユキ', text: 'じゃあ、あの女の人はだれ？' },
          { speaker: 'ハル', text: '山田先生。日本語の先生だよ。' },
          { speaker: 'ユキ', text: 'あの男の人はだれ？' },
          { speaker: 'ハル', text: '僕のお兄さん。' },
          { speaker: 'ユキ', text: '今日はだれと来たの？' },
          { speaker: 'ハル', text: 'お兄さんと来たよ。' },
        ],
      },
    },
  ],
}

export const NANI_PRESENTATION_PRESET: PresentationDeck = {
  id: 'nani-question-guide',
  title: 'なに？ (nani) — Japanese Question Guide',
  description: 'Master Japanese questions with なに / なん (what) in everyday situations.',
  brand: 'Japanese Shikhi',
  brandColor: '#E63946',
  slides: [
    {
      id: 'slide-nani-qa',
      type: 'qa-grid',
      brand: 'Japanese Shikhi',
      brandColor: '#E63946',
      keyword: 'なに？',
      title: '「なに / なん」 দিয়ে প্রয়োজনীয় প্রশ্ন শিখে নিন',
      titleHighlight: '「なに / なん」',
      subtitle: '',
      speakerNotes: 'Slide 1 Guide: Contrast nan vs nani. Explain nan desu ka vs nani o shimasu ka.',
      columns: [
        {
          id: 'col-nani-1',
          cards: [
            {
              id: 'c-n1',
              items: [
                {
                  id: 'item-n1',
                  japanese: 'これは何ですか？',
                  romaji: 'Kore wa nan desu ka?',
                  translation: 'এটা কি?',
                  reply: '本です。',
                },
                {
                  id: 'item-n2',
                  japanese: '何時に起きますか？',
                  romaji: 'Nan-ji ni okimasu ka?',
                  translation: 'কখন ঘুম থেকে উঠেন?',
                  reply: '7時に起きます。',
                },
              ],
            },
            {
              id: 'c-n2',
              items: [
                {
                  id: 'item-n3',
                  japanese: '何を食べますか？',
                  romaji: 'Nani o tabemasu ka?',
                  translation: 'কি খাবেন?',
                  reply: 'ラーメンを食べます。',
                },
                {
                  id: 'item-n4',
                  japanese: '何を飲みますか？',
                  romaji: 'Nani o nomimasu ka?',
                  translation: 'কি পান করবেন?',
                  reply: 'お茶を飲みます。',
                },
              ],
            },
          ],
        },
        {
          id: 'col-nani-2',
          cards: [
            {
              id: 'c-n3',
              items: [
                {
                  id: 'item-n5',
                  japanese: '何をしていますか？',
                  romaji: 'Nani o shite imasu ka?',
                  translation: 'কি করছেন?',
                  reply: '日本語を勉強しています。',
                },
                {
                  id: 'item-n6',
                  japanese: '何曜日ですか？',
                  romaji: 'Nan-youbi desu ka?',
                  translation: 'আজ কি বার?',
                  reply: '日曜日です。',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

export const PRESET_LIBRARY: Record<string, PresentationDeck> = {
  'dare-preset': DARE_PRESENTATION_PRESET,
  'nani-preset': NANI_PRESENTATION_PRESET,
}
