import renderer, { act } from 'react-test-renderer'
import { View } from 'react-native'

import { PriceChart, PriceChartProvider, TradingViewAttribution } from '../../src/features/chart/price-chart'
import type { ChartSeries } from '../../src/data/types'

const series: ChartSeries = {
  points: [100, 104, 102, 108],
  opens: [99, 100, 104, 102],
  times: [1, 2, 3, 4],
  labels: ['1', '2', '3', '4'],
  cursorIndex: 3,
  cursorOpen: 102,
  cursorClose: 108,
  min: 100,
  max: 108,
  step: 2,
  axisDecimals: 0,
}

it('draws a non-empty price path after the chart receives its layout', () => {
  let tree!: renderer.ReactTestRenderer
  act(() => {
    tree = renderer.create(
      <PriceChartProvider series={series}>
        <View style={{ width: 320, height: 240 }}>
          <PriceChart series={series} precision={2} />
        </View>
      </PriceChartProvider>,
    )
  })

  const plot = tree.root.findByProps({ nativeID: 'wavex-price-chart' })
  act(() => plot.props.onLayout({ nativeEvent: { layout: { width: 280, height: 220 } } }))

  const paths = tree.root.findAll((node) => (node.type as unknown) === 'RNSVGPath')
  expect(paths.some((path) => typeof path.props.d === 'string' && path.props.d.length > 0)).toBe(true)
  act(() => tree.unmount())
})

it('renders a TradingView attribution control under the chart', () => {
  let tree!: renderer.ReactTestRenderer
  act(() => {
    tree = renderer.create(<TradingViewAttribution />)
  })
  expect(tree.root.findByProps({ accessibilityLabel: 'Charting by TradingView' })).toBeTruthy()
  act(() => tree.unmount())
})
