import { fs, path, root } from '../support/node'

/**
 * Captures are committed, so this runs on every `npm test`: nothing in them
 * may identify a person, authenticate a session, or show real money.
 * `tests/live/redaction.ts` is meant to guarantee that; this checks the
 * result rather than trusting it.
 */

const dir = path.join(root, 'tests', 'fixtures', 'captured')

function jsonFiles(folder: string): string[] {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(folder, entry.name)
    if (entry.isDirectory()) return jsonFiles(child)
    return entry.name.endsWith('.json') ? [child] : []
  })
}

const files = jsonFiles(dir).map((file) => ({
  name: file.slice(dir.length + 1),
  text: fs.readFileSync(file, 'utf8'),
}))

it('has captures to check', () => {
  expect(files.length).toBeGreaterThan(0)
})

describe.each(files)('$name', ({ name, text }) => {
  it('holds no email address except a pseudonym', () => {
    const emails = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? []
    expect(emails.filter((email) => !email.endsWith('@example.invalid'))).toEqual([])
  })

  it('holds no JWT or long hex secret', () => {
    expect(text).not.toMatch(/eyJ[\w-]{10,}\.[\w-]{10,}/)
    expect(text).not.toMatch(/[0-9a-f]{32,}/i)
  })

  if (name.endsWith('apiBootstrap.json') || name.endsWith('accountList.json')) {
    it('keeps money for demo accounts only', () => {
      const body = (JSON.parse(text) as { body: unknown }).body
      const accounts = Array.isArray(body)
        ? (body as Record<string, unknown>[])
        : ((body as { data?: { accounts?: Record<string, unknown>[] } }).data?.accounts ?? [])
      for (const account of accounts) {
        if ('isDemo' in account) expect(account.isDemo).toBe(true)
        if ('book' in account) expect(String(account.book).toUpperCase()).toBe('DEMO')
      }
    })
  }
})
