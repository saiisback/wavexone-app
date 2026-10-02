/**
 * The few Node APIs the test tooling needs, typed here because the project
 * does not load Node's type definitions (see tests/screens/fixture-boundary).
 */

declare const __dirname: string

export const fs = require('fs') as {
  existsSync(path: string): boolean
  readFileSync(path: string, encoding: 'utf8'): string
  writeFileSync(path: string, data: string): void
  mkdirSync(path: string, options: { recursive: true }): void
  readdirSync(path: string, options: { withFileTypes: true }): { name: string; isDirectory(): boolean }[]
}

export const path = require('path') as {
  join(...parts: string[]): string
  dirname(path: string): string
  basename(path: string): string
}

/** The repository root. */
export const root = path.join(__dirname, '..', '..')
