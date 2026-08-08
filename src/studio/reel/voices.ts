// Narration for reels. Two backends:
//   • VOICEVOX (localhost) — full engine tuning, unavailable on prod HTTPS.
//   • Azure Neural TTS   — cloud, works from the deployed site.
// The `provider` field on VoiceSettings picks the path; callers stay unaware.
import { getSpeakers, synthesizeJlpt, checkHealth, reelEnvBlocked, type VvSpeaker } from '@/listening/voicevox'
import { synthesizeAzure, checkAzureHealth, AZURE_VOICES, DEFAULT_AZURE_VOICE } from '@/listening/azure'
import type { VoiceSettings } from './voiceSettings'
import type { TtsProvider } from '@/listening/types'

/** Per-role voice slots. Union: VOICEVOX numeric style ids OR Azure voice names. */
export type VoiceId = number | string

export interface Voices {
  narrator: VoiceId
  female: VoiceId
  female2: VoiceId
  male: VoiceId
  male2: VoiceId
}

let speakerCache: VvSpeaker[] | null = null
export async function listVoices(): Promise<VvSpeaker[]> {
  if (!speakerCache) speakerCache = await getSpeakers()
  return speakerCache
}

/** Resolve role → voice id/name, honoring explicit picks from settings.
 *  Picks a second distinct voice per gender so two women/men talking don't sound identical.
 */
export async function resolveVoices(settings: VoiceSettings): Promise<Voices> {
  if (settings.provider === 'azure') {
    // Azure has no /speakers API — pool is static. Pick primary + alt per gender.
    const females = AZURE_VOICES.filter(v => v.gender === 'female').map(v => v.name)
    const males   = AZURE_VOICES.filter(v => v.gender === 'male').map(v => v.name)
    const female  = settings.azureFemale ?? females[0] ?? DEFAULT_AZURE_VOICE
    const female2 = females.find(n => n !== female) ?? female
    const male    = settings.azureMale ?? males[0] ?? DEFAULT_AZURE_VOICE
    const male2   = males.find(n => n !== male) ?? male
    // Narrator defaults to Nanami (studio-quality, warm).
    const narrator = settings.azureNarrator ?? 'ja-JP-NanamiNeural'
    return { narrator, female, female2, male, male2 }
  }

  const fallback: Voices = { narrator: 16, female: 2, female2: 10, male: 11, male2: 13 }
  try {
    const speakers = await listVoices()
    const styleOf = (re: RegExp) => speakers.find(s => re.test(s.name))?.styles?.[0]?.id ?? null
    const female = settings.female ?? styleOf(/めたん|つむぎ|ナナ|ミコ/) ?? speakers[0]?.styles?.[0]?.id ?? fallback.female
    let female2 = styleOf(/はう|ひまり|リツ|ナナ|ミコ/) ?? fallback.female2
    if (female2 === female) female2 = [10, 8, 14, 9, 54].find(id => id !== female) ?? fallback.female2
    const male = settings.male ?? styleOf(/武宏|龍星|つるぎ|そら/) ?? speakers[1]?.styles?.[0]?.id ?? fallback.male
    let male2 = styleOf(/虎太郎|ちび|朱司|宗麟|龍星/) ?? fallback.male2
    if (male2 === male) male2 = [13, 12, 42, 52, 53].find(id => id !== male) ?? fallback.male2
    const narrator = settings.narrator ?? styleOf(/そら|つむぎ|めたん/) ?? female
    return { narrator, female, female2, male, male2 }
  } catch {
    return {
      narrator: settings.narrator ?? fallback.narrator,
      female: settings.female ?? fallback.female,
      female2: fallback.female2,
      male: settings.male ?? fallback.male,
      male2: fallback.male2,
    }
  }
}

/**
 * Verify the selected engine is reachable. Fails fast with an actionable
 * message so the UI can render the fix (start VOICEVOX / switch to Azure).
 */
export async function ensureVoiceEngine(provider: TtsProvider): Promise<void> {
  if (provider === 'azure') {
    if (!(await checkAzureHealth())) {
      throw new Error('Azure TTS route is not reachable. Redeploy or check AZURE_SPEECH_KEY.')
    }
    return
  }
  if (reelEnvBlocked()) {
    throw new Error(
      'VOICEVOX only works on localhost. Switch to Azure in the reel picker to build from the live site, ' +
      'or run this locally at http://localhost:5173.',
    )
  }
  if (!(await checkHealth())) {
    throw new Error('VOICEVOX is not running. Open the VOICEVOX app (http://127.0.0.1:50021) and try again.')
  }
}

/** Synthesize one line → decoded AudioBuffer. Dispatches on settings.provider. */
export async function synthBuffer(
  ctx: BaseAudioContext,
  text: string,
  voice: VoiceId,
  s: VoiceSettings,
): Promise<AudioBuffer> {
  if (s.provider === 'azure') {
    const mp3 = await synthesizeAzure(text, String(voice), { speed: s.speed, pitch: s.pitch })
    return ctx.decodeAudioData(mp3.slice(0))
  }
  const wav = await synthesizeJlpt(text, Number(voice), {
    speed: s.speed,
    pitch: s.pitch,
    intonation: s.intonation,
    volume: s.volume,
    prePhonemeLength: s.prePadding,
    postPhonemeLength: s.postPadding,
    pauseLengthScale: s.pauseScale,
  })
  return ctx.decodeAudioData(wav.slice(0))
}
