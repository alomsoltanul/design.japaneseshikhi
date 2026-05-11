# Japanese Shikhi — Poster Studio

A browser-based social media poster generator for [japaneseshikhi.com](https://japaneseshikhi.com). Built with React 19, TypeScript, and Vite.

## Overview

Poster Studio lets you create branded Japanese-learning content posters for Instagram, Facebook, Stories, Reels, Twitter/X, and LinkedIn. All posters support Japanese, Bengali, English, and Romaji text.

## Features

- **14 poster templates** — Grammar, Kanji, Vocabulary, Word of the Day, Challenge, Promo, Tip, Announcement, Photo BG, Image Card, and 4 news formats
- **4 export formats** — Square (1080×1080), Portrait (1080×1350), Story (1080×1920), Twitter/X (1600×900)
- **6 built-in color themes** — Red, Navy, Teal, Purple, Amber, Light
- **Dynamic theme editor** — add your own custom color schemes with live preview
- **Live preview** with instant editing
- **2× PNG export** at full resolution
- **PWA support** — installable as a standalone app
- **Drag & drop image upload** for photo-based templates
- **Sakura petals & color orbs** animated effects
- **State persistence** — your work is saved to localStorage

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Build

```bash
npm run build
```

Output goes to `dist/`. Serve `dist/` with any static host.

## Templates

| Template | Description |
|----------|-------------|
| Grammar | JLPT grammar patterns with Bengali examples |
| Kanji Card | Kanji with readings, meaning, stroke count |
| Vocabulary | 6-word grid with part-of-speech tags |
| Word of the Day | Featured word with example sentence |
| Challenge | Multiple-choice quiz card |
| Promo | Course / platform promotion |
| Tip | Study tips and motivational quotes |
| Announcement | New batch or course launch |
| Photo BG | Full-bleed image with text overlay |
| Image Card | Image top + branded content bottom |
| News Txt | Text-only breaking news card |
| News Wire | Multi-story digest |
| News Flash | Full-bleed image + news overlay |
| News Panel | Image top + info panel bottom |

## Tech Stack

- React 19 + TypeScript
- Vite (build tool)
- html-to-image (PNG export)
- Google Fonts: Inter, Noto Sans Bengali, DM Serif Display
- Pure CSS animations

## Project Structure

```
.
├── index.html          # Vite entry
├── public/             # Static assets
│   ├── manifest.json
│   ├── sw.js
│   └── assets/
│       ├── favicon.png
│       ├── logo-light.webp
│       └── logo-dark.webp
├── src/
│   ├── main.tsx
│   ├── App.tsx         # Main app shell
│   ├── index.css       # Styles
│   ├── types.ts        # Core types
│   ├── themes.ts       # Colors & formats
│   ├── components/     # Shared UI components
│   └── templates/      # 14 poster templates
└── .claude/
    └── design/
        └── SKILLS.md   # Agent skill reference
```

## Deployment

Deployed to Vercel:

```bash
vercel --prod
```

## License

Private — for Japanese Shikhi use only.
