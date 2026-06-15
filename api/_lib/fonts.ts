// Load TTF font bytes for satori / @vercel/og. The default @vercel/og bundle
// only covers Latin, so Japanese glyphs render as tofu unless we supply a CJK
// font. We fetch a text-subset of Noto Sans JP from Google Fonts at runtime,
// using a User-Agent that forces a TTF (satori cannot read woff2).

const cache = new Map<string, ArrayBuffer>()

const TTF_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/534.30 (KHTML, like Gecko) Version/5.1 Safari/534.30'

async function fetchTtf(cssUrl: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(cssUrl, { headers: { 'User-Agent': TTF_UA } }).then(r => r.text())
    const url = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"]?truetype/)?.[1] ?? css.match(/url\(([^)]+\.ttf)\)/)?.[1]
    if (!url) return null
    return await fetch(url).then(r => r.arrayBuffer())
  } catch {
    return null
  }
}

/** Noto Sans JP subset covering `text` (+ Latin/punctuation). Cached per family+weight. */
export async function loadJpFont(text: string, weight: 400 | 700 = 700): Promise<ArrayBuffer | null> {
  const key = `notojp-${weight}`
  if (cache.has(key)) return cache.get(key)!
  const families = `family=Noto+Sans+JP:wght@${weight}&family=Noto+Sans:wght@${weight}`
  const subset = encodeURIComponent(text + 'JLPTN12345 ✅🎧0123456789.,!?「」、。/')
  const buf = await fetchTtf(`https://fonts.googleapis.com/css2?${families}&text=${subset}`)
  if (buf) cache.set(key, buf)
  return buf
}
