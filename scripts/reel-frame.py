#!/usr/bin/env python3
"""Render the reel's 1080x1920 frames: the intro card, and the per-clip overlay
that carries the keyword header and the burned-in subtitle.

This exists because the ffmpeg on this machine is built without libfreetype and
without libass — there is no `drawtext` and no `subtitles` filter, so no text can
be drawn inside the filter graph. Pillow draws it instead.

That turns out to be the better path anyway: Pillow reports exact glyph metrics,
so each furigana cluster is positioned by measuring the kanji run it sits above.
A space-padded ruby line drifts in any proportional font; this does not.

The overlay is RGBA with a fully transparent rectangle punched where the clip
plays, so ffmpeg composites video underneath in one pass. The pane rect is
printed as JSON for the merge script to scale the clip into.

  reel-frame.py '<spec json>'      spec.mode = "card" | "overlay"
"""
import json
import sys
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920

BG = (7, 10, 15, 255)
MINT = (200, 230, 201, 255)
RED = (230, 57, 70, 255)
INK = (29, 53, 87, 255)
MID = (55, 65, 81, 255)
SOFT = (91, 107, 122, 255)
WHITE = (244, 247, 250, 255)
GREY = (150, 160, 174, 255)
RULE = (29, 53, 87, 70)

# Header band, then the video pane, then the subtitle block.
BAND = (40, 52, 1040, 428)          # x0, y0, x1, y1
PANE = (0, 470, 1080, 1078)         # 1080x608 — 16:9 at full width
TEXT_TOP = 1130

JP = "/System/Library/Fonts/Hiragino Sans GB.ttc"
SERIF = "/System/Library/Fonts/NewYork.ttf"
SANS = "/System/Library/Fonts/HelveticaNeue.ttc"
BN = "/System/Library/Fonts/KohinoorBangla.ttc"


def font(path, size, index=0):
    try:
        return ImageFont.truetype(path, size, index=index)
    except Exception:
        return ImageFont.load_default()


def width(d, text, f):
    if not text:
        return 0
    box = d.textbbox((0, 0), text, font=f)
    return box[2] - box[0]


def centre(d, y, text, f, fill, cx=W / 2):
    """Draw `text` horizontally centred on `cx`; returns the y below it."""
    if not text:
        return y
    box = d.textbbox((0, 0), text, font=f)
    d.text((cx - (box[2] - box[0]) / 2 - box[0], y - box[1]), text, font=f, fill=fill)
    return y + (box[3] - box[1])


def wrap(d, text, f, maxw):
    words, lines, cur = text.split(), [], ""
    for w_ in words:
        trial = f"{cur} {w_}".strip()
        if width(d, trial, f) <= maxw or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w_
    if cur:
        lines.append(cur)
    return lines


# ── furigana ────────────────────────────────────────────────────────────────

def is_kanji(c):
    return '一' <= c <= '鿿' or '㐀' <= c <= '䶿' or c in '々〆〇'


def parse_jp(s):
    """`漢字(かんじ)` markup → [(surface, reading|'')], matching the Studio's parser."""
    out, buf = [], ""
    i = 0
    while i < len(s):
        c = s[i]
        if c in '(（':
            j, rd = i + 1, ""
            while j < len(s) and s[j] not in ')）':
                rd += s[j]
                j += 1
            k = len(buf)
            while k > 0 and is_kanji(buf[k - 1]):
                k -= 1
            base, prefix = buf[k:], buf[:k]
            if not base:
                base, prefix = buf, ""
            if prefix:
                out.append((prefix, ""))
            buf = ""
            if base:
                out.append((base, rd.strip()))
            i = j + 1
        else:
            buf += c
            i += 1
    if buf:
        out.append((buf, ""))
    return [t for t in out if t[0]]


def draw_japanese(d, y, markup, keyword, size):
    """Ruby line: each reading is centred over the kanji run it belongs to."""
    toks = parse_jp(markup)
    f_base = font(JP, size, 1)
    f_ruby = font(JP, max(18, int(size * 0.40)), 0)

    widths = [width(d, s, f_base) for s, _ in toks]
    total = sum(widths)
    x = (W - total) / 2
    ruby_h = int(size * 0.40) + 10
    base_y = y + ruby_h

    for (surface, reading), w_ in zip(toks, widths):
        hit = bool(keyword) and (keyword in surface or surface in keyword and len(surface) > 1)
        d.text((x, base_y), surface, font=f_base, fill=RED if hit else WHITE)
        if reading:
            rw = width(d, reading, f_ruby)
            d.text((x + (w_ - rw) / 2, y), reading, font=f_ruby, fill=RED if hit else GREY)
        x += w_
    return base_y + int(size * 1.25)


def fit_japanese(d, markup, start_size, maxw):
    """Shrink until the line fits the frame rather than letting it run off."""
    size = start_size
    while size > 30:
        f = font(JP, size, 1)
        if sum(width(d, s, f) for s, _ in parse_jp(markup)) <= maxw:
            return size
        size -= 4
    return size


def draw_romaji(d, y, romaji, key_romaji, f):
    """Same line, but the searched word's romaji is picked out in red."""
    parts = romaji.split()
    if not parts:
        return y
    space = width(d, ' ', f)
    total = sum(width(d, p, f) for p in parts) + space * (len(parts) - 1)
    x = (W - total) / 2
    top = None
    for p in parts:
        box = d.textbbox((0, 0), p, font=f)
        if top is None:
            top = box[1]
        d.text((x, y - box[1]), p, font=f, fill=RED if p == key_romaji else GREY)
        x += width(d, p, f) + space
    return y + (d.textbbox((0, 0), 'Ay', font=f)[3])


# ── the header card ─────────────────────────────────────────────────────────

def draw_header(d, box, spec, big):
    """The mint keyword card. `big` renders it full-frame for the intro."""
    x0, y0, x1, y1 = box
    d.rounded_rectangle(box, radius=30, fill=MINT)

    romaji = (spec.get('romaji') or '').strip()
    meaning = (spec.get('meaningEn') or '').strip()
    reading = (spec.get('reading') or '').strip()
    word = (spec.get('word') or '').strip()

    scale = 1.0 if not big else 1.5
    f_badge = font(JP, int(38 * scale), 1)
    f_brand = font(SANS, int(21 * scale), 2)
    f_romaji = font(SERIF, int(74 * scale))
    f_mean = font(SERIF, int(34 * scale))
    f_read = font(JP, int(36 * scale), 0)
    word_size = int((96 if len(word) <= 4 else 76) * scale)
    f_word = font(JP, word_size, 1)

    # Brand mark, top-left of the card.
    bx, by = x0 + 38, y0 + 40
    d.rounded_rectangle([bx, by, bx + int(76 * scale), by + int(76 * scale)], radius=int(16 * scale), fill=(255, 255, 255, 255))
    centre(d, by + int(18 * scale), '文', f_badge, RED, cx=bx + int(38 * scale))
    centre(d, by + int(90 * scale), 'Learn Japanese', f_brand, INK, cx=bx + int(38 * scale))
    centre(d, by + int(116 * scale), 'with anime', f_brand, INK, cx=bx + int(38 * scale))

    cx = (x0 + x1) / 2 + int(60 * scale)
    inner = int(300 * scale)
    y = y0 + int(34 * scale)
    y = centre(d, y, romaji, f_romaji, INK, cx=cx) + int(14 * scale)
    d.line([cx - inner, y, cx + inner, y], fill=RULE, width=2)
    y += int(16 * scale)
    y = centre(d, y, meaning, f_mean, MID, cx=cx) + int(14 * scale)
    d.line([cx - inner, y, cx + inner, y], fill=RULE, width=2)
    y += int(16 * scale)
    y = centre(d, y, reading, f_read, SOFT, cx=cx) + int(20 * scale)
    centre(d, y, word, f_word, RED, cx=cx)


# ── modes ───────────────────────────────────────────────────────────────────

def render_card(spec, out):
    img = Image.new('RGBA', (W, H), MINT)
    d = ImageDraw.Draw(img)
    draw_header(d, (60, 520, W - 60, 1400), spec, big=True)
    img.convert('RGB').save(out)


def render_overlay(spec, out):
    img = Image.new('RGBA', (W, H), BG)
    d = ImageDraw.Draw(img)
    draw_header(d, BAND, spec, big=False)

    line = spec.get('line') or {}
    keyword = (spec.get('word') or '').strip()
    key_romaji = (spec.get('romaji') or '').strip()

    f_en = font(SANS, 34, 2)
    f_ro = font(SANS, 32, 0)
    f_bn = font(BN, 44, 2)

    y = TEXT_TOP
    for ln in wrap(d, (line.get('english') or '').strip(), f_en, W - 140)[:2]:
        y = centre(d, y, ln, f_en, GREY) + 12
    y += 26

    jp = (line.get('japanese_furigana') or '').strip()
    if jp:
        y = draw_japanese(d, y, jp, keyword, fit_japanese(d, jp, 64, W - 90))

    y = draw_romaji(d, y + 8, (line.get('romaji') or '').strip(), key_romaji, f_ro) + 34

    for ln in wrap(d, (line.get('bangla') or '').strip(), f_bn, W - 140)[:2]:
        y = centre(d, y, ln, f_bn, WHITE) + 16

    # Punch the video pane out last so nothing is drawn over the clip.
    d.rectangle(PANE, fill=(0, 0, 0, 0))
    img.save(out)


def main():
    spec = json.loads(sys.argv[1])
    out = spec['out']
    if spec.get('mode') == 'overlay':
        render_overlay(spec, out)
    else:
        render_card(spec, out)
    print(json.dumps({'out': out, 'pane': [PANE[0], PANE[1], PANE[2] - PANE[0], PANE[3] - PANE[1]]}))


if __name__ == '__main__':
    main()
