declare const __dirname: string
declare function require(name: string): unknown

const fs = require('fs') as {
  readdirSync(path: string, options: { withFileTypes: true }): { name: string; isDirectory(): boolean }[]
  readFileSync(path: string, encoding: string): string
}
const path = require('path') as {
  resolve(...parts: string[]): string
  join(...parts: string[]): string
  relative(from: string, to: string): string
}

const root = path.resolve(__dirname, '../..')

function filesUnder(relative: string): string[] {
  const absolute = path.join(root, relative)
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(absolute, entry.name)
    return entry.isDirectory()
      ? filesUnder(path.relative(root, child))
      : /\.(ts|tsx)$/.test(entry.name) ? [child] : []
  })
}

it('keeps fixture data outside screens, features, navigation, and the live adapter', () => {
  const files = [
    ...filesUnder('src/screens'),
    ...filesUnder('src/features'),
    ...filesUnder('src/navigation'),
    path.join(root, 'src/backend/live-backend.ts'),
  ]
  const offenders = files.filter((file) => /data\/mock/.test(fs.readFileSync(file, 'utf8')))
  expect(offenders).toEqual([])
})

it('keeps text, press targets, inputs, and images behind the design system', () => {
  const offenders = filesUnder('src/screens').filter((file) => {
    const source = fs.readFileSync(file, 'utf8')
    return /import\s*{[^}]*\b(Text|Pressable|TextInput|Image)\b[^}]*}\s*from\s*['"]react-native['"]/.test(source)
  })
  expect(offenders).toEqual([])
})
