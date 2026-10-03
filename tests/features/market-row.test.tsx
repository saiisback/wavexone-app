import { Text as RNText } from 'react-native'
import { StyleSheet } from 'react-native'
import renderer, { act, type ReactTestInstance } from 'react-test-renderer'
import Svg, { Path } from 'react-native-svg'

import { createMockBackend } from '../../src/backend/mock-backend'
import { BackendProvider } from '../../src/backend/provider'
import { MarketRow } from '../../src/features/markets/market-row'
import { instruments } from '../../src/data/mock'
import { useSession } from '../../src/data/store'
import { colors } from '../../src/design-system/colors'
import { AssetIcon, type AssetIconKind } from '../../src/design-system/asset-icon'

/**
 * The Market Watch row is the most repeated component in the app and the one
 * that turns raw numbers into the red/green language the whole design relies
 * on. What is worth asserting is the mapping — value to colour, value to
 * string, tap to callback — rather than the layout, which the mockups own.
 */

const GOLD = instruments.find((item) => item.symbol === 'XAU/USD')!
const BACKEND = createMockBackend()

function renderRow(overrides: Partial<React.ComponentProps<typeof MarketRow>> = {}) {
  const onPress = jest.fn()
  const onLongPress = jest.fn()

  let tree!: renderer.ReactTestRenderer
  act(() => {
    tree = renderer.create(
      // Rows stream their own price; the fixture backend never ticks.
      <BackendProvider backend={BACKEND}>
        <MarketRow
          id={GOLD.id}
          symbol={GOLD.symbol}
          name={GOLD.name}
          price={GOLD.price}
          precision={GOLD.precision}
          changePercent={GOLD.changePercent}
          iconKind={GOLD.icon}
          spark={GOLD.spark}
          onPress={onPress}
          onLongPress={onLongPress}
          {...overrides}
        />
      </BackendProvider>,
    )
  })

  mounted.push(tree)
  const texts = tree.root.findAllByType(RNText).map((node) => flatten(node))
  return { tree, onPress, onLongPress, texts }
}

/** Text children arrive as nested arrays; join them into one string. */
function flatten(node: ReactTestInstance): string {
  const walk = (children: unknown): string =>
    Array.isArray(children) ? children.map(walk).join('') : String(children ?? '')
  return walk(node.props.children)
}

const INITIAL = useSession.getState()

/**
 * Trees are torn down between tests. A tree left mounted would still be
 * subscribed to the store, so the reset below would re-render it outside
 * `act` and bury the real assertions in warnings.
 */
const mounted: renderer.ReactTestRenderer[] = []

afterEach(() => {
  act(() => {
    while (mounted.length) mounted.pop()!.unmount()
  })
})

beforeEach(() => {
  act(() => {
    useSession.setState(INITIAL, true)
  })
})

describe('rendering', () => {
  it.each(['apple', 'tesla', 'nvidia', 'microsoft', 'amazon', 'meta', 'google', 'netflix', 'bitcoin', 'ethereum', 'litecoin', 'cardano', 'polkadot', 'coinbase', 'oil'])(
    'renders the bundled %s mark as local vector artwork', (kind) => {
      const { tree } = renderRow({ iconKind: kind as AssetIconKind })
      const mark = tree.root.findByType(AssetIcon)
      expect(mark.findAllByType(Svg)).toHaveLength(1)
      expect(mark.findAllByType(Path).length).toBeGreaterThan(0)
    },
  )

  it.each([
    ['forex', 'AUDCAD'],
    ['index', 'US100'],
    ['stock', '0001'],
  ])('renders a legible %s badge for %s', (kind, label) => {
    const { tree } = renderRow({ iconKind: kind as AssetIconKind, iconLabel: label })
    const mark = tree.root.findByType(AssetIcon)
    expect(mark.findAllByType(RNText).length).toBeGreaterThan(0)
  })

  it.each([
    ['NASDAQ:ZETA.OQ', 'ZE'], [' xy/usd ', 'XY'], ['', '?'],
  ])('derives a non-empty fallback for %s when icon metadata is missing', (symbol, monogram) => {
    const { tree } = renderRow({ symbol, iconKind: 'generic', iconLabel: undefined })
    const mark = tree.root.findByType(AssetIcon)
    expect(mark.findAllByType(RNText).map(flatten)).toContain(monogram)
  })

  it('shows the symbol and the long name', () => {
    const { texts } = renderRow()
    expect(texts).toContain(GOLD.symbol)
    expect(texts).toContain(GOLD.name)
  })

  it('prints the price at the instrument precision, not the raw number', () => {
    const { texts } = renderRow({ price: 2043.5, precision: 2 })
    expect(texts).toContain('2,043.50')
    expect(texts).not.toContain('2043.5')
  })

  it('prints an FX price to four places', () => {
    const { texts } = renderRow({ price: 1.08, precision: 4 })
    expect(texts).toContain('1.0800')
  })

  it('signs the percentage change', () => {
    expect(renderRow({ changePercent: 0.34 }).texts).toContain('+0.34%')
    expect(renderRow({ changePercent: -1.2 }).texts).toContain('-1.20%')
  })
})

describe('direction colouring', () => {
  const sparkColors = (tree: renderer.ReactTestRenderer) =>
    tree.root.findAll((node) => typeof node.props.color === 'string').map((node) => node.props.color)

  it('draws a gain in green', () => {
    const { tree } = renderRow({ changePercent: 1.5 })
    expect(sparkColors(tree)).toContain(colors.green)
    expect(sparkColors(tree)).not.toContain(colors.red)
  })

  it('draws a loss in red', () => {
    const { tree } = renderRow({ changePercent: -1.5 })
    expect(sparkColors(tree)).toContain(colors.red)
    expect(sparkColors(tree)).not.toContain(colors.green)
  })

  it('honours an explicit spark tone that disagrees with the change', () => {
    // The mockups draw EUR/USD up on the day with a red sparkline; the row has
    // to be able to say so rather than deriving colour from the number alone.
    const { tree } = renderRow({ changePercent: 1.5, sparkTone: 'negative' })
    const found = sparkColors(tree)
    // The change label stays green while the sparkline goes red. The label
    // is a solid Stocks-style pill, so its green is the pill's fill.
    const fills = tree.root
      .findAll((node) => typeof node.type === 'string' && node.props.style != null)
      .map((node) => StyleSheet.flatten(node.props.style)?.backgroundColor)
    expect(found).toContain(colors.red)
    expect(fills).toContain(colors.greenFill)
  })
})

describe('favourite marker', () => {
  it('is hidden unless the row asks for it', () => {
    // Market Watch does not show stars; the catalogue does.
    const { tree } = renderRow({ showFavorite: false })
    expect(tree.root.findAll((node) => node.props.color === colors.gold)).toHaveLength(0)
  })

  it('shows for an instrument that is a favourite', () => {
    useSession.setState({ favorites: new Set([GOLD.id]) })
    const { tree } = renderRow({ showFavorite: true })
    expect(tree.root.findAll((node) => node.props.color === colors.gold).length).toBeGreaterThan(0)
  })

  it('stays hidden for an instrument that is not', () => {
    useSession.setState({ favorites: new Set<string>() })
    const { tree } = renderRow({ showFavorite: true })
    expect(tree.root.findAll((node) => node.props.color === colors.gold)).toHaveLength(0)
  })

  it('appears when the row is favourited while mounted', () => {
    // The row subscribes with its own selector, so it must react without the
    // list re-rendering it.
    useSession.setState({ favorites: new Set<string>() })
    const { tree } = renderRow({ showFavorite: true })

    act(() => {
      useSession.getState().toggleFavorite(GOLD.id)
    })

    expect(tree.root.findAll((node) => node.props.color === colors.gold).length).toBeGreaterThan(0)
  })

  it('ignores a different instrument being favourited', () => {
    useSession.setState({ favorites: new Set<string>() })
    const { tree } = renderRow({ showFavorite: true })

    act(() => {
      useSession.getState().toggleFavorite(instruments[1].id)
    })

    expect(tree.root.findAll((node) => node.props.color === colors.gold)).toHaveLength(0)
  })
})

describe('interaction', () => {
  /**
   * `delayLongPress` identifies the real `Pressable` inside `PressableScale`.
   * Matching on `onPress` alone would find the `MarketRow` element itself and
   * invoke the test's own mock, which proves nothing.
   */
  const pressable = (tree: renderer.ReactTestRenderer) =>
    tree.root.find((node) => node.props.delayLongPress !== undefined)

  const press = (tree: renderer.ReactTestRenderer, prop: 'onPress' | 'onLongPress') => {
    act(() => pressable(tree).props[prop]())
  }

  it('reports its own id on press, so the list needs no per-row closure', () => {
    const { tree, onPress } = renderRow()
    press(tree, 'onPress')
    expect(onPress).toHaveBeenCalledWith(GOLD.id)
  })

  it('reports its own id on long press', () => {
    const { tree, onLongPress } = renderRow()
    press(tree, 'onLongPress')
    expect(onLongPress).toHaveBeenCalledWith(GOLD.id)
  })

  it('passes no long-press handler through when none was given', () => {
    // A no-op handler would still swallow the gesture and suppress the menu.
    const { tree } = renderRow({ onLongPress: undefined })
    expect(pressable(tree).props.onLongPress).toBeUndefined()
  })
})
