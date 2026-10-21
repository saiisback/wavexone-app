import renderer, { act } from 'react-test-renderer'
import { BackendProvider } from '../../src/backend/provider'
import type { WaveXBackend } from '../../src/backend/contract'
import { useLiveQuote, useLiveQuotesVersion } from '../../src/features/markets/use-live-quote'
import { Text } from '../../src/design-system'
import { NavigationContext, type NavigationProp, type ParamListBase } from '@react-navigation/native'

describe('quote bursts do not flood the shared JS thread', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it.each(['single', 'portfolio'] as const)('coalesces %s renders while preserving the newest quote', (mode) => {
    const listeners = new Set<() => void>()
    let quote = { price: 0, bid: 0, ask: 1, changePercent: 0 }
    const backend = { prices: {
      latest: () => quote,
      subscribe: (_id: string, listener: () => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    } } as unknown as WaveXBackend
    let renders = 0
    function Single() {
      const value = useLiveQuote('gold')
      renders++
      return <Text>{value?.price}</Text>
    }
    function Portfolio() {
      useLiveQuotesVersion(['gold'])
      renders++
      return <Text>{backend.prices.latest('gold')?.price}</Text>
    }
    let tree!: renderer.ReactTestRenderer
    act(() => { tree = renderer.create(<BackendProvider backend={backend}>{mode === 'single' ? <Single /> : <Portfolio />}</BackendProvider>) })
    for (let price = 1; price <= 50; price++) {
      act(() => {
        quote = { price, bid: price, ask: price + 1, changePercent: 0 }
        listeners.forEach((notify) => notify())
      })
    }
    expect(renders).toBeLessThanOrEqual(3)
    act(() => jest.advanceTimersByTime(100))
    expect(JSON.stringify(tree.toJSON())).toContain('50')
    act(() => tree.unmount())
    expect(listeners.size).toBe(0)
    expect(jest.getTimerCount()).toBe(0)
  })

  it.each(['single', 'portfolio'] as const)('pauses hidden %s consumers and resumes with the freshest quote', (mode) => {
    const listeners = new Set<() => void>()
    const focusListeners = new Set<() => void>()
    let focused = true
    let subscriptions = 0
    let quote = { price: 1, bid: 1, ask: 2, changePercent: 0 }
    const backend = { prices: {
      latest: () => quote,
      subscribe: (_id: string, listener: () => void) => {
        subscriptions++
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    } } as unknown as WaveXBackend
    const navigation = {
      isFocused: () => focused,
      addListener: (_event: string, listener: () => void) => {
        focusListeners.add(listener)
        return () => focusListeners.delete(listener)
      },
    } as unknown as NavigationProp<ParamListBase>
    let renders = 0
    function Consumer() {
      const single = useLiveQuote(mode === 'single' ? 'gold' : undefined)
      useLiveQuotesVersion(mode === 'portfolio' ? ['gold'] : [])
      renders++
      return <Text>{mode === 'single' ? single?.price : backend.prices.latest('gold')?.price}</Text>
    }
    let tree!: renderer.ReactTestRenderer
    act(() => { tree = renderer.create(<BackendProvider backend={backend}><NavigationContext.Provider value={navigation}><Consumer /></NavigationContext.Provider></BackendProvider>) })
    const tick = (price: number) => act(() => {
      quote = { price, bid: price, ask: price + 1, changePercent: 0 }
      listeners.forEach((notify) => notify())
    })
    tick(2)
    tick(3)
    expect(subscriptions).toBe(1)
    act(() => { focused = false; focusListeners.forEach((notify) => notify()) })
    const hiddenRenders = renders
    for (let price = 4; price <= 50; price++) {
      tick(price)
      act(() => jest.advanceTimersByTime(100))
    }
    expect(renders - hiddenRenders).toBe(0)
    expect(listeners.size).toBe(0)
    expect(jest.getTimerCount()).toBe(0)
    expect(backend.prices.latest('gold')?.price).toBe(50)
    act(() => { focused = true; focusListeners.forEach((notify) => notify()) })
    expect(JSON.stringify(tree.toJSON())).toContain('50')
    tick(51)
    expect(JSON.stringify(tree.toJSON())).toContain('51')
    expect(subscriptions).toBe(2)
    act(() => tree.unmount())
    expect(listeners.size).toBe(0)
    expect(focusListeners.size).toBe(0)
    expect(jest.getTimerCount()).toBe(0)
  })
})
