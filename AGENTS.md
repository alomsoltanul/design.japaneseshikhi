# Japanese Shikhi — Content Studio

## Project Overview
A React + Vite poster/content generation studio for Japanese Shikhi (Japanese language learning content for Bengali speakers). Creates social media posters for grammar, kanji, vocabulary, and listening practice.

## Stack
- React 19 + TypeScript
- Vite 6
- html-to-image (poster PNG export)
- html2canvas (MIJ poster maker)
- Deployed on Vercel

## File Structure
```
src/
  auth/              # Auth layer (localStorage-based)
  components/        # Reusable components + ExcelPasteImporter
  listening/         # Listening Studio (VOICEVOX integration)
  poster-maker/      # MIJ Poster Maker (T01–T15 templates)
  templates/         # Poster templates (grammar, kanji, vocab, word, etc.)
  App.tsx            # Main app with routing + auth guards
  ThemeContext.tsx   # Dark/light mode + font family
  themes.ts          # Accent colors + formats
  types.ts           # Shared types
  index.css          # Global styles
```

## Key Features
- **Auth**: Login/signup with roles (admin/editor/viewer). Default accounts seeded.
- **Themes**: Dark/light toggle + font picker (Inter, Noto Serif, Noto Sans JP, JetBrains Mono)
- **Excel Paste Import**: Copy-paste from Excel into Grammar, Kanji, Vocab, Word templates
- **Batch Download**: Multi-row Excel paste → auto-download numbered PNGs
- **Poster Studio**: 15 templates (grammar, kanji, vocab, word, challenge, quiz, promo, etc.)
- **Poster Maker**: 15 MIJ templates (announcements, events, quotes, etc.)
- **Listening Studio**: Voice track editor with VOICEVOX speaker browser

## Excel Paste Format
### Grammar
```
pattern    pattern_reading    meaning_bangla    meaning_english    structure_formula
〜とはいえ    〜to wa ie        যদিও ~            Even though ~      [Plain sentence] + とはいえ
```

### Kanji
```
kanji    kun    on    meaning_en    meaning_bn    example_jp    example_romaji    example_bn    strokes
山       やま   サン   Mountain      পাহাড়        富士山         Fujisan          ফুজি পর্বত      3
```

### Word
```
word_jp    romaji    meaning_bn    example_jp    example_bn    tip
旅行       Ryokō     ভ্রমণ / ট্রিপ   来年、日本に旅行します।  আগামী বছর জাপান ভ্রমণ করব।  旅=tabi, 行=iku
```

### Vocab
```
jp        romaji    bengali    tag
食べる     Taberu    খাওয়া     Verb
飲む       Nomu      পান করা    Verb
学校       Gakkō     স্কুল      Noun
```
(Pastes up to 6 words to fill the vocab poster grid)

## Default Accounts
- admin@japaneseshikhi.com / admin123 (admin)
- editor@japaneseshikhi.com / editor123 (editor)

## Build & Deploy
```bash
npm run build    # Production build
npm run dev      # Dev server
vercel --prod    # Deploy to Vercel
```

## Cache Note
Service worker (`public/sw.js`) uses network-first for HTML/JS/CSS to ensure fresh deployments. The cache auto-clears on version bump.

## Known TODOs
- [ ] Add real Supabase Auth (currently localStorage-based)
- [ ] Listening Studio dark/light theme sync
- [ ] Poster Maker theme sync
- [ ] PDF export option
- [ ] Image upload for img templates
