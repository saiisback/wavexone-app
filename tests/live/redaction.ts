/**
 * What a capture is allowed to keep.
 *
 * Captures are real server responses, committed so the unit tests run on
 * what the API actually sends. Market data is public and kept as it arrived.
 * Anything that identifies a person or authenticates a session is replaced
 * with a stable pseudonym: the same real value always maps to the same
 * stand-in, so the joins the app relies on (session token ↔ account list ↔
 * portal account) still line up after redaction.
 *
 * Money is kept only for demo accounts. A capture run refuses to write
 * anything unless the signed-in account is a demo account, and any live
 * account the same login can see is dropped before writing.
 */

/** Keys whose value identifies or authenticates someone, at any depth. */
const IDENTITY_KEYS = new Set(
  [
    // Same list `src/backend/redact.ts` keeps out of logs.
    'token',
    'accounttoken',
    'account_token',
    'secretkey',
    'secret_key',
    'bearer',
    'authorization',
    'cookie',
    'password',
    'pass',
    'otp',
    'footprint',
    'fingerprint',
    'switchtoken',
    'user_token',
    'referid_token',
    // Identity and contact details.
    'session_id',
    'sessionid',
    'uid',
    'userid',
    'user_id',
    'accountid',
    'account_id',
    'targetaccountid',
    'sourceid',
    'email',
    'mobile',
    'phone',
    'number',
    'address',
    'withdrawaddress',
    'reference',
    'paymentproof',
    'ip',
    'iban',
    'swift',
    'manager_id',
    'referral',
    'referral_code',
    'referralcode',
  ].map((key) => key.toLowerCase()),
)

/**
 * On the sockets only credentials need hiding. `uid` there is a request
 * correlation id (the feed echoes it back), and the payloads are public
 * market data.
 */
const FEED_KEYS = new Set(['token', 'accounttoken', 'account_token', 'bearer', 'secretkey', 'secret_key'])

/** Inside an account record, these identify the account too. */
const ACCOUNT_KEYS = new Set(['id', 'code', 'login', 'name', 'holder'])

/** Inside the portal user record, these identify the person. */
const USER_KEYS = new Set(['id', 'name', 'first_name', 'last_name', 'fullname', 'username', 'avatar'])

function isAccountRecord(value: Record<string, unknown>): boolean {
  return 'balance' in value && ('code' in value || 'book' in value || 'equity' in value)
}

export class Redactor {
  private readonly pseudonyms = new Map<string, string | number>()
  private readonly counters = new Map<string, number>()

  /** Values seen at identity keys, swept out of free text (URLs, messages) too. */
  private readonly secrets = new Set<string>()

  /** Registers a value that must never appear in a capture, e.g. the login email. */
  forbid(value: string | undefined): void {
    if (value && value.length >= 4) this.secrets.add(value)
  }

  /** The stand-in for one real value. Numbers stay numbers, digit strings stay digits. */
  pseudonym(label: string, value: string | number): string | number {
    const key = String(value)
    const known = this.pseudonyms.get(key)
    if (known !== undefined) return typeof value === 'number' ? Number(known) : String(known)

    const count = (this.counters.get(label) ?? 0) + 1
    this.counters.set(label, count)
    let stand: string | number
    if (typeof value === 'number' || /^\d+$/.test(key)) {
      // Six digits keeps an account code looking like an account code.
      stand = 900000 + this.pseudonyms.size + 1
    } else if (key.includes('@')) {
      stand = `redacted-${count}@example.invalid`
    } else {
      stand = `redacted-${label}-${count}`
    }
    this.pseudonyms.set(key, stand)
    this.forbid(key)
    return typeof value === 'number' ? Number(stand) : String(stand)
  }

  /** Socket traffic: credentials only. */
  redactFeed(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((entry) => this.redactFeed(entry))
    if (value === null || typeof value !== 'object') return value
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        FEED_KEYS.has(key.toLowerCase()) && (typeof entry === 'string' || typeof entry === 'number')
          ? this.pseudonym(key.toLowerCase(), entry)
          : this.redactFeed(entry),
      ]),
    )
  }

  /** First pass: replace identity values by key, remembering every one replaced. */
  redact(value: unknown, context: 'user' | null = null): unknown {
    if (Array.isArray(value)) return value.map((entry) => this.redact(entry, context))
    if (value === null || typeof value !== 'object') return value

    const record = value as Record<string, unknown>
    const inAccount = isAccountRecord(record)
    const output: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(record)) {
      const normalized = key.toLowerCase()
      const identity =
        IDENTITY_KEYS.has(normalized) ||
        (inAccount && ACCOUNT_KEYS.has(normalized)) ||
        (context === 'user' && USER_KEYS.has(normalized))

      if (identity && (typeof entry === 'string' || typeof entry === 'number')) {
        output[key] = entry === '' ? '' : this.pseudonym(normalized, entry)
      } else {
        output[key] = this.redact(entry, key === 'user' ? 'user' : null)
      }
    }
    return output
  }

  /** Second pass: no remembered secret survives inside any other string. */
  sweep(value: unknown): unknown {
    if (typeof value === 'string') return this.sweepText(value)
    if (Array.isArray(value)) return value.map((entry) => this.sweep(entry))
    if (value === null || typeof value !== 'object') return value
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, this.sweep(entry)]),
    )
  }

  sweepText(text: string): string {
    let output = text
    // Longest first, so a token is not half-replaced by a shorter id inside it.
    for (const secret of [...this.secrets].sort((a, b) => b.length - a.length)) {
      if (!output.includes(secret)) continue
      const stand = this.pseudonyms.get(secret) ?? '[redacted]'
      output = output.split(secret).join(String(stand))
    }
    return output
  }

  /** True when `text` still holds anything this run was told to hide. */
  leaks(text: string): string[] {
    return [...this.secrets].filter((secret) => text.includes(secret))
  }
}
