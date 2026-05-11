---
name: design-japaneseshikhi
description: >
  Japanese Shikhi Poster Studio — a social media poster generator for japaneseshikhi.com.
  Use this skill whenever the user wants to: create or modify poster templates,
  add new poster types, change styling/branding, update content defaults,
  export posters, or work on the design system. Trigger on phrases like
  "new poster", "update template", "change colors", "add format", "poster studio".
---

# Japanese Shikhi — Poster Studio Skill

A TypeScript + React + Vite app that generates branded social-media posters for Japanese Shikhi.

**Location:** `~/design.japaneseshikhi/`  
**Entry:** `index.html` (Vite dev server or static build)  
**Source:** `src/`  
**Build output:** `dist/`  
**Deploy:** Vercel (configured)  
**PWA:** Yes — `public/manifest.json` + `public/sw.js`

---

## 1. What This Project Is

A browser-based poster studio with a live preview sidebar. Users pick a template, choose a format (Instagram, Stories, Twitter/X, etc.), set colors/effects, edit content, and download a 2× PNG.

**Languages supported in posters:** Japanese, Bengali, English, Romaji  
**Fonts loaded:** Inter, Noto Sans Bengali, DM Serif Display (Google Fonts CDN)

---

## 2. Templates (14 types)

| ID | Name | Use Case | Has Image Upload |
|---|---|---|---|
| `grammar` | Grammar | JLPT grammar patterns with examples | No |
| `kanji` | Kanji Card | Kanji with kun/on readings, meaning, strokes | No |
| `vocab` | Vocabulary | 6-word vocabulary grid with tags | No |
| `word` | Word of the Day | Single word with example sentence | No |
| `challenge` | Challenge | Multiple-choice quiz card | No |
| `promo` | Promo | Course/platform promotion | No |
| `tip` | Tip | Study tips / motivational quote | No |
| `announce` | Announcement | New batch / course launch | No |
| `imgbg` | Photo BG | Full-bleed image + text overlay | **Yes** |
| `imgcard` | Img Card | Image top + branded content bottom | **Yes** |
| `newstxt` | News Txt | Text-only breaking news card | No |
| `newswire` | News Wire | Multi-story digest format | No |
| `newsflash` | News Flash | Full-bleed image + news overlay | **Yes** |
| `newspanel` | News Panel | Image top + info panel bottom | **Yes** |

**To add a new template:**
1. Create `src/templates/yourname/index.tsx` with:
   - `YourNameData` interface
   - `yourNameDefaults` object
   - `YourNamePoster` component (accepts `PosterProps`)
   - `YourNameCtrl` component (accepts `ControlProps`)
2. Export from `src/templates/index.ts` and register in `TEMPLATE_MAP`

---

## 3. Formats (4 sizes)

| ID | Dimensions | Platform |
|---|---|---|
| `square` | 1080×1080 | Facebook, Instagram Feed |
| `portrait` | 1080×1350 | Instagram 4:5 |
| `story` | 1080×1920 | Stories, Reels, TikTok |
| `twitter` | 1600×900 | Twitter/X, LinkedIn |

**To add a format:** add to `FORMATS` array in `src/themes.ts`

---

## 4. Color Accents & Theme Editor

Built-in themes in `src/themes.ts`:

| ID | Primary | Secondary | Background | Dark Mode |
|---|---|---|---|---|
| `red` | #E63946 | #6B21A8 | Gradient dark | Yes |
| `navy` | #1D4ED8 | #2A9D8F | Gradient dark | Yes |
| `teal` | #2A9D8F | #1D3557 | Gradient dark | Yes |
| `purple` | #6B21A8 | #E63946 | Gradient dark | Yes |
| `amber` | #F4A261 | #E63946 | Gradient dark | Yes |
| `light` | #E63946 | #1D3557 | #FFFFFF | **No** |

**Dynamic theme editor:** In the Style tab, click the `+` swatch to add custom themes. Set name, primary/secondary colors (with color picker), background CSS, and dark/light mode. Custom themes are saved to `localStorage` and restored on reload. Built-in themes cannot be deleted.

---

## 5. Shared Components

| Component | Location | Purpose |
|---|---|---|
| `PosterShell` | `src/components/PosterShell.tsx` | Wraps posters with bg, orbs, petals, padding |
| `LogoPill` | `src/components/BrandPills.tsx` | Branded logo badge |
| `DomainPill` | `src/components/BrandPills.tsx` | `japaneseshikhi.com` gradient pill |
| `Orbs` | `src/components/PosterShell.tsx` | Animated gradient background orbs |
| `Petals` | `src/components/PosterShell.tsx` | Falling sakura petal animation |
| `ImageUpload` | `src/components/ImageUpload.tsx` | Drag & drop image upload |
| `Field` | `src/components/Controls.tsx` | Form field wrapper |
| `StringInput` | `src/components/Controls.tsx` | Text input bound to data key |
| `Slider` | `src/components/Controls.tsx` | Range slider for font sizes |
| `LevelSelect` | `src/components/Controls.tsx` | JLPT level dropdown |

**Dark/light-aware colors:**
```js
const dk = accent.dark;
const txt = dk ? '#fff' : '#1D3557';
const muted = dk ? 'rgba(255,255,255,0.45)' : 'rgba(29,53,87,0.45)';
const cardBg = dk ? 'rgba(255,255,255,0.05)' : 'rgba(29,53,87,0.05)';
const cardBdr = dk ? 'rgba(255,255,255,0.10)' : 'rgba(29,53,87,0.10)';
```

---

## 6. File Structure

```
design.japaneseshikhi/
├── index.html              # Vite entry
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── public/                 # Static assets → copied to dist/
│   ├── manifest.json
│   ├── sw.js
│   └── assets/
│       ├── favicon.png
│       ├── logo-light.webp
│       └── logo-dark.webp
├── src/
│   ├── main.tsx            # React root
│   ├── App.tsx             # Main app shell + sidebar + preview
│   ├── index.css           # All styles
│   ├── types.ts            # Core types & tag colors
│   ├── themes.ts           # Accents & formats
│   ├── components/
│   │   ├── PosterShell.tsx
│   │   ├── BrandPills.tsx
│   │   ├── ImageUpload.tsx
│   │   └── Controls.tsx
│   ├── templates/
│   │   ├── index.ts        # Registry: all 14 templates
│   │   ├── grammar/
│   │   ├── kanji/
│   │   ├── vocab/
│   │   ├── word/
│   │   ├── challenge/
│   │   ├── promo/
│   │   ├── tip/
│   │   ├── announce/
│   │   ├── imgbg/
│   │   ├── imgcard/
│   │   ├── newstxt/
│   │   ├── newswire/
│   │   ├── newsflash/
│   │   └── newspanel/
│   └── hooks/              # (optional)
└── .claude/
    └── design/
        └── SKILLS.md       # This file
```

---

## 7. Common Tasks

### Dev server
```bash
cd ~/design.japaneseshikhi
npm run dev
```

### Build for production
```bash
npm run build
```

### Deploy to Vercel
```bash
vercel --prod
```

### Update logo assets
Replace files in `public/assets/`. Both should be ~18–22px height at natural size.

### Add a new poster template
See section 2. Follow the 4-export pattern (defaults, Poster, Controls, types). Use existing templates as reference.

### Change brand colors
Modify `BASE_ACCENTS` in `src/themes.ts`. The first accent (`red`) is the default.

### Update default content
Modify the `xxxDefaults` export in each template's `index.tsx`.

### Add font size slider
Use the `Slider` helper:
```tsx
<Slider label="My Field" data={data} field="mySize" min={12} max={120} onChange={onChange} />
```

### Add a text field
Use `Field` + `StringInput`:
```tsx
<Field label="Label"><StringInput data={data} field="fieldKey" onChange={onChange} /></Field>
```

---

## 8. Export / Download Flow

1. Click "Download" → sets `dl = true`
2. Waits for fonts + renders a hidden off-screen poster at 1× (warm-up)
3. Waits 350ms
4. Renders again at 2× (pixelRatio: 2) via `html-to-image`
5. Triggers PNG download with filename: `japanese-shikhi-{tpl}-{fmt}-{timestamp}.png`

**Note:** The hidden render element is positioned off-screen to avoid viewport clipping while keeping it in DOM.

---

## 9. State Persistence

All state (selected template, accent, format, content data, effects, custom themes) is saved to `localStorage` under key `js-poster-studio-v2` and restored on page load.

---

## 10. Effects System

Two boolean toggles in `fx` state:
- `petals` — sakura falling animation (CSS keyframes)
- `orbs` — animated gradient background blobs

Both are pure CSS, no JS animation loop.

---

## 11. Image Upload

Drag & drop or click-to-upload. Converts to base64 DataURL via `FileReader`. Stored in component state.

Templates that support images receive `bgImage` prop and should handle `!bgImage` gracefully (show placeholder or fallback to gradient).

---

## 12. Conventions

- **TypeScript:** All source in `src/`, strict mode enabled
- **Inline styles:** All poster styling is inline (required for `html-to-image` export)
- **No CSS classes inside posters:** Use inline styles so export captures everything
- **Template IDs:** kebab-case or camelCase, must match across `TEMPLATES`, `TEMPLATE_MAP`
- **Bengali text:** Use `fontFamily: 'Noto Sans Bengali, Inter, sans-serif'`
- **Serif headlines:** Use `fontFamily: 'DM Serif Display, Georgia, serif'`
- **Tag colors:** `Verb=#E63946, Adj=#6B21A8, Noun=#2A9D8F, Adv=#F4A261, Other=#374151`

---

## 13. Troubleshooting

| Issue | Fix |
|---|---|
| PNG export is blank / cut off | Ensure hidden render element is large enough and off-screen |
| Fonts not rendering in export | `await document.fonts.ready` before export (already done) |
| Bengali text looks wrong | Noto Sans Bengali must load from Google Fonts CDN |
| Image templates look broken without upload | Always handle `!bgImage` with gradient fallback or placeholder |
| PWA not installing | Check `manifest.json` paths and `sw.js` scope |
| Build fails with type errors | Check `src/types.ts` — data props use `any` for template flexibility |

---

*Last updated: 2026-05-11*
