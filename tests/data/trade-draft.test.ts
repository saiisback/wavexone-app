import { instruments } from '../../src/data/mock'
import { useTradeDraft } from '../../src/data/trade-draft'

/**
 * The lot size is the one number on the ticket the user edits by tapping a
 * stepper repeatedly, so it is the one most exposed to floating-point drift
 * accumulating into something like "0.7000000000000001 lots".
 */

const INITIAL = useTradeDraft.getState()

beforeEach(() => {
  useTradeDraft.setState(INITIAL, true)
})

const lots = () => useTradeDraft.getState().lots
const setLots = (updater: (previous: number) => number) =>
  useTradeDraft.getState().setLots(updater)

describe('defaults', () => {
  it('waits for the live catalogue before selecting an instrument', () => {
    expect(useTradeDraft.getState().instrumentId).toBeNull()
    expect(useTradeDraft.getState().orderType).toBe('Market')
    expect(lots()).toBe(0.5)
  })
})

describe('lot sizing', () => {
  it('steps up and down', () => {
    setLots((previous) => previous + 0.1)
    expect(lots()).toBe(0.6)
    setLots((previous) => previous - 0.1)
    expect(lots()).toBe(0.5)
  })

  it('does not accumulate binary drift across many steps', () => {
    // 0.1 + 0.2 is the classic case; ten increments is the realistic one.
    for (let step = 0; step < 10; step += 1) setLots((previous) => previous + 0.1)
    expect(lots()).toBe(1.5)
  })

  it('rounds to the two places the ticket displays', () => {
    setLots(() => 0.123456)
    expect(lots()).toBe(0.12)
  })

  it('clamps at the minimum tradeable size rather than going to zero', () => {
    setLots(() => 0)
    expect(lots()).toBe(0.01)
  })

  it('clamps a negative size, so a stepper held down cannot invert the order', () => {
    setLots(() => -5)
    expect(lots()).toBe(0.01)
  })

  it('clamps a value that rounds down to zero', () => {
    setLots(() => 0.001)
    expect(lots()).toBe(0.01)
  })

  it('steps down to the floor without passing it', () => {
    setLots(() => 0.05)
    for (let step = 0; step < 10; step += 1) setLots((previous) => previous - 0.01)
    expect(lots()).toBe(0.01)
  })
})

describe('instrument and order type', () => {
  it('follows the instrument picked in the sheet', () => {
    // The picker is a root-stack sheet, which is why this lives in a store
    // rather than in route params.
    const target = instruments[2].id
    useTradeDraft.getState().setInstrumentId(target)
    expect(useTradeDraft.getState().instrumentId).toBe(target)
  })

  it.each(['Market', 'Limit', 'Stop'] as const)('accepts the %s order type', (type) => {
    useTradeDraft.getState().setOrderType(type)
    expect(useTradeDraft.getState().orderType).toBe(type)
  })

  it('keeps the lot size when the instrument changes', () => {
    setLots(() => 2)
    useTradeDraft.getState().setInstrumentId(instruments[1].id)
    expect(lots()).toBe(2)
  })
})
