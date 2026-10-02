import { fs, path, root } from '../support/node'
import { ENDPOINTS, type EndpointSpec } from '../../src/backend/endpoints'
import { Redactor } from './redaction'

/**
 * Watches every request and socket a live test makes, and — when asked with
 * `WAVEX_CAPTURE=1` — writes them to `tests/fixtures/captured/` for the unit
 * tests to replay.
 *
 * It is also the read-only guard: a request to anything the endpoint
 * registry marks as a mutation fails before it leaves the machine.
 */

export const CAPTURE_DIR = path.join(root, 'tests', 'fixtures', 'captured')

/** Ticks arrive several times a second; this many frames shows the shape and the movement. */
const MAX_FRAMES_PER_SOCKET = 40

type HttpRecord = { transport: EndpointSpec['transport']; name: string; status: number; text: string }
type SocketRecord = { url: string; sent: unknown[]; received: unknown[]; limit: number }

const http = new Map<string, HttpRecord>()
const sockets: SocketRecord[] = []
const forbidden: (string | undefined)[] = []

const byRoute = new Map<string, EndpointSpec>(
  Object.values(ENDPOINTS as Record<string, EndpointSpec>).map((spec) => [`${spec.transport}:${spec.name}`, spec]),
)

/** Which registry entry a URL belongs to, or throws for one the app does not know. */
export function endpointFor(url: string): EndpointSpec {
  const parsed = new URL(url)
  const collect = parsed.searchParams.get('collect')
  const route = parsed.pathname.includes('/api-v1/')
    ? `trading:${collect}`
    : parsed.pathname.includes('/charting_library2/')
      ? `charting:${collect}`
      : `portal:${parsed.pathname.split('/').filter(Boolean).at(-1)}`
  const spec = byRoute.get(route)
  if (!spec) throw new Error(`Live tests reached an endpoint missing from the registry: ${route}`)
  return spec
}

/** Throws for anything that would change server state. */
export function assertReadOnly(url: string): EndpointSpec {
  const spec = endpointFor(url)
  if (spec.mutation) {
    throw new Error(`Live tests are read-only; "${spec.name}" changes server state and was not sent.`)
  }
  return spec
}

export function recordHttp(spec: EndpointSpec, status: number, text: string): void {
  http.set(`${spec.transport}/${spec.name}`, { transport: spec.transport, name: spec.name, status, text })
}

export function recordSocket(url: string): SocketRecord {
  // Only the price stream needs trimming; a chart socket's replies are its data.
  const limit = url.endsWith('/ticks') ? MAX_FRAMES_PER_SOCKET : Number.POSITIVE_INFINITY
  const record: SocketRecord = { url, sent: [], received: [], limit }
  sockets.push(record)
  return record
}

export function pushFrame(list: unknown[], data: unknown, limit: number): void {
  if (list.length >= limit) return
  try {
    list.push(JSON.parse(String(data)))
  } catch {
    list.push(String(data))
  }
}

/** Values the run must never write, whatever key they turn up under. */
export function forbid(...values: (string | undefined)[]): void {
  forbidden.push(...values)
}

function parseBody(text: string): unknown {
  const trimmed = text.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      // Not JSON after all; kept as text below.
    }
  }
  return text
}

type Bodies = Map<string, { record: HttpRecord; body: unknown }>

/**
 * Keeps money only for demo accounts. Refuses outright when the signed-in
 * account is not a demo account: its orders, history and funding numbers
 * would be someone's real money.
 */
function keepDemoOnly(bodies: Bodies): string[] {
  const dropped: string[] = []
  const checked = bodies.get('trading/check')?.body as Record<string, unknown> | undefined
  // Sign-in may or may not wrap its fields in a `{status, data}` envelope.
  const check =
    checked?.data && typeof checked.data === 'object' ? (checked.data as Record<string, unknown>) : checked
  const bootstrap = bodies.get('portal/apiBootstrap')?.body as
    | { data?: Record<string, unknown> }
    | undefined
  if (!check || !bootstrap?.data) return dropped

  const sessionToken = String(check.token ?? check.accountToken ?? check.account_token ?? '')
  const accounts = (bootstrap.data.accounts ?? []) as Record<string, unknown>[]
  const ids = (account: Record<string, unknown>) =>
    [account.token, account.id, account.code].filter((v) => v !== undefined).map(String)
  const current = accounts.find((account) => ids(account).includes(sessionToken))
  if (!current || current.isDemo !== true) {
    throw new Error(
      'Capture refused: sign in with a DEMO account. The signed-in account is live, so its orders, ' +
        'history and balances are real money and must not be committed.',
    )
  }

  const demo = accounts.filter((account) => account.isDemo === true)
  const demoIds = new Set(demo.flatMap(ids))
  if (demo.length !== accounts.length) dropped.push(`apiBootstrap: ${accounts.length - demo.length} live account(s)`)
  bootstrap.data.accounts = demo

  const transactions = bootstrap.data.transactions as unknown
  const keepTransaction = (entry: Record<string, unknown>) =>
    entry.accountId !== undefined && demoIds.has(String(entry.accountId))
  if (Array.isArray(transactions)) {
    bootstrap.data.transactions = transactions.filter(keepTransaction)
  } else if (transactions && typeof transactions === 'object' && Array.isArray((transactions as { items?: unknown }).items)) {
    const items = (transactions as { items: Record<string, unknown>[] }).items
    bootstrap.data.transactions = { ...(transactions as object), items: items.filter(keepTransaction) }
  }

  // Totals recomputed from the accounts that remain, so they still agree.
  const summary = bootstrap.data.summary as Record<string, unknown> | undefined
  if (summary && demo.length !== accounts.length) {
    const sum = (key: string) => demo.reduce((total, account) => total + Number(account[key] ?? 0), 0)
    bootstrap.data.summary = {
      ...summary,
      totalFund: sum('fund'),
      totalBalance: sum('balance'),
      totalEquity: sum('equity'),
      accountCount: demo.length,
    }
  }

  // Sections the app does not read: wallets, referral trees, saved payment
  // details. Nothing in them is needed, and some are personal.
  for (const key of Object.keys(bootstrap.data)) {
    if (!['user', 'accounts', 'summary', 'transactions'].includes(key)) {
      delete bootstrap.data[key]
      dropped.push(`apiBootstrap.data.${key}`)
    }
  }

  const accountList = bodies.get('trading/accountList')?.body
  if (Array.isArray(accountList)) {
    const kept = accountList.filter((entry: Record<string, unknown>) =>
      [entry.token, entry.account_id].some((value) => value !== undefined && demoIds.has(String(value))),
    )
    if (kept.length !== accountList.length) dropped.push(`accountList: ${accountList.length - kept.length} live account(s)`)
    bodies.get('trading/accountList')!.body = kept
  }

  const redeem = bodies.get('portal/apiRedeemConfig')?.body as { data?: Record<string, unknown> } | undefined
  for (const key of ['savedPayment', 'wallets']) {
    if (redeem?.data && key in redeem.data) {
      delete redeem.data[key]
      dropped.push(`apiRedeemConfig.data.${key}`)
    }
  }
  return dropped
}

/** Writes this test file's captures. `suite` names the feed capture file. */
export function flushCaptures(suite: string): void {
  const redactor = new Redactor()
  forbidden.forEach((value) => redactor.forbid(value))

  const bodies: Bodies = new Map(
    [...http].map(([key, record]) => [key, { record, body: parseBody(record.text) }]),
  )
  const dropped = keepDemoOnly(bodies)

  // The bearer endpoint answers with a bare token, not a document.
  const bearer = bodies.get('trading/bearer')
  if (bearer && typeof bearer.body === 'string') bearer.body = redactor.pseudonym('bearer', bearer.body.trim())

  // Key-based pass over everything first, so the sweep knows every secret.
  const redactedHttp = [...bodies].map(([key, { record, body }]) => [key, record, redactor.redact(body)] as const)
  const redactedSockets = sockets.map((socket) => ({
    url: socket.url,
    sent: redactor.redactFeed(socket.sent),
    received: redactor.redactFeed(socket.received),
  }))

  const written: string[] = []
  const write = (relative: string, value: unknown) => {
    const text = `${JSON.stringify(redactor.sweep(value), null, 2)}\n`
    const leaks = redactor.leaks(text)
    if (leaks.length > 0) throw new Error(`Capture of ${relative} still contains ${leaks.length} redacted value(s).`)
    const file = path.join(CAPTURE_DIR, relative)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, text)
    written.push(relative)
  }

  for (const [key, record, body] of redactedHttp) {
    write(`http/${suite}/${key}.json`, { status: record.status, body })
  }
  if (redactedSockets.length > 0) write(`feeds/${suite}.json`, { sockets: redactedSockets })

  if (written.length === 0) return
  const manifestFile = path.join(CAPTURE_DIR, 'manifest.json')
  const manifest = fs.existsSync(manifestFile)
    ? (JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as Record<string, unknown>)
    : {}
  manifest[suite] = { capturedAt: new Date().toISOString(), files: written, dropped }
  fs.mkdirSync(CAPTURE_DIR, { recursive: true })
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
}

/** What the sockets to one endpoint have received so far, for assertions. */
export function socketTraffic(urlSuffix: string): SocketRecord[] {
  return sockets.filter((socket) => socket.url.endsWith(urlSuffix))
}
