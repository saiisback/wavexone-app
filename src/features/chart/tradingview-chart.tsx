import { useColors, useThemeStyles } from '../../design-system/theme'
import type { Palette } from '../../design-system/colors'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Linking, StyleSheet, View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'

import type { CandleInterval, ChartSeries, Timeframe } from '../../data/types'
import { radius } from '../../design-system'
import { tradingViewPayload } from './tradingview-data'
import { createTradingViewHtml } from './tradingview-html'

export type TradingViewChartProps = {
  symbol: string
  timeframe: Timeframe
  interval?: CandleInterval
  expanded?: boolean
  precision: number
  series: ChartSeries
  fallback: React.ReactNode
}

const ATTRIBUTION_URL = 'https://www.tradingview.com/'

export function TradingViewChart({ symbol, timeframe, interval, precision, series, fallback }: TradingViewChartProps) {
  const colors = useColors()
  const [source] = useState(() => ({ html: createTradingViewHtml(colors) }))
  const styles = useThemeStyles(themeStyles)

  const chart = useRef<WebView>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const payload = useMemo(() => ({ ...tradingViewPayload(symbol, timeframe, precision, series, interval), theme: colors }), [symbol, timeframe, precision, series, interval, colors])
  const sync = useCallback(() => {
    const json = JSON.stringify(payload).replace(/</g, '\\u003c')
    chart.current?.injectJavaScript(`window.wavexChart && window.wavexChart.setData(${json}); true;`)
  }, [payload])

  useEffect(() => { if (ready) sync() }, [ready, sync])
  useEffect(() => {
    if (ready) return
    const timer = setTimeout(() => setFailed(true), 10_000)
    return () => clearTimeout(timer)
  }, [ready])

  const receive = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type?: string }
      if (message.type === 'ready') { setReady(true); sync() }
      if (message.type === 'error') setFailed(true)
      if (message.type === 'link') void Linking.openURL(ATTRIBUTION_URL)
    } catch { /* Ignore messages outside our bridge. */ }
  }

  if (failed || payload.line.length === 0) return fallback

  return (
    <View testID="tradingview-chart" style={styles.frame}>
      <WebView
        ref={chart}
        source={source}
        originWhitelist={['*']}
        onMessage={receive}
        onError={() => setFailed(true)}
        onContentProcessDidTerminate={() => setFailed(true)}
        onShouldStartLoadWithRequest={(request) => {
          if (request.url === 'about:blank' || request.url.startsWith('data:text/html')) return true
          if (request.url.startsWith('https://www.tradingview.com/')) void Linking.openURL(ATTRIBUTION_URL)
          return false
        }}
        javaScriptEnabled
        domStorageEnabled={false}
        sharedCookiesEnabled={false}
        thirdPartyCookiesEnabled={false}
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        style={styles.frame}
      />
    </View>
  )
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  frame: { flex: 1, overflow: 'hidden', borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.surface },
}))
