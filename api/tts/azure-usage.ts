import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guard, bad } from '../_lib/http.js'

/**
 * Live Azure Speech usage — this month, straight from the Azure control
 * plane. Two independent sources:
 *   1) Azure Monitor metric `SynthesizedCharacters` on the Speech account
 *      (billed characters, updated within minutes).
 *   2) Cost Management `Query` with UsageQuantity for the same resource
 *      (billed units, updated within a few hours).
 *
 * Requires a service principal with at minimum:
 *   - Reader role on the Speech resource   → enables (1)
 *   - Cost Management Reader on the sub    → enables (2)
 *
 * Env vars:
 *   AZURE_TENANT_ID
 *   AZURE_CLIENT_ID
 *   AZURE_CLIENT_SECRET
 *   AZURE_SPEECH_RESOURCE_ID  (full ARM id: /subscriptions/.../providers/Microsoft.CognitiveServices/accounts/<name>)
 *   AZURE_SUBSCRIPTION_ID     (optional — parsed from resource id if omitted)
 */

// Module-level token cache. Vercel Fluid keeps warm instances alive across
// requests, so this avoids hitting AAD on every call. TTL 55 min < AAD 60 min.
let tokenCache: { token: string; expiresAt: number } | null = null

async function getMgmtToken(tenant: string, clientId: string, clientSecret: string): Promise<string> {
  const now = Date.now()
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.token
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://management.azure.com/.default',
    grant_type: 'client_credentials',
  })
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`aad token ${res.status}: ${detail.slice(0, 240)}`)
  }
  const j = await res.json() as { access_token: string; expires_in: number }
  tokenCache = { token: j.access_token, expiresAt: now + (j.expires_in ?? 3600) * 1000 }
  return j.access_token
}

interface MonitorMetricsResp {
  value: Array<{
    name: { value: string }
    unit: string
    timeseries: Array<{ data: Array<{ timeStamp: string; total?: number; average?: number; count?: number }> }>
  }>
}

async function queryMonitorMetric(
  token: string, resourceId: string, metricName: string, startIso: string, endIso: string,
): Promise<number | null> {
  const url = `https://management.azure.com${resourceId}/providers/Microsoft.Insights/metrics` +
    `?api-version=2021-05-01&metricnames=${encodeURIComponent(metricName)}` +
    `&aggregation=Total&timespan=${startIso}/${endIso}&interval=P1D`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    // 400 InvalidMetricName means this metric isn't exposed for this resource.
    if (res.status === 400 && /InvalidMetricName|Failed to find metric/i.test(detail)) return null
    throw new Error(`monitor ${metricName} ${res.status}: ${detail.slice(0, 240)}`)
  }
  const j = await res.json() as MonitorMetricsResp
  const series = j.value?.[0]?.timeseries?.[0]?.data ?? []
  let sum = 0
  for (const pt of series) if (typeof pt.total === 'number') sum += pt.total
  return sum
}

interface CostQueryResp {
  properties?: {
    columns?: Array<{ name: string; type: string }>
    rows?: Array<Array<string | number>>
  }
}

async function queryCostManagement(
  token: string, subscriptionId: string, resourceId: string,
): Promise<{ quantity: number; cost: number; currency: string; byMeter: Array<{ meter: string; quantity: number; cost: number; unit: string }> } | null> {
  const url = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`
  // Subscription-scope query: only sub-scope groupings are legal here
  // (MeterName is billing-account-scope only). We already filter by
  // ResourceId so ungrouped totals map to just this Speech account.
  const body = {
    type: 'ActualCost',
    timeframe: 'BillingMonthToDate',
    dataset: {
      granularity: 'None',
      aggregation: {
        totalQuantity: { name: 'UsageQuantity', function: 'Sum' },
        totalCost: { name: 'Cost', function: 'Sum' },
      },
      filter: {
        dimensions: {
          name: 'ResourceId',
          operator: 'In',
          values: [resourceId.toLowerCase()],
        },
      },
    },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    // 403 = missing Cost Management Reader; treat as "not available" not error.
    if (res.status === 403) return null
    throw new Error(`cost query ${res.status}: ${detail.slice(0, 240)}`)
  }
  const j = await res.json() as CostQueryResp
  const cols = j.properties?.columns ?? []
  const rows = j.properties?.rows ?? []
  const colIdx = (n: string) => cols.findIndex(c => c.name === n)
  const iQty = colIdx('UsageQuantity'), iCost = colIdx('Cost')
  const iCurrency = colIdx('Currency'), iMeter = colIdx('MeterName'), iUnit = colIdx('UnitOfMeasure')
  let quantity = 0, cost = 0, currency = 'USD'
  const byMeter: Array<{ meter: string; quantity: number; cost: number; unit: string }> = []
  const hasMeterCol = iMeter >= 0
  for (const row of rows) {
    const q = iQty >= 0 ? Number(row[iQty]) || 0 : 0
    const c = iCost >= 0 ? Number(row[iCost]) || 0 : 0
    quantity += q
    cost += c
    if (iCurrency >= 0 && row[iCurrency]) currency = String(row[iCurrency])
    // Only surface per-meter rows when the API actually grouped by MeterName.
    if (hasMeterCol) {
      byMeter.push({
        meter: String(row[iMeter]),
        quantity: q, cost: c,
        unit: iUnit >= 0 ? String(row[iUnit]) : '',
      })
    }
  }
  return { quantity, cost, currency, byMeter }
}

function firstOfMonthUtcIso(): { startIso: string; endIso: string; monthKey: string } {
  const now = new Date()
  const y = now.getUTCFullYear(), m = now.getUTCMonth()
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0))
  const end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0))
  const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`
  return { startIso: start.toISOString(), endIso: end.toISOString(), monthKey }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, ['GET'])) return

  const tenant = process.env.AZURE_TENANT_ID
  const clientId = process.env.AZURE_CLIENT_ID
  const clientSecret = process.env.AZURE_CLIENT_SECRET
  const resourceId = process.env.AZURE_SPEECH_RESOURCE_ID
  const subFromEnv = process.env.AZURE_SUBSCRIPTION_ID

  const missing: string[] = []
  if (!tenant) missing.push('AZURE_TENANT_ID')
  if (!clientId) missing.push('AZURE_CLIENT_ID')
  if (!clientSecret) missing.push('AZURE_CLIENT_SECRET')
  if (!resourceId) missing.push('AZURE_SPEECH_RESOURCE_ID')

  if (missing.length) {
    return res.status(200).json({
      configured: false,
      missing,
      message: `Set these Vercel env vars to see live Azure usage: ${missing.join(', ')}. ` +
        `Create a service principal (az ad sp create-for-rbac), grant it Reader on the Speech resource + Cost Management Reader on the subscription.`,
    })
  }

  const rid = resourceId!
  const subscriptionId = subFromEnv || rid.match(/\/subscriptions\/([^/]+)/i)?.[1]
  if (!subscriptionId) {
    return bad(res, 'Cannot derive subscription id — set AZURE_SUBSCRIPTION_ID or fix AZURE_SPEECH_RESOURCE_ID', 500)
  }

  const { startIso, endIso, monthKey } = firstOfMonthUtcIso()

  try {
    const token = await getMgmtToken(tenant!, clientId!, clientSecret!)

    // Kick off both queries in parallel — either can fail independently.
    const [monitor, cost] = await Promise.allSettled([
      (async () => {
        // Try char-level metric first; if not exposed, fall back to transaction count.
        const chars = await queryMonitorMetric(token, rid, 'SynthesizedCharacters', startIso, endIso)
        const trans = await queryMonitorMetric(token, rid, 'TotalTransactions', startIso, endIso)
        return { synthesizedCharacters: chars, totalTransactions: trans }
      })(),
      queryCostManagement(token, subscriptionId, rid),
    ])

    const monitorData = monitor.status === 'fulfilled' ? monitor.value : null
    const monitorError = monitor.status === 'rejected' ? String((monitor.reason as Error)?.message ?? monitor.reason) : null
    const costData = cost.status === 'fulfilled' ? cost.value : null
    const costError = cost.status === 'rejected' ? String((cost.reason as Error)?.message ?? cost.reason) : null

    res.setHeader('Cache-Control', 'private, max-age=60')
    return res.status(200).json({
      configured: true,
      monthKey,
      monthStartUtc: startIso,
      monthEndUtc: endIso,
      resourceId: rid,
      subscriptionId,
      monitor: monitorData,
      monitorError,
      cost: costData,
      costError,
      updatedAt: new Date().toISOString(),
    })
  } catch (e: any) {
    return bad(res, e?.message ?? String(e), 502)
  }
}
