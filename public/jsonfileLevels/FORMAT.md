# jsonfileLevels — author your listening content here (offline, free, no API)

One file per JLPT level: `n5.json` `n4.json` `n3.json` `n2.json` `n1.json`.
Edit a file, **refresh the browser** — no rebuild, no API key, no cost.

The app reads these at runtime from `/jsonfileLevels/{level}.json`.

## How to add content

1. Ask Claude (chat / Sonnet) to write a mondai in the exact shape below.
2. Paste the question object(s) into the right `questions` array.
3. Save → refresh the Listening page → pick level / test / mondai → Open Studio or Export Slides.

## File shape

```jsonc
{
  "level": "N5",
  "tests": [
    {
      "test_number": 1,
      "problems": [
        {
          "mondai_number": 1,                 // 1=Task, 2=Key Point, 3=Verbal, 4=Quick Response
          "problem_title": "もんだい１",
          "problem_title_en": "Task Comprehension",
          "questions": [ /* question objects, see below */ ]
        }
      ]
    }
  ]
}
```

## Question object

```jsonc
{
  "question_number": 1,
  "question_text": "おとこの ひとは これから なにを かいますか。",   // shown big in Studio + slide 1
  "question_text_en": "What will the man buy now?",          // English subtitle
  "image_file": "n5_t1_m1_q1.png",                            // OPTIONAL — see Images below
  "options": [                                                // exactly 4, ids 1-4, each ≤10 JP chars
    { "id": 1, "text": "おにぎり" },
    { "id": 2, "text": "おべんとう" },
    { "id": 3, "text": "サンドイッチ" },
    { "id": 4, "text": "パン" }
  ],
  "correct_option_id": 3,                                     // 1-4, highlighted on the answer scene/slide
  "feedback": {                                               // all 4 keys required, non-empty
    "reason": "...",   // the dialogue line that proves the answer
    "advice": "...",   // grammar/vocab point to learn
    "hint": "...",     // what to listen for
    "trap": "..."      // why the common wrong answer is wrong
  },
  "transcript": {                                             // OPTIONAL — for your reference/script
    "pre_question": "...",
    "dialogue": [ { "speaker": "female", "text": "..." }, { "speaker": "male", "text": "..." } ],
    "post_question": "..."
  },
  "social": {                                                 // OPTIONAL — overrides the auto caption
    "caption": "Hand-written hook + encouragement…",
    "hashtags": ["#JLPT", "#N5", "#日本語"]
  }
}
```

## What gets generated from each question (no API)

- **Studio** (`/listening/studio`): 5 scenes — question → think → answer → feedback → outro. Screen-record it for a reel.
- **Export Slides (ZIP)**: 5 carousel PNGs (1080×1350) + `caption.txt` + `reel-script.json`.
  - slide 1 hook · 2 listen · 3 options · 4 answer · 5 explain (advice + hint).
  - If you add `social.caption` / `social.hashtags`, those are used; otherwise a caption is auto-built from `question_text_en`.

## Images (recommended — they make the reels pop)

Add an image per question and it shows up in **Studio's question scene, the reel
video, and carousel slide 1**.

1. In the question JSON set:
   ```jsonc
   "image_file": "n5_t1_m1_q1.png",          // the file name you'll save
   "image_prompt": "…"                         // optional: the prompt you used (for reference)
   ```
2. Generate the image (any AI image tool) and save the PNG to
   `public/jsonfileImages/n5_t1_m1_q1.png` (name must match `image_file`).
3. Refresh — the image appears automatically. Missing file → falls back to text.

### Recommended prompt — official JLPT style (4-panel)

JLPT Mondai 1 images are simple, clean line illustrations of the four options.
Use this template (fill in the four options):

```
A clean 2x2 four-panel illustration in the style of an official JLPT listening
exam, simple flat vector line-art, minimal color, white background, thin black
outlines, no text or numbers in the image. Each panel shows ONE everyday object
or action, clearly distinguishable:
  Panel 1 (top-left): {option 1}
  Panel 2 (top-right): {option 2}
  Panel 3 (bottom-left): {option 3}
  Panel 4 (bottom-right): {option 4}
Consistent simple style across all panels, centered, lots of whitespace,
1:1 square. No words, no captions, no watermark.
```

For Mondai 2/3/4 (no 4-panel), use a single simple scene illustration instead:

```
A simple flat vector line illustration for a JLPT listening question, minimal
color, white background, thin black outlines, no text. Scene: {describe the
situation, e.g. "a man and a woman talking at a train station ticket gate"}.
Clean, friendly, lots of whitespace, 1:1 square. No words or watermark.
```

Tip: keep a consistent illustrator/style across a whole test so the reels and
carousels look like a set.

## Notes

- **No audio / no video compile from slides.** Slides are images; the **reel** is a
  real compiled MP4 (voice + animated scenes) built with VOICEVOX — local only.
- **VOICEVOX / reels are local-only.** The live HTTPS site can't reach your local
  VOICEVOX, so build reels with `npm run dev` at http://localhost:5173. Slides and
  Studio work anywhere.
- Keep every word within the level (N5 = minimal kanji + kana). The app does not check this — you do.
- You can add as many `tests`, `problems`, and `questions` as you like.
