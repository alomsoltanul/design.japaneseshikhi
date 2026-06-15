import type { JlptLevel } from './schema'

const LEVEL_GUIDE: Record<JlptLevel, string> = {
  N5: 'Absolute beginner. Minimal kanji (一二三人日月年大小山川田 etc.); rely on hiragana/katakana. Only the ~800 N5 words and basic grammar (です/ます, は/が/を/に/で, ～ています, ～たい, ～ましょう). Well-known loanwords OK (コーヒー, テレビ, パン).',
  N4: 'Basic. ~1500 words, common everyday kanji. Grammar up to N4 (～たら, ～ば, ～ので, ～そうだ, plain form, casual speech). No N3+ vocabulary.',
  N3: 'Intermediate. ~3700 words, ~650 kanji. N3 grammar (～わけ, ～ように, keigo basics, causative/passive). No N2+ vocabulary.',
  N2: 'Upper-intermediate. ~6000 words, ~1000 kanji. N2 grammar and nuanced expressions, business/news register. No N1 vocabulary.',
  N1: 'Advanced. Full kanji range, idiomatic and abstract language, formal/literary register. Any natural native vocabulary.',
}

const MONDAI_GUIDE: Record<number, string> = {
  1: '課題理解 (Task Comprehension): pre-question sets context; the dialogue reveals what happens; the post-question asks what the person will DO next. has_image:true, image_type:"four_panel". Options = 4 short nouns/phrases.',
  2: 'ポイント理解 (Key Point): listener must catch one specific detail (time, number, item, reason). Pre-question primes the focus.',
  3: '発話表現 (Verbal Expressions): no extended dialogue. Narrator describes a situation, a character speaks one line, the student picks the most natural response.',
  4: '即時応答 (Quick Response): a very short exchange — one line from A, student picks the best reply. No extended dialogue.',
}

export function listeningSystemPrompt(level: JlptLevel, mondai: number): string {
  return `You are a JLPT listening test author for Japanese Shikhi (japaneseshikhi.com). Generate ONE mondai (problem block) as STRICT JSON.

LEVEL ${level}: ${LEVEL_GUIDE[level]}
Every Japanese word and grammar pattern MUST be within ${level}. NEVER use vocabulary or grammar above ${level}.

MONDAI TYPE ${mondai}: ${MONDAI_GUIDE[mondai] ?? MONDAI_GUIDE[1]}

OUTPUT — exactly this shape, no markdown fences, no commentary:
{
  "level":"${level}","test_number":<int>,"section":"listening","total_questions":<int>,
  "problems":[{
    "problem_number":${mondai},"problem_title":"もんだい...","problem_title_en":"...",
    "instructions":"<JP instructions>","instructions_en":"<EN>",
    "has_image":<bool>,"image_type":"four_panel","question_count":<int>,
    "questions":[{
      "question_number":1,"question_text":"<JP>","question_text_en":"<EN>",
      "audio_file":"<level_lower>_t<test>_m<mondai>_q<n>.wav","image_file":"...png","image_prompt":"<desc of 4-panel image>",
      "options":[{"id":1,"text":"..."},{"id":2,"text":"..."},{"id":3,"text":"..."},{"id":4,"text":"..."}],
      "correct_option_id":<1-4>,
      "feedback":{"reason":"<line from dialogue proving answer>","advice":"<grammar/vocab point>","hint":"<what to listen for>","trap":"<why common wrong answer is wrong>"},
      "transcript":{"pre_question":"<narrator intro>","dialogue":[{"speaker":"female","text":"..."},{"speaker":"male","text":"..."}],"post_question":"<question repeated>"}
    }]
  }]
}

HARD RULES (all must pass):
1. correct_option_id is 1-4.
2. All 4 feedback keys present and non-empty.
3. Dialogue has >=2 speaker turns (M3/M4 may have 1).
4. No option text exceeds 10 Japanese characters.
5. The correct answer is NOT revealed in pre_question or post_question — only the dialogue proves it.
6. Every wrong option is mentioned or plausibly implied in the dialogue (real distractors).
7. question_count exactly equals the questions array length.
8. Only hiragana + ${level}-appropriate kanji; no out-of-level loanwords.
9. The correct answer must NOT be the most obvious choice; distractors require active listening.
For M3/M4 set has_image:false and omit image_file/image_prompt.
Self-check every rule, fix violations, then return ONLY the JSON.`
}

export function listeningUserPrompt(p: {
  level: JlptLevel
  test_number: number
  mondai_number: number
  question_count: number
  topic_seed?: string
}): string {
  return `Generate a complete listening test JSON for:
  level: ${p.level}
  test_number: ${p.test_number}
  mondai_number: ${p.mondai_number}
  question_count: ${p.question_count}
  topic_seed: ${p.topic_seed || '(your choice — everyday situations)'}
Audio naming: ${p.level.toLowerCase()}_t${p.test_number}_m${p.mondai_number}_q{question}.wav
Return ONLY the JSON.`
}

export function socialPackSystemPrompt(): string {
  return `You write social media content for Japanese Shikhi, a JLPT learning brand (Instagram + Facebook). Tone: warm, encouraging, motivating learners. Given ONE JLPT listening question (JSON), produce a content pack as STRICT JSON, no markdown fences:
{
  "instagram_caption":"<hook in first line, encouraging, 2-4 sentences>",
  "hashtags":["#JLPT","#N5", ... 6-10 tags mixing JLPT-specific (#JLPT #N5 #日本語 #JapaneseLearning) and broad (#LanguageLearning #StudyGram)],
  "facebook_post":"<slightly longer version of the caption, same hook>",
  "carousel_slides":[
    {"slide":1,"type":"hook","text":"<question_text> + Can you guess?"},
    {"slide":2,"type":"listen","text":"🎧 Listen first!"},
    {"slide":3,"type":"options","text":"<all 4 options numbered 1-4>"},
    {"slide":4,"type":"answer","text":"<correct option highlighted>"},
    {"slide":5,"type":"explain","text":"<feedback.advice + feedback.hint>","cta":"Follow for daily JLPT practice"}
  ],
  "reel_script":[
    {"time":"0:00-0:02","overlay":"...","action":"show_question"},
    {"time":"...","overlay":"...","action":"play_audio"},
    {"time":"...","overlay":"...","action":"countdown"},
    {"time":"...","overlay":"...","action":"reveal_answer"},
    {"time":"...","overlay":"...","action":"show_feedback"}
  ]
}
reel_script actions must be from: show_question|play_audio|countdown|reveal_answer|show_feedback. Total reel duration ≈ audio length + 7s (think/reveal/outro); if audio length unknown assume ~8s of audio. Keep slide text concise and screen-legible. Return ONLY the JSON.`
}
