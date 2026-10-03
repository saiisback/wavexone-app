import { StyleSheet, View } from 'react-native'

import { colors } from './colors'

/**
 * The feature-card surface. In the Wallet/Stocks scheme feature cards are
 * plain white like every other card, so this is a white layer kept for the
 * call sites that place it; `watermark` is accepted and ignored.
 */
export function InkBackdrop(_props: { watermark?: boolean }) {
  return <View pointerEvents="none" style={styles.layer} />
}

const styles = StyleSheet.create({
  // Below the content: web paints an absolutely placed layer above in-flow
  // siblings unless it is pushed back explicitly.
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: -1,
    backgroundColor: colors.surface,
  },
})
