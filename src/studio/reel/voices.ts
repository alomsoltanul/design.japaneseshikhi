// VOICEVOX narration for reels. Reuses the repo's VOICEVOX client and applies
// consistent, user-tunable params so speakers don't sound fast/slow/quiet.
import { getSpeakers, audioQuery, synthesize, checkHealth, reelEnvBlocked, type VvSpeaker } from '@/listening/voicevox'
import type { VoiceSettings } from './voiceSettings'

export interface Voices {
  narrator: number
  female: number
  female2: number
  male: number
  male2: number
}

let speakerCache: VvSpeaker[] | null = null
export async function listVoices(): Promise<VvSpeaker[]> {
  if (!speakerCache) speakerCache = await getSpeakers()
  return speakerCache
}

/** Resolve role → style id, honoring explicit picks from settings.
 *  Picks a second distinct voice per gender so two women/men talking don't sound identical.
 */
export async function resolveVoices(settings: VoiceSettings): Promise<Voices> {
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

export async function ensureVoicevox(): Promise<void> {
  if (reelEnvBlocked()) {
    throw new Error(
      'Reels need VOICEVOX, which runs on your computer. The live HTTPS site can’t reach it. ' +
      'Build reels locally: run `npm run dev` and open http://localhost:5173/listening.',
    )
  }
  if (!(await checkHealth())) {
    throw new Error('VOICEVOX is not running. Open the VOICEVOX app (http://127.0.0.1:50021) and try again.')
  }
}

/** Synthesize one line with consistent params → decoded AudioBuffer. */
export async function synthBuffer(
  ctx: BaseAudioContext,
  text: string,
  speakerId: number,
  s: VoiceSettings,
): Promise<AudioBuffer> {
  const query = await audioQuery(text, speakerId)
  query.speedScale = s.speed
  query.volumeScale = s.volume
  query.intonationScale = s.intonation
  query.prePhonemeLength = s.prePadding
  query.postPhonemeLength = s.postPadding
  const wav = await synthesize(query, speakerId)
  return ctx.decodeAudioData(wav.slice(0))
}
