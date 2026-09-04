# Japanese Shikhi — Content Studio

Read **[AGENTS.md](AGENTS.md)** first. It is the canonical orientation for this
repo: layout, the security model, the verified Nadeshiko API facts, and the
hard platform constraints that have already broken a deployment once.

Short version, so you do not learn these the expensive way:

- `middleware.ts` is the only real security boundary. `AuthContext` is a name
  badge, not a gate.
- **Hobby plan caps a deployment at 12 Serverless Functions.** Nine already
  exist. Exceeding it fails the deploy *after* a successful build and silently
  leaves the previous version serving.
- This ffmpeg has no `drawtext`/libass and this Pillow has no HarfBuzz, so reel
  frames render in headless Chrome. Rendering is local-only.
- `public/robots.txt` says `Allow: /` on purpose — see AGENTS.md §3.
- `npm run typecheck` has pre-existing errors in `src/listening/` and
  `src/studio/`. Filter to the paths you touched.
