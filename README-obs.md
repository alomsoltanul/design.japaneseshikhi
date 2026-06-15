# OBS Recording — JLPT Content Factory

Record vertical (1080×1920) JLPT shorts straight from **Studio Mode** with OBS auto-switching scenes.

## 1. Import the scene collection

Generate a collection for a specific question:

```bash
node scripts/gen-obs-scenes.mjs \
  --level N5 --test 3 --mondai 1 --question 2 \
  --base http://localhost:5173 \
  --out obs/scenes-jlpt-content.json
```

In OBS: **Scene Collection → Import →** select `obs/scenes-jlpt-content.json`.

You get 5 scenes, each a **Browser Source** (1080×1920) pointed at Studio Mode:

| Scene          | Studio URL `&scene=` |
| -------------- | -------------------- |
| Question       | `question`           |
| Think Time     | `think`              |
| Answer Reveal  | `answer`             |
| Feedback       | `feedback`           |
| Outro          | `outro`              |

Custom CSS on each source: `body { overflow: hidden; margin: 0; }`

## 2. Auto-switch scenes

Studio Mode POSTs the active scene to `/api/studio/scene-state` on every change.
The driver polls that endpoint and switches OBS to match.

1. OBS → **Tools → WebSocket Server Settings → Enable** (note the port/password).
2. Run the driver:

```bash
OBS_URL=ws://127.0.0.1:4455 \
OBS_PASSWORD=yourpass \
APP_URL=http://localhost:5173 \
node scripts/obs-auto-switch.js
```

Now drive Studio Mode with **→ / ←** (or `&autoplay=true&autoadvance=N`) and OBS follows.

## 3. Recording profile

- **Output resolution:** 1080×1920 (Settings → Video → Base & Output both 1080×1920)
- **FPS:** 30
- **Format:** MP4, encoder x264, **CRF ≈ 20** (Output → Recording → Rate Control: CRF)
- **File naming:** `recordings/{level}/{level}_t{test}_m{mondai}_q{question}.mp4`
  e.g. `recordings/N5/N5_t3_m1_q2.mp4`

## 4. Hotkey fallback (manual control)

If you'd rather switch by hand, bind number keys to scenes in
**Settings → Hotkeys → "Switch to scene"**:

| Key | Scene         |
| --- | ------------- |
| 1   | Question      |
| 2   | Think Time    |
| 3   | Answer Reveal |
| 4   | Feedback      |
| 5   | Outro         |

These work with or without the auto-switch driver running.
