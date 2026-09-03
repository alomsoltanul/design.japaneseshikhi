/**
 * Acceptance checks for src/clips/japanese.ts (spec items 2 and 3).
 * Run: npm run check:japanese
 *
 * Node 24 strips the TypeScript types on import, so there is no build step and
 * no test-runner dependency to add.
 */
import {
  furiganaLine, furiganaByStripping, romajiLine, extractVocab, formatVocab,
  katakanaToHiragana, kanaToRomaji, posOf,
} from '../src/clips/japanese.ts'

let pass = 0, fail = 0
const eq = (name, got, want) => {
  if (got === want) { pass++; console.log(`  ok   ${name}`) }
  else { fail++; console.log(`  FAIL ${name}\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`) }
}

// Token shapes below mirror live api.nadeshiko.co responses: abbreviated `pt`,
// English `posLabel`, `kind`, and the precomputed `f` furigana array.
const t = (s, r, pt, extra = {}) => ({ s, d: extra.d ?? s, r, pt, kind: extra.kind ?? 'word', posLabel: extra.posLabel, f: extra.f })
const sym = s => ({ s, d: s, r: s, kind: 'symbol', posLabel: 'Symbol' })

// ── spec item 2: the reference sentence, character for character ────────────
const REF_EXPECTED = 'そこに行(い)けば全(すべ)て分(わ)かるって親父(おやじ)は言(い)った。'

const refWithF = [
  t('そこ', 'ソコ', 'pron', { posLabel: 'Pronoun' }),
  t('に', 'ニ', 'prt', { posLabel: 'Particle', kind: 'function' }),
  t('行け', 'イケ', 'verb', { d: '行く', posLabel: 'Verb', kind: 'inflected', f: [{ t: '行', r: 'い' }, { t: 'け' }] }),
  t('ば', 'バ', 'prt', { posLabel: 'Particle', kind: 'function' }),
  t('全て', 'スベテ', 'adv', { posLabel: 'Adverb', f: [{ t: '全', r: 'すべ' }, { t: 'て' }] }),
  t('分かる', 'ワカル', 'verb', { posLabel: 'Verb', f: [{ t: '分', r: 'わ' }, { t: 'かる' }] }),
  t('って', 'ッテ', 'prt', { posLabel: 'Particle', kind: 'function' }),
  t('親父', 'オヤジ', 'noun', { posLabel: 'Noun', f: [{ t: '親父', r: 'おやじ' }] }),
  t('は', 'ハ', 'prt', { posLabel: 'Particle', kind: 'function' }),
  t('言っ', 'イッ', 'verb', { d: '言う', posLabel: 'Verb', kind: 'inflected', f: [{ t: '言', r: 'い' }, { t: 'っ' }] }),
  t('た', 'タ', 'aux', { posLabel: 'Auxiliary', kind: 'function' }),
  sym('。'),
]
// same sentence with the `f` array removed, to exercise the stripping fallback
const refNoF = refWithF.map(({ f, ...rest }) => rest)

console.log('furigana — reference sentence')
eq('from token.f', furiganaLine(refWithF), REF_EXPECTED)
eq('from stripping fallback', furiganaLine(refNoF), REF_EXPECTED)

console.log('furigana — stripping rules')
eq('食べ + タベ', furiganaByStripping('食べ', 'タベ'), '食(た)べ')
eq('親父 + オヤジ', furiganaByStripping('親父', 'オヤジ'), '親父(おやじ)')
eq('お茶 + オチャ', furiganaByStripping('お茶', 'オチャ'), 'お茶(ちゃ)')
eq('分かる + ワカル', furiganaByStripping('分かる', 'ワカル'), '分(わ)かる')
eq('no kanji passes through', furiganaByStripping('そこ', 'ソコ'), 'そこ')

// ── spec item 3: all five romaji cases ──────────────────────────────────────
console.log('romaji — spec test cases')
eq('言っ + た', romajiLine([
  t('言っ', 'イッ', 'verb', { d: '言う', posLabel: 'Verb', kind: 'inflected' }),
  t('た', 'タ', 'aux', { posLabel: 'Auxiliary', kind: 'function' }),
]), 'itta')

eq('食べ + られ + ない', romajiLine([
  t('食べ', 'タベ', 'verb', { d: '食べる', posLabel: 'Verb', kind: 'inflected' }),
  t('られ', 'ラレ', 'aux', { posLabel: 'Auxiliary', kind: 'function' }),
  t('ない', 'ナイ', 'aux', { posLabel: 'Auxiliary', kind: 'function' }),
]), 'taberarenai')

eq('そこ に 行け ば', romajiLine([
  t('そこ', 'ソコ', 'pron', { posLabel: 'Pronoun' }),
  t('に', 'ニ', 'prt', { posLabel: 'Particle', kind: 'function' }),
  t('行け', 'イケ', 'verb', { d: '行く', posLabel: 'Verb', kind: 'inflected' }),
  t('ば', 'バ', 'prt', { posLabel: 'Particle', kind: 'function' }),
]), 'soko ni ike ba')

eq('私 は 学生 です', romajiLine([
  t('私', 'ワタシ', 'pron', { posLabel: 'Pronoun' }),
  t('は', 'ハ', 'prt', { posLabel: 'Particle', kind: 'function' }),
  t('学生', 'ガクセイ', 'noun', { posLabel: 'Noun' }),
  t('です', 'デス', 'aux', { posLabel: 'Copula', kind: 'function' }),
]), 'watashi wa gakusei desu')

eq('親父 へ 手紙 を', romajiLine([
  t('親父', 'オヤジ', 'noun', { posLabel: 'Noun' }),
  t('へ', 'ヘ', 'prt', { posLabel: 'Particle', kind: 'function' }),
  t('手紙', 'テガミ', 'noun', { posLabel: 'Noun' }),
  t('を', 'ヲ', 'prt', { posLabel: 'Particle', kind: 'function' }),
]), 'oyaji e tegami o')

console.log('romaji — reference sentence')
eq('full line', romajiLine(refWithF), 'soko ni ike ba subete wakaru tte oyaji wa itta')

console.log('kana')
eq('katakana → hiragana', katakanaToHiragana('オヤジ'), 'おやじ')
eq('sokuon doubles', kanaToRomaji('ガッコウ'), 'gakkou')
eq('っち → tchi', kanaToRomaji('マッチャ'), 'matcha')
eq('long mark repeats vowel', kanaToRomaji('ラーメン'), 'raamen')
eq('symbols carry no pt', posOf(sym('。')), 'symbol')
eq('copula split off aux', posOf(t('です', 'デス', 'aux', { posLabel: 'Copula', kind: 'function' })), 'copula')
eq('prt maps to particle', posOf(t('は', 'ハ', 'prt', { posLabel: 'Particle', kind: 'function' })), 'particle')

console.log('vocab')
const vocab = extractVocab(refWithF, '親父')
eq('searched word sorts first', vocab[0].word, '親父')
eq('content words only, capped at 4', vocab.length, 4)
eq('dictionary forms, not surfaces', vocab.map(v => v.word).sort().join(','), ['親父', '行く', '全て', '分かる'].sort().join(','))
eq('format', formatVocab([{ word: '親父', meaning: 'বাবা' }, { word: '行く', meaning: 'যাওয়া' }]), '親父=বাবা, 行く=যাওয়া')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
