import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { colors } from './colors'
import { PressableScale } from './pressable'
import { Text } from './text'
import { radius, spacing } from './tokens'

/**
 * `ink` and `brand` solid navy (primary: Buy, Sign in, Save), `night`
 * Apple's grey secondary (Sell), `track` a quiet fill, `surface`
 * white with a hairline.
 */
type Tone = 'ink' | 'brand' | 'night' | 'gold' | 'track' | 'surface'

export type ButtonProps = {
  tone?: Tone
  onPress?: () => void
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  disabled?: boolean
  accessibilityLabel?: string
}

/**
 * Compound button: `Button` owns the press target and the surface, while
 * `ButtonText` / `ButtonSubText` / `ButtonIcon` own their own rendering.
 * Nothing here accepts a bare string, so text always lands inside `<Text>`.
 */
export function Button({
  tone = 'ink',
  onPress,
  children,
  style,
  disabled,
  accessibilityLabel,
}: ButtonProps) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={style}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.base, tones[tone], disabled ? styles.disabled : null]}>
        {tone === 'ink' || tone === 'gold' || tone === 'brand' ? <ButtonFill tone={tone} /> : null}
        {children}
      </View>
    </PressableScale>
  )
}

/** Navy and gold buttons are lit from above: lighter at the top edge. */
const FILLS = {
  ink: ['#26346F', colors.ink, colors.ink],
  brand: ['#26346F', colors.ink, colors.ink],
  gold: ['#F1D16A', colors.gold, '#D6A92A'],
} as const

function ButtonFill({ tone }: { tone: 'ink' | 'gold' | 'brand' }) {
  const [top, middle, bottom] = FILLS[tone]
  return (
    <View pointerEvents="none" style={styles.fill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`button-${tone}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={top} />
            <Stop offset="0.55" stopColor={middle} />
            <Stop offset="1" stopColor={bottom} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#button-${tone})`} />
      </Svg>
    </View>
  )
}

export function ButtonText({ tone = 'ink', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <Text variant="strong" color={labelColor[tone]}>
      {children}
    </Text>
  )
}

/** Second line inside a button — the live price on Buy / Sell. */
export function ButtonSubText({
  tone = 'ink',
  children,
}: {
  tone?: Tone
  children: React.ReactNode
}) {
  return (
    <Text variant="strong" color={labelColor[tone]}>
      {children}
    </Text>
  )
}

export function ButtonIcon({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

/** A label with a trailing icon on one line: "Continue →". */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>
}

const labelColor: Record<Tone, string> = {
  ink: colors.white,
  brand: colors.white,
  night: colors.text,
  gold: colors.ink,
  track: colors.text,
  surface: colors.text,
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
    gap: 1,
  },
  disabled: {
    opacity: 0.45,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Behind the label on web too, where absolute layers otherwise paint on top.
  fill: {
    ...StyleSheet.absoluteFill,
    zIndex: -1,
  },
})

const tones = StyleSheet.create({
  ink: {
    backgroundColor: colors.ink,
  },
  brand: {
    backgroundColor: colors.ink,
  },
  // Apple secondary: a grey fill with dark text.
  night: {
    backgroundColor: colors.accent,
  },
  gold: {
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    boxShadow: '0px 8px 18px rgba(214, 169, 42, 0.30)',
  },
  track: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    boxShadow: '0px 0px 0px 1px rgba(20, 24, 43, 0.05)',
  },
  surface: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
})
