import { BlurView } from 'expo-blur'
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { radius } from './tokens'

/**
 * The account as a card in Apple Wallet, finished like a pane of macOS
 * glass: frosted white with a hairline edge, a bright line along the top and
 * a soft diagonal sheen. Card-proportioned so it reads as an object rather
 * than another panel. Text on it is dark.
 */
export function WalletCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const blur = Platform.OS !== 'android'
  return (
    <View style={[styles.card, blur ? styles.overBlur : styles.solid, style]}>
      {blur ? <BlurView intensity={50} tint="light" style={styles.fill} /> : null}
      <View pointerEvents="none" style={styles.fill}>
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="wallet-sheen" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
              <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0.25} />
              <Stop offset="0.46" stopColor="#FFFFFF" stopOpacity={0.05} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.35} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#wallet-sheen)" />
        </Svg>
      </View>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 1.586,
    width: '100%',
    padding: 20,
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    boxShadow:
      'inset 0px 1px 0px rgba(255, 255, 255, 1), 0px 0px 0px 0.5px rgba(0, 0, 0, 0.10), 0px 2px 6px rgba(0, 0, 0, 0.04), 0px 18px 40px rgba(0, 0, 0, 0.10)',
  },
  overBlur: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  solid: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  fill: {
    ...StyleSheet.absoluteFill,
    zIndex: -1,
  },
})
