import { useColors, useThemeStyles } from '../../design-system/theme'
import type { Palette } from '../../design-system/colors'
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { radius } from '../../design-system'
import type { TradingViewChartProps } from './tradingview-chart'
import { tradingViewPayload } from './tradingview-data'
import { createTradingViewHtml } from './tradingview-html'

export function TradingViewChart({ symbol, timeframe, interval, precision, series, fallback }: TradingViewChartProps) {
  const colors = useColors()
  const [document] = useState(() => createTradingViewHtml(colors))
  const styles = useThemeStyles(themeStyles)
  const iframeStyle = useThemeStyles(themeIframeStyle)

  const frame = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const payload = useMemo(() => ({ ...tradingViewPayload(symbol, timeframe, precision, series, interval), theme: colors }), [symbol, timeframe, precision, series, interval, colors])
  const sync = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ source: 'wavex-app', payload }, '*')
  }, [payload])

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.data?.source !== 'wavex-tradingview') return
      if (event.data.type === 'ready') { setReady(true); sync() }
      if (event.data.type === 'error') setFailed(true)
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [sync])
  useEffect(() => { if (ready) sync() }, [ready, sync])
  useEffect(() => {
    if (ready) return
    const timer = setTimeout(() => setFailed(true), 10_000)
    return () => clearTimeout(timer)
  }, [ready])

  if (failed || payload.line.length === 0) return fallback

  return (
    <View testID="tradingview-chart" style={styles.frame}>
      {createElement('iframe', {
        ref: frame,
        srcDoc: document,
        title: `${symbol} TradingView chart`,
        sandbox: 'allow-scripts allow-popups allow-popups-to-escape-sandbox',
        onLoad: sync,
        onError: () => setFailed(true),
        style: iframeStyle,
      })}
    </View>
  )
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  frame: { flex: 1, overflow: 'hidden', borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.surface },
}))
const themeIframeStyle = (colors: Palette): React.CSSProperties => ({ width: '100%', height: '100%', border: 0, display: 'block', backgroundColor: colors.surface })
