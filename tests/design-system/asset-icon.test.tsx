import { Image } from 'expo-image'
import { Image as RNImage, Text as RNText } from 'react-native'
import renderer, { act } from 'react-test-renderer'
import { Path, SvgXml } from 'react-native-svg'

import { AssetIcon, type AssetIconProps } from '../../src/design-system/asset-icon'
import { BRAND_MARKS, COIN_MARKS, FLAG_SVGS } from '../../src/design-system/artwork.generated'

/**
 * Instrument badges must come only from artwork bundled with the app: no
 * per-row network request, no layout shift while a logo loads, no tracking.
 */

function render(props: AssetIconProps) {
  let tree!: renderer.ReactTestRenderer
  act(() => {
    tree = renderer.create(<AssetIcon {...props} />)
  })
  return tree
}

function flatten(node: renderer.ReactTestInstance): string {
  return node.children.map((child) => (typeof child === 'string' ? child : flatten(child))).join('')
}

describe('bundled artwork only', () => {
  const kinds = [
    ...Object.keys(BRAND_MARKS),
    ...Object.keys(COIN_MARKS),
    'apple', 'bitcoin', 'ethereum', 'eos', 'gold', 'silver', 'copper', 'platinum', 'palladium',
    'oil', 'gas', 'forex', 'index', 'stock', 'generic',
  ] as AssetIconProps['kind'][]

  it.each(kinds)('draws %s without loading an image', (kind) => {
    const tree = render({ kind, symbol: 'EUR/USD', label: 'EURUSD' })
    expect(tree.root.findAllByType(Image)).toHaveLength(0)
    expect(tree.root.findAllByType(RNImage)).toHaveLength(0)
  })

  it('ships no remote URLs in the artwork module', () => {
    const source = JSON.stringify({ BRAND_MARKS, COIN_MARKS, FLAG_SVGS })
    // XML namespace identifiers are names, not addresses anything fetches.
    expect(source.replace(/http:\/\/www\.w3\.org\/(2000\/svg|1999\/xlink)/g, '')).not.toMatch(/https?:\/\//)
  })

  it('keeps every flag drawable by react-native-svg', () => {
    for (const svg of Object.values(FLAG_SVGS)) {
      expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 512 512"/)
      expect(svg).not.toMatch(/<(marker|mask|pattern|filter|image|text)\b/)
    }
  })
})

describe('marks', () => {
  it('shows both flags for a currency pair', () => {
    const tree = render({ kind: 'forex', symbol: 'EUR/USD' })
    const flags = tree.root.findAllByType(SvgXml).map((node) => node.props.xml)
    expect(flags).toEqual([FLAG_SVGS.us, FLAG_SVGS.eu])
  })

  it('falls back to currency codes when a leg has no flag', () => {
    const tree = render({ kind: 'forex', symbol: 'XAU/USD' })
    expect(tree.root.findAllByType(SvgXml)).toHaveLength(0)
    expect(tree.root.findAllByType(RNText).map(flatten)).toEqual(['XAU', 'USD'])
  })

  it('shows the home-market flag for an index', () => {
    const tree = render({ kind: 'index', symbol: 'GER40', label: 'D' })
    expect(tree.root.findByType(SvgXml).props.xml).toBe(FLAG_SVGS.de)
  })

  it('keeps the text badge for an index with no known market', () => {
    const tree = render({ kind: 'index', symbol: 'ZZ10' })
    expect(tree.root.findAllByType(RNText).map(flatten)).toEqual(['ZZ10'])
  })

  it('resolves a generic fixture row from its ticker', () => {
    const tree = render({ kind: 'generic', symbol: 'SOL/USD', category: 'Crypto', label: 'S' })
    expect(tree.root.findByType(Path).props.d).toBe(COIN_MARKS.solana.path)
  })

  it('draws pale brands dark so they stay visible on white', () => {
    const tree = render({ kind: 'sony' })
    expect(tree.root.findByType(Path).props.fill).not.toBe('#FFFFFF')
  })

  it('falls back to a monogram for an unknown ticker', () => {
    const tree = render({ kind: 'generic', symbol: 'NASDAQ:ZETA.OQ' })
    expect(tree.root.findAllByType(RNText).map(flatten)).toContain('ZE')
  })
})
