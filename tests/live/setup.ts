import { fs, path, root } from '../support/node'
import { assertReadOnly, pushFrame, recordHttp, recordSocket } from './recorder'

/**
 * Runs before every live test file, after the preset's own setup.
 *
 *  - loads `WAVEX_LIVE_*` from `.env.local` (gitignored)
 *  - swaps the preset's offline `fetch` for Node's real one, behind a cookie
 *    jar (the portal session is a cookie) and the read-only guard
 *  - wraps the real `WebSocket` so feed traffic can be captured
 */

declare const global: typeof globalThis & {
  __DEV__: boolean
  __nodeFetch: typeof fetch
}

global.__DEV__ = false

const envFile = path.join(root, '.env.local')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^\s*(WAVEX_LIVE_[A-Z_]+)\s*=\s*(.*?)\s*$/)
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
    }
  }
}

const nodeFetch = global.__nodeFetch
const jar = new Map<string, Map<string, string>>()

global.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
  const url = String(input)
  const spec = assertReadOnly(url)
  const host = new URL(url).host
  const headers = { ...(init.headers as Record<string, string> | undefined) }

  // What the iOS/Android cookie store does for the app: send the portal's
  // cookies back when the request asks for credentials.
  const cookies = jar.get(host)
  if (init.credentials === 'include' && cookies && cookies.size > 0) {
    headers.Cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ')
  }

  const response = await nodeFetch(url, { ...init, headers, credentials: undefined })
  for (const header of response.headers.getSetCookie()) {
    const [pair] = header.split(';')
    const at = pair.indexOf('=')
    if (at <= 0) continue
    if (!jar.has(host)) jar.set(host, new Map())
    jar.get(host)!.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim())
  }

  const text = await response.text()
  recordHttp(spec, response.status, text)
  return { status: response.status, text: async () => text } as Response
}) as typeof fetch

const RealWebSocket = global.WebSocket

class RecordingWebSocket extends RealWebSocket {
  private readonly record: ReturnType<typeof recordSocket>

  constructor(url: string | URL, protocols?: string | string[]) {
    super(url, protocols)
    this.record = recordSocket(String(url))
    this.addEventListener('message', (event) => pushFrame(this.record.received, event.data, this.record.limit))
  }

  send(data: string) {
    pushFrame(this.record.sent, data, this.record.limit)
    super.send(data)
  }
}

global.WebSocket = RecordingWebSocket as typeof WebSocket
