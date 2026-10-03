import { Text } from 'react-native'
import renderer, { act } from 'react-test-renderer'

import type { WaveXBackend } from '../../src/backend/contract'
import { BackendError } from '../../src/backend/errors'
import {
  BackendProvider,
  useBackend,
  useBackendQuery,
  useInvalidateQueries,
} from '../../src/backend/provider'

/**
 * The read hook is what every screen will sit on once the fixtures are
 * replaced, so the states it can be in matter more than the data it carries.
 *
 * The case worth the most is a read that throws *synchronously*: every
 * unwired method on the live backend does exactly that, and if the hook lets
 * it escape, a screen crashes instead of showing the refusal message.
 */

const mounted: renderer.ReactTestRenderer[] = []

afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount()
  })
})

function backendWith(overrides: Partial<WaveXBackend> = {}): WaveXBackend {
  return overrides as WaveXBackend
}

/** Renders the hook and exposes whatever it reported, as text. */
function renderQuery<T>(
  read: (backend: WaveXBackend) => Promise<T>,
  backend: WaveXBackend,
  queryKey = 'k1',
) {
  function Probe({ queryKey: key }: { queryKey: string }) {
    const state = useBackendQuery(key, read)
    return <Text>{`${state.status}:${state.data ?? state.error ?? ''}`}</Text>
  }

  let tree!: renderer.ReactTestRenderer
  act(() => {
    tree = renderer.create(
      <BackendProvider backend={backend}>
        <Probe queryKey={queryKey} />
      </BackendProvider>,
    )
  })
  mounted.push(tree)

  const read1 = () => tree.root.findByType(Text).props.children as string
  return { tree, readText: read1 }
}

/** Lets the pending promise chain settle. */
const flush = () => act(async () => { await Promise.resolve() })

describe('useBackend', () => {
  it('throws outside a provider rather than returning undefined', () => {
    function Orphan() {
      useBackend()
      return null
    }
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    // React 19 surfaces a render throw when the work flushes, so the render
    // has to happen inside `act` for the assertion to see it.
    expect(() => act(() => void renderer.create(<Orphan />))).toThrow(/inside <BackendProvider>/)
    spy.mockRestore()
  })

  it('hands every consumer the same instance', () => {
    // The duplicate-submission memo lives on the instance, so two backends
    // would mean two memos and a mutation could run twice.
    const backend = backendWith()
    const seen: WaveXBackend[] = []

    function Probe() {
      seen.push(useBackend())
      return null
    }

    act(() => {
      const tree = renderer.create(
        <BackendProvider backend={backend}>
          <Probe />
          <Probe />
        </BackendProvider>,
      )
      mounted.push(tree)
    })

    expect(seen).toHaveLength(2)
    expect(seen[0]).toBe(seen[1])
    expect(seen[0]).toBe(backend)
  })
})

describe('useBackendQuery', () => {
  it('deduplicates one query key across concurrent consumers', async () => {
    const read = jest.fn(async () => 'shared')

    function Probe() {
      const first = useBackendQuery('shared-key', read)
      const second = useBackendQuery('shared-key', read)
      return <Text>{`${first.status}:${second.status}`}</Text>
    }

    let tree!: renderer.ReactTestRenderer
    act(() => {
      tree = renderer.create(
        <BackendProvider backend={backendWith()}>
          <Probe />
        </BackendProvider>,
      )
    })
    mounted.push(tree)
    await flush()

    expect(read).toHaveBeenCalledTimes(1)
    expect(tree.root.findByType(Text).props.children).toBe('ready:ready')
  })

  it('retains a completed query across a short unmount and remount', async () => {
    const backend = backendWith()
    const read = jest.fn(async () => 'account-data')

    function Probe() {
      useBackendQuery('account-data', read)
      return null
    }

    function Host({ visible }: { visible: boolean }) {
      return <BackendProvider backend={backend}>{visible ? <Probe /> : null}</BackendProvider>
    }

    let tree!: renderer.ReactTestRenderer
    act(() => {
      tree = renderer.create(<Host visible />)
    })
    mounted.push(tree)
    await flush()

    act(() => tree.update(<Host visible={false} />))
    act(() => tree.update(<Host visible />))
    await flush()

    expect(read).toHaveBeenCalledTimes(1)
  })

  it('explicit invalidation bypasses retained data', async () => {
    const backend = backendWith()
    const read = jest.fn(async () => 'account-data')
    let invalidate!: (...prefixes: string[]) => void

    function Probe() {
      useBackendQuery('account:one', read)
      return null
    }

    function Host({ visible }: { visible: boolean }) {
      function InvalidateHandle() {
        invalidate = useInvalidateQueries()
        return null
      }
      return <BackendProvider backend={backend}><InvalidateHandle />{visible ? <Probe /> : null}</BackendProvider>
    }

    let tree!: renderer.ReactTestRenderer
    act(() => { tree = renderer.create(<Host visible />) })
    mounted.push(tree)
    await flush()

    act(() => tree.update(<Host visible={false} />))
    act(() => invalidate('account:'))
    act(() => tree.update(<Host visible />))
    await flush()

    expect(read).toHaveBeenCalledTimes(2)
  })

  it('does not share retained data across query keys', async () => {
    const backend = backendWith()
    const read = jest.fn(async () => 'account-data')

    function Probe({ queryKey }: { queryKey: string }) {
      useBackendQuery(queryKey, read)
      return null
    }

    function Host({ queryKey }: { queryKey?: string }) {
      return <BackendProvider backend={backend}>{queryKey ? <Probe queryKey={queryKey} /> : null}</BackendProvider>
    }

    let tree!: renderer.ReactTestRenderer
    act(() => { tree = renderer.create(<Host queryKey="account:one" />) })
    mounted.push(tree)
    await flush()

    act(() => tree.update(<Host />))
    act(() => tree.update(<Host queryKey="account:two" />))
    await flush()

    expect(read).toHaveBeenCalledTimes(2)
  })

  it('does not retain a rejected read as fresh data', async () => {
    const backend = backendWith()
    const read = jest.fn(async () => { throw new Error('unavailable') })

    function Probe() {
      useBackendQuery('account:one', read)
      return null
    }

    function Host({ visible }: { visible: boolean }) {
      return <BackendProvider backend={backend}>{visible ? <Probe /> : null}</BackendProvider>
    }

    let tree!: renderer.ReactTestRenderer
    act(() => { tree = renderer.create(<Host visible />) })
    mounted.push(tree)
    await flush()

    act(() => tree.update(<Host visible={false} />))
    act(() => tree.update(<Host visible />))
    await flush()

    expect(read).toHaveBeenCalledTimes(2)
  })

  it('expires retained data after 30 seconds without consumers', async () => {
    jest.useFakeTimers()
    try {
      const backend = backendWith()
      const read = jest.fn(async () => 'account-data')

      function Probe() {
        useBackendQuery('account:one', read)
        return null
      }

      function Host({ visible }: { visible: boolean }) {
        return <BackendProvider backend={backend}>{visible ? <Probe /> : null}</BackendProvider>
      }

      let tree!: renderer.ReactTestRenderer
      act(() => { tree = renderer.create(<Host visible />) })
      mounted.push(tree)
      await flush()

      act(() => tree.update(<Host visible={false} />))
      act(() => jest.advanceTimersByTime(30_000))
      act(() => tree.update(<Host visible />))
      await flush()

      expect(read).toHaveBeenCalledTimes(2)
    } finally {
      jest.useRealTimers()
    }
  })

  it('starts in the loading state', () => {
    const { readText } = renderQuery(() => new Promise(() => {}), backendWith())
    expect(readText()).toBe('loading:')
  })

  it('reports the data once the read resolves', async () => {
    const { readText } = renderQuery(async () => 'gold', backendWith())
    await flush()
    expect(readText()).toBe('ready:gold')
  })

  it('maps a BackendError to its reviewed user copy, not the server wording', async () => {
    // Guide §5: server text is for diagnostics only.
    const failing = () =>
      Promise.reject(
        new BackendError('server', 'internal', { serverMessage: 'SQLSTATE[42000] at line 12' }),
      )

    const { readText } = renderQuery(failing, backendWith())
    await flush()

    expect(readText()).toBe('error:The service is having trouble. Try again shortly.')
    expect(readText()).not.toContain('SQLSTATE')
  })

  it('surfaces a blocked refusal verbatim, because that copy is ours', async () => {
    const message = 'Not wired yet: market catalogue. Blocked on guide §7 — item 11.'
    const { readText } = renderQuery(() => Promise.reject(new BackendError('blocked', message)), backendWith())
    await flush()
    expect(readText()).toBe(`error:${message}`)
  })

  it('falls back to generic copy for a non-BackendError', async () => {
    const { readText } = renderQuery(() => Promise.reject(new TypeError('undefined is not a fn')), backendWith())
    await flush()
    expect(readText()).toBe('error:Something went wrong. Try again.')
  })

  it('turns a read that throws synchronously into an error state, not a crash', async () => {
    // Every unwired method on the live backend used to throw synchronously,
    // which escaped the rejection handler entirely and took the screen with
    // it. This is the regression guard for that.
    const { readText } = renderQuery(() => {
      throw new BackendError('blocked', 'Not wired yet: account summary.')
    }, backendWith())

    await flush()
    expect(readText()).toBe('error:Not wired yet: account summary.')
  })

  it('re-runs when the key changes and does not show the previous result under it', async () => {
    // A stale result is another instrument's numbers under a new heading.
    const read = jest.fn(async (_backend: WaveXBackend) => 'first')

    function Probe({ queryKey }: { queryKey: string }) {
      const state = useBackendQuery(queryKey, read)
      return <Text>{`${state.status}:${state.data ?? ''}`}</Text>
    }

    let tree!: renderer.ReactTestRenderer
    act(() => {
      tree = renderer.create(
        <BackendProvider backend={backendWith()}>
          <Probe queryKey="a" />
        </BackendProvider>,
      )
    })
    mounted.push(tree)
    await flush()
    expect(tree.root.findByType(Text).props.children).toBe('ready:first')

    read.mockResolvedValue('second')
    act(() => {
      tree.update(
        <BackendProvider backend={backendWith()}>
          <Probe queryKey="b" />
        </BackendProvider>,
      )
    })
    // Immediately after the key changes the old value must not be shown.
    expect(tree.root.findByType(Text).props.children).toBe('loading:')

    await flush()
    expect(tree.root.findByType(Text).props.children).toBe('ready:second')
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('does not set state after unmount', async () => {
    // A late resolve on an unmounted screen is a warning at best and a leak
    // at worst.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    let resolve!: (value: string) => void
    const read = () => new Promise<string>((r) => { resolve = r })

    const { tree } = renderQuery(read, backendWith())
    // The hook defers the read onto a microtask, so let it start before
    // unmounting — otherwise `resolve` is never captured.
    await flush()

    act(() => tree.unmount())
    mounted.length = 0

    await act(async () => {
      resolve('late')
      await Promise.resolve()
    })

    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('useInvalidateQueries', () => {
  /** Two reads under different keys, plus a handle on the invalidator. */
  function renderPair(readPositions: () => Promise<string>, readMarkets: () => Promise<string>) {
    let invalidate!: (...prefixes: string[]) => void

    function Probe() {
      invalidate = useInvalidateQueries()
      const positions = useBackendQuery('positions:acct-1', readPositions)
      const twin = useBackendQuery('positions:acct-1', readPositions)
      const markets = useBackendQuery('markets:acct-1', readMarkets)
      return <Text>{`${positions.status}:${positions.data ?? ''}|${twin.data ?? ''}|${markets.data ?? ''}`}</Text>
    }

    let tree!: renderer.ReactTestRenderer
    act(() => {
      tree = renderer.create(
        <BackendProvider backend={backendWith()}>
          <Probe />
        </BackendProvider>,
      )
    })
    mounted.push(tree)
    return {
      invalidate: (...prefixes: string[]) => invalidate(...prefixes),
      readText: () => tree.root.findByType(Text).props.children as string,
    }
  }

  it('re-reads matching keys once, shared by every consumer, and leaves the rest', async () => {
    let version = 0
    const readPositions = jest.fn(async () => `v${++version}`)
    const readMarkets = jest.fn(async () => 'm')
    const { invalidate, readText } = renderPair(readPositions, readMarkets)
    await flush()
    expect(readText()).toBe('ready:v1|v1|m')

    act(() => invalidate('positions:'))
    await flush()

    expect(readText()).toBe('ready:v2|v2|m')
    expect(readPositions).toHaveBeenCalledTimes(2)
    expect(readMarkets).toHaveBeenCalledTimes(1)
  })

  it('keeps the previous data on screen while the re-read is in flight', async () => {
    let resolveSecond!: (value: string) => void
    const readPositions = jest
      .fn<Promise<string>, []>()
      .mockResolvedValueOnce('before')
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve }))
    const { invalidate, readText } = renderPair(readPositions, async () => 'm')
    await flush()

    act(() => invalidate('positions:'))
    await flush()
    expect(readText()).toBe('ready:before|before|m')

    await act(async () => resolveSecond('after'))
    expect(readText()).toBe('ready:after|after|m')
  })
})
