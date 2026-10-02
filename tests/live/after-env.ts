import { path } from '../support/node'
import { flushCaptures } from './recorder'

/**
 * `npm run capture:fixtures` sets WAVEX_CAPTURE=1. Each live test file then
 * writes what it saw once its tests finish, named after the file.
 */
if (process.env.WAVEX_CAPTURE === '1') {
  afterAll(() => {
    flushCaptures(path.basename(expect.getState().testPath ?? 'unknown').replace(/\.live\.test\.ts$/, ''))
  })
}
