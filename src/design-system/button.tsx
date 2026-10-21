import { useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import type { Palette } from './colors'
import { useColors, useThemeStyles } from './theme'
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
  onPress?: () => void | Promise<void>
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  disabled?: boolean
  loading?: boolean
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
  loading = false,
  accessibilityLabel,
}: ButtonProps) {
  const colors = useColors()
  const tones = useThemeStyles(createTones)
  const labelColor = buttonLabelColors(colors)
  const locked = useRef(false)
  const [pending, setPending] = useState(false)
  const busy = loading || pending
  const unavailable = disabled || busy
  const press = () => {
    if (unavailable || locked.current) return
    locked.current = true
    try {
      const result = onPress?.()
      if (result && typeof result.then === 'function') {
        setPending(true)
        const release = () => { locked.current = false; setPending(false) }
        result.then(release, release)
      } else {
        locked.current = false
      }
    } catch (error) {
      locked.current = false
      throw error
    }
  }
  return (
    <PressableScale
      onPress={press}
      disabled={unavailable}
      accessibilityState={{ busy, disabled: unavailable }}
      style={style}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.base, tones[tone], disabled ? styles.disabled : null]}>
        {busy ? <ActivityIndicator style={styles.spinner} color={labelColor[tone]} size="small" /> : null}
        {children}
      </View>
    </PressableScale>
  )
}

export function ButtonText({ tone = 'ink', children }: { tone?: Tone; children: React.ReactNode }) {
  const labelColor = buttonLabelColors(useColors())
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
  const labelColor = buttonLabelColors(useColors())
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

const buttonLabelColors = (colors: Palette): Record<Tone, string> => ({
  ink: colors.white,
  brand: colors.white,
  night: colors.text,
  gold: colors.royal,
  track: colors.text,
  surface: colors.text,
})

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: radius.md,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
    gap: 1,
  },
  disabled: {
    opacity: 0.45,
  },
  spinner: { position: 'absolute', left: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
})

const createTones = (colors: Palette) => StyleSheet.create({
  ink: {
    backgroundColor: colors.royal,
  },
  brand: {
    backgroundColor: colors.royal,
  },
  // Apple secondary: a grey fill with dark text.
  night: {
    backgroundColor: colors.accent,
  },
  gold: {
    backgroundColor: colors.gold,
  },
  track: {
    backgroundColor: colors.well,
  },
  surface: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
})
