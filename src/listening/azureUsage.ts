/**
 * Local Azure TTS character usage tracker.
 *
 * Azure Speech doesn't expose a live "credits remaining" endpoint from the
 * browser without a management-plane token, so this tracks characters sent
 * through /api/tts/azure locally (per-browser). Values roll over on the 1st
 * of each month to match Azure's billing period.
 *
 * Quota default (500,000 chars/month) matches the F0 free tier for Neural
 * voices — override via UI or setAzureQuota() to reflect your S0 plan.
 */

const LS_KEY = 'azure-tts-usage-v1'
export const DEFAULT_MONTHLY_QUOTA = 500_000

export interface AzureUsageState {
  monthKey: string      // YYYY-MM (UTC) — rollover marker
  used: number          // chars synthesized this month
  quota: number         // configured monthly quota
  lastAt: number        // epoch ms of last recorded synth
}

function currentMonthKey(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function readRaw(): AzureUsageState {
  if (typeof localStorage === 'undefined') {
    return { monthKey: currentMonthKey(), used: 0, quota: DEFAULT_MONTHLY_QUOTA, lastAt: 0 }
  }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) throw new Error('empty')
    const parsed = JSON.parse(raw) as Partial<AzureUsageState>
    return {
      monthKey: typeof parsed.monthKey === 'string' ? parsed.monthKey : currentMonthKey(),
      used: typeof parsed.used === 'number' && parsed.used >= 0 ? parsed.used : 0,
      quota: typeof parsed.quota === 'number' && parsed.quota > 0 ? parsed.quota : DEFAULT_MONTHLY_QUOTA,
      lastAt: typeof parsed.lastAt === 'number' ? parsed.lastAt : 0,
    }
  } catch {
    return { monthKey: currentMonthKey(), used: 0, quota: DEFAULT_MONTHLY_QUOTA, lastAt: 0 }
  }
}

function writeRaw(s: AzureUsageState): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch { /* quota exceeded etc — ignore */ }
}

/** Read current usage, auto-rolling over on new month. */
export function getAzureUsage(): AzureUsageState {
  const s = readRaw()
  const now = currentMonthKey()
  if (s.monthKey !== now) {
    const rolled = { ...s, monthKey: now, used: 0 }
    writeRaw(rolled)
    return rolled
  }
  return s
}

/** Record a successful synth. Fires a `storage` event listeners can hook. */
export function recordAzureUsage(chars: number): AzureUsageState {
  if (!chars || chars < 0) return getAzureUsage()
  const current = getAzureUsage()
  const next: AzureUsageState = { ...current, used: current.used + chars, lastAt: Date.now() }
  writeRaw(next)
  // Custom event for same-tab listeners (storage event doesn't fire in-tab).
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('azure-usage-change', { detail: next }))
  }
  return next
}

export function setAzureQuota(quota: number): AzureUsageState {
  if (!(quota > 0)) return getAzureUsage()
  const next = { ...getAzureUsage(), quota: Math.round(quota) }
  writeRaw(next)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('azure-usage-change', { detail: next }))
  }
  return next
}

export function resetAzureUsage(): AzureUsageState {
  const next: AzureUsageState = { monthKey: currentMonthKey(), used: 0, quota: getAzureUsage().quota, lastAt: 0 }
  writeRaw(next)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('azure-usage-change', { detail: next }))
  }
  return next
}

/** Format e.g. 12,345 / 500,000 (2.5%). */
export function formatUsage(s: AzureUsageState): string {
  const pct = s.quota > 0 ? (s.used / s.quota) * 100 : 0
  return `${s.used.toLocaleString()} / ${s.quota.toLocaleString()} (${pct.toFixed(1)}%)`
}

// ── Live Azure usage fetch ───────────────────────────────────────────────

export interface AzureLiveUsageMeter { meter: string; quantity: number; cost: number; unit: string }
export interface AzureLiveUsage {
  configured: true
  monthKey: string
  monthStartUtc: string
  monthEndUtc: string
  resourceId: string
  subscriptionId: string
  monitor: { synthesizedCharacters: number | null; totalTransactions: number | null } | null
  monitorError: string | null
  cost: { quantity: number; cost: number; currency: string; byMeter: AzureLiveUsageMeter[] } | null
  costError: string | null
  updatedAt: string
}
export interface AzureUnconfigured {
  configured: false
  missing: string[]
  message: string
}
export type AzureUsageResponse = AzureLiveUsage | AzureUnconfigured

export async function fetchAzureLiveUsage(): Promise<AzureUsageResponse> {
  const res = await fetch('/api/tts/azure-usage', { method: 'GET' })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`azure usage ${res.status}: ${detail.slice(0, 200)}`)
  }
  return res.json() as Promise<AzureUsageResponse>
}
