import { darkColors } from '../../src/design-system/colors'
import { createTradingViewHtml } from '../../src/features/chart/tradingview-html'

// Keep Node-only test execution out of the app's React Native type environment.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runInNewContext } = require('vm') as { runInNewContext(source: string, context: Record<string, unknown>): unknown }

it('moves the gold highlight immediately when chart mode changes after a theme update', () => {
  function element(active = false) {
    const classes = new Set(active ? ['active'] : [])
    const attributes: Record<string, string> = {}
    return {
      style: {} as Record<string, string>, attributes,
      textContent: '', disabled: false, onclick: () => {},
      classList: {
        contains: (value: string) => classes.has(value),
        toggle: (value: string, enabled: boolean) => enabled ? classes.add(value) : classes.delete(value),
      },
      setAttribute: (key: string, value: string) => { attributes[key] = value },
    }
  }
  const elements = {
    plot: element(), readout: element(), symbol: element(),
    candles: element(true), line: element(), reset: element(),
    toolbar: element(), footer: element(), link: element(),
  }
  const series = () => ({ applyOptions() {}, setData() {}, update() {} })
  const chart = {
    addSeries: series, applyOptions() {}, subscribeCrosshairMove() {},
    timeScale: () => ({ fitContent() {} }), resize() {}, remove() {},
  }
  const window = {
    parent: { postMessage() {} }, addEventListener() {},
    LightweightCharts: { createChart: () => chart, CrosshairMode: { Normal: 0 }, CandlestickSeries: {}, LineSeries: {} },
    wavexChart: undefined as unknown as { setData(data: unknown): void },
  }
  const html = createTradingViewHtml(darkColors)
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  runInNewContext(scripts.at(-1)![1], {
    window,
    document: {
      documentElement: element(), body: element(),
      getElementById: (id: keyof typeof elements) => elements[id],
      querySelector: (selector: string) => ({ '.toolbar': elements.toolbar, footer: elements.footer, 'footer a': elements.link })[selector],
      querySelectorAll: () => [elements.candles, elements.line, elements.reset],
    },
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame() {},
  })
  window.wavexChart.setData({
    key: 'gold:1D', symbol: 'Gold', precision: 2, intraday: true, theme: darkColors,
    candles: [{ time: 1, open: 100, high: 102, low: 99, close: 101 }],
    line: [{ time: 1, value: 101 }],
  })
  expect(elements.candles.style.background).toBe('#E6BE3F')
  elements.line.onclick()
  expect(elements.line.attributes['aria-pressed']).toBe('true')
  expect(elements.line.style.background).toBe('#E6BE3F')
  expect(elements.line.style.color).toBe('#111936')
  expect(elements.candles.style.background).toBe('#1C2840')
  expect(elements.candles.style.color).toBe('#F2F4FA')
})
