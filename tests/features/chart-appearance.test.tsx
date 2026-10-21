import renderer, { act } from 'react-test-renderer'
import { TradingViewChart } from '../../src/features/chart/tradingview-chart'
import { ThemeProvider, useTheme } from '../../src/design-system/theme'
import { buildChartSeries } from '../../src/data/chart-series'

it('starts the embedded chart in the restored theme and keeps its document mounted when appearance changes', async () => {
  const series = buildChartSeries([
    { time: 1790812800000, open: 100, high: 110, low: 90, close: 105 },
    { time: 1790816400000, open: 105, high: 112, low: 98, close: 102 },
  ], '1D')!
  let theme!: ReturnType<typeof useTheme>
  function Chart() {
    theme = useTheme()
    return <TradingViewChart symbol="gold" timeframe="1D" precision={2} series={series} fallback={null} />
  }
  let tree!: renderer.ReactTestRenderer
  await act(async () => { tree = renderer.create(<ThemeProvider storage={{ read: async () => 'dark', write: async () => {} }}><Chart /></ThemeProvider>) })
  const webview = tree.root.findAll((node) => Boolean(node.props.source?.html))[0]
  const document = webview.props.source
  expect(document.html).toContain('background:#141D30')
  await act(async () => { await theme.setPreference('light') })
  expect(tree.root.findAll((node) => Boolean(node.props.source?.html))[0].props.source).toBe(document)
  act(() => tree.unmount())
})
