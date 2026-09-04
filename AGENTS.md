# Japanese Shikhi — Content Studio

Canonical orientation for anyone, human or agent, picking this repo up cold.
Read this before changing anything. It records the decisions that are **not**
recoverable from the code, and the constraints that have already broken a
deployment once.

Vite + React 19 + TypeScript SPA, deployed to Vercel. Serverless functions in
`api/`. Private studio for producing Japanese-learning content — it is not a
public site and must never be indexed.

---

## 1. Quick start

```bash
npm install
npm run dev          # http://localhost:5173  — Vite only, no middleware
npm run build        # production bundle
npm run typecheck    # tsc -b (see the note on pre-existing errors below)
npm run typecheck:api
npm run check:gate       # 30 checks on the access gate
npm run check:japanese   # 24 checks on furigana / romaji / vocab
npm run reel -- reels/<word>-manifest.json [--lang en,es,bn,vi,ne] [--motion kenburns|none]
```

`npm run typecheck` reports **pre-existing** errors in `src/listening/`,
`src/studio/` and `src/components/ImagePromptExtractor.tsx`. They predate the
current work and do not block the Vite build. Do not "fix" them as a side
quest; filter to the paths you touched.

---

## 2. Layout

```
middleware.ts            site-wide access gate (Vercel only) — the real security boundary
api/
  _lib/nadeshiko.ts      Nadeshiko search, no Vercel types so Vite can import it too
  _lib/translate.ts      MyMemory (free) and Claude translation providers
  _lib/http.ts           CORS + method guard helpers shared by every route
  clips/[action].ts      ONE dynamic route: search | translate | render
  {tts,generate,export,content,studio}/…   pre-existing routes, untouched
src/
  clips/japanese.ts      furigana, romaji, kana, vocab — zero dependencies
  clips/nadeshiko.ts     client + segment mapping + timing + manifest building
  clips/ClipFinder.tsx   the panel (step 0): batch words × languages
  subtitles/             Subtitle Studio: timeline, canvas/WebCodecs export
  auth/AuthContext.tsx   reads the middleware-verified identity; local demo fallback
  components/GlobalNav, GlobalFooter
scripts/
  reel-frame.mjs         renders 1080×1920 frames in headless Chrome
  merge-reel.mjs         downloads, composites, concatenates, retimes subtitles
  reel-frame.py          Pillow fallback when Chrome is absent (see §6)
  check-gate.mjs, check-japanese.mjs
reels/                   output — gitignored
```

---

## 3. Security model

**This tool is private.** It is a creator studio used only by the owner and
their workers to produce Instagram and Facebook content promoting the separate
public product, *japaneseshikhi*. It is not customer-facing, must never be
publicly reachable, and **shares no database, auth pool or storage with any
other product**. If a resource merely looks related, that is not a reason to
reuse it — ask.

**The middleware is the boundary. Nothing else is.**

`src/auth/AuthContext.tsx` used to keep users and plaintext passwords in
`localStorage`. It decided what the UI rendered and protected nothing — the
bundle, every asset and every `/api` route were public. The fix:

1. `middleware.ts` matches every path except `/_vercel/`.
2. Accounts live in `STUDIO_USERS` as `email:scrypt$N$r$p$salt$hash` entries.
   Passwords are never stored, only scrypt hashes, so the variable is safe to
   keep in project settings. Add people with `npm run user -- <email>`.
3. Sign-in verifies the hash and issues an HMAC-signed session cookie. Removing
   someone from `STUDIO_USERS` invalidates their cookie **immediately** — the
   session is re-checked against the account list on every request.
4. Unauthenticated requests get **401** plus a self-contained sign-in page
   served by the middleware itself, so the application bundle never leaves the
   gate. A crawler gets a refusal, not content.
5. Missing configuration **fails closed** (503). A missing secret must never
   mean "let everyone in".

**No external identity provider is in this path, deliberately.** Nothing to
pause, nothing to rate-limit, no other product's outage that can lock the team
out of their own studio. Sign-in always answers "Those details are not right"
whether the email is unknown or the password is wrong, and always runs one
scrypt either way, so responses cannot be used to enumerate accounts.

`AuthContext` reads the session payload without re-verifying the signature.
That is safe *only there*: nothing downstream of the middleware is reachable
without a signature that already passed, and the value drives a name badge, not
an access decision. Under `npm run dev` there is no middleware, so it falls back
to the local demo accounts — that fallback must never be relied on in production.

### Not indexed
`X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` on every
response, set in **both** the middleware and `vercel.json`, plus a meta tag in
`index.html`.

`public/robots.txt` says **`Allow: /`, deliberately.** `Disallow` blocks the
crawl, which stops search engines from ever *seeing* the noindex and leaves an
already-indexed URL in place as a bare entry. Do not "fix" this to `Disallow`.

### Still open
- No rate limiting on sign-in attempts.

---

## 4. Environment

Local values live in `.env.local` (gitignored). Production values live in the
Vercel project. `.env.example` lists the keys with empty values.

| Variable | Used by | Notes |
|---|---|---|
| `STUDIO_USERS` | middleware | `email:scrypt$…` entries, comma or newline separated. **This is the account list.** |
| `SESSION_SECRET` | middleware | signs the session cookie |
| `OBS_ACCESS_TOKEN` | middleware | lets an OBS browser source reach `/listening/studio?k=…` |
| `NADESHIKO_API_KEY` | `api/_lib/nadeshiko.ts` | server-side only |
| `ANTHROPIC_API_KEY` | `api/_lib/translate.ts` | optional; only for the Claude translator |
| `SUPABASE_*` | `api/_lib/store.ts` only | **pre-existing content storage, unrelated to auth.** Never reuse these names for anything else — see §6. |

Preview environment variables are **not** set — the Vercel CLI at 50.38.2 loops
on its own suggested command. Preview deploys therefore fail closed with 503,
which is safe. Fix by upgrading the CLI or using the dashboard.

---

## 5. The Clip Finder pipeline

Search a Japanese word → keep 8–9 clips → translate → render one 9:16 reel per
language. Batch: several words × several languages in one press.

### Nadeshiko API — verified, and the spec was wrong four times
Checked against the live API on 2026-09-02/03. If you are working from the
original build spec, these four corrections override it:

1. **`pt` is abbreviated**, not spelled out: `noun verb adj adv prt aux pron exp
   conj pref suf det intj`. There is no `"particle"`, `"auxiliary"` or
   `"punctuation"`. Symbol tokens carry no `pt` at all. Lowercasing alone
   degrades silently — `src/clips/japanese.ts` maps them.
2. **Copula cannot be separated from other auxiliaries on `pt`** — both are
   `aux`. Only `posLabel: "Copula"` distinguishes them, and the "copula stands
   alone" romaji rule depends on it.
3. **Tokens already carry furigana** in an `f` array the spec never mentioned.
   Across 921 sampled tokens, every kanji-bearing token had one. It is the
   primary source; the suffix/prefix-stripping algorithm is the fallback.
4. **`videoUrl` is not motion footage.** Measured across ANIME, JDRAMA and
   YOUTUBE: every clip is the segment's screenshot muxed with its audio —
   **0.00% inter-frame change** at ~160 kbps for 720p. The pane gets a slow
   alternating zoom (`--motion kenburns`) so it is not a dead frame. There is no
   known source of real motion; YouTube-sourced clips were attempted and
   yt-dlp is 403-blocked.

Rate limit is **300/60s**, not 150/min. Monthly quota 5,000, and one search is
one request regardless of result count — **do not build caching for quota.**
Clip downloads hit the CDN, not the API.

### Languages
| Code | Source | Cost |
|---|---|---|
| `en`, `es` | Nadeshiko's own human-written subtitles (`textEn`, `textEs`) | free, and better than MT |
| `bn`, `vi`, `ne` | MyMemory (default) or Claude Haiku | free / ~2¢ per reel |

**Never send `en` or `es` to a translator.** MyMemory is free with no key,
5,000 chars/day anonymous, and gets roughly 7 of 9 lines right — it fails on
slang, so the review tab exists for a reason.

Each reel carries **exactly one** language. The exported subtitle JSON keeps the
field name `bangla` because that is what the Subtitle Studio importer reads; on
a Vietnamese reel it holds the Vietnamese line.

### Timing contract
Subtitle `start`/`end` are rewritten from the durations `ffprobe` reports on the
finished parts, not from the API's segment lengths. Boundaries are rounded once
and shared, so every `end` is byte-identical to the next `start`: contiguous,
zero gaps, within ~0.03s of the real merged duration. Preserve this.

---

## 6. Hard constraints that have already bitten

**Read this section before adding a route or touching rendering.**

- **Hobby plan: max 12 Serverless Functions per deployment.** The project ships
  nine pre-existing routes. Four separate clip routes plus the middleware made
  fourteen and Vercel **rejected the whole deployment after a successful build**
  — production silently kept serving a three-week-old ungated build. That is
  why `api/clips/[action].ts` is one dynamic route. Adding routes casually will
  reproduce this.
- **This ffmpeg has no `drawtext` and no `subtitles` filter** (built without
  libfreetype and libass). No text can be drawn in the filter graph at all.
- **This Pillow reports `raqm: False`** — no HarfBuzz. Bengali is a complex
  script and renders as dotted-circle placeholders without shaping. Japanese
  survives it; Bangla does not.
- Therefore **frames render in headless Chrome** (`scripts/reel-frame.mjs`),
  which also lays out `<ruby>` natively — furigana needs no width measuring and
  cannot drift. `scripts/reel-frame.py` is the degraded fallback.
- **Rendering is local-only.** `/api/clips/render` returns 501 when deployed; it
  needs ffmpeg and Chrome. The working implementation is the Vite dev
  middleware in `vite.config.ts`.
- Clips are downloaded and probed **once** and shared across every language;
  only overlay frames and the final encode differ.
- **`api/_lib/store.ts` reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`** for
  content and audio Storage. That is a *different concern from auth* and points
  at a *different product's* project. Do not reuse those variable names, and do
  not assume the storage backend and the auth backend are related — they are
  not, and conflating them once put this private studio behind another
  product's auth pool.

---

## 7. Conventions

- Scoped CSS per feature (`src/clips/clips.css`, `subtitles.css`) using the
  `--js-*` design tokens. Brand red is `#E63946`.
- No state library. `useState` + `useCallback` throughout.
- API route logic lives in `api/_lib/*` free of `@vercel/node` types, so the
  same functions back both the serverless route and the Vite dev middleware.
- Comments explain *why*, especially where a workaround exists for one of the
  constraints in §6. Do not strip them.
- Checks are plain Node scripts using Node 24 type-stripping — no test runner.

---

## 8. Deploying

`git push origin main` triggers the production build. **Verify afterwards** —
a failed deployment leaves the previous build serving, which once meant an
ungated site for ten minutes while the logs said the build succeeded.

```bash
curl -sS -o /dev/null -w '%{http_code} %header{x-robots-tag}\n' https://designjapaneseshikhi.vercel.app/clips
# expect: 401 noindex, nofollow, noarchive, nosnippet, noimageindex
```

Vercel Attack Challenge Mode is on, so `curl` may get a 403 browser challenge —
that is the firewall, not the gate. Check in a real browser if unsure.
