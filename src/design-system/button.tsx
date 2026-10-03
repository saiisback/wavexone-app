import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { colors } from './colors'
import { PressableScale } from './pressable'
import { Text } from './text'
import { radius, shadow, spacing } from './tokens'

type Tone = 'ink' | 'gold' | 'track' | 'surface'

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
      <View style={[styles.base, tones[tone], disabled ? styles.disabled : null]}>{children}</View>
    </PressableScale>
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

const labelColor: Record<Tone, string> = {
  ink: colors.onInk,
  gold: colors.ink,
  track: colors.text,
  surface: colors.text,
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
    gap: 2,
  },
  disabled: {
    opacity: 0.45,
  },
})

const tones = StyleSheet.create({
  ink: { backgroundColor: colors.ink },
  gold: { backgroundColor: colors.gold },
  track: { backgroundColor: colors.track },
  surface: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    boxShadow: shadow.card,
  },
})
