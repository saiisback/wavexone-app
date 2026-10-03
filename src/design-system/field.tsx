import { useEffect, useState } from 'react'
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { colors } from './colors'
import { Pressable } from './pressable'
import { Text } from './text'
import { fonts, motion, radius, spacing } from './tokens'

export type FieldProps = TextInputProps & {
  label: string
  /** Leading adornment, e.g. a currency symbol. */
  prefix?: string
  /** Helper or validation copy under the field. */
  hint?: string
  invalid?: boolean
}

/** How far the focus halo spreads beyond the field's edge. */
const HALO = 4

/**
 * Labelled text input used by the funding and order sheets: a white rounded
 * field with a hairline, a caption label above it and a soft brand halo that
 * fades in around it on focus (red while the value is invalid).
 */
export function Field({ label, prefix, hint, invalid = false, style, onFocus, onBlur, ...rest }: FieldProps) {
  const [focused, setFocused] = useState(false)
  const lit = focused || invalid

  // Only the halo animates; the border colour is plain style so it is exact.
  const glow = useSharedValue(0)
  useEffect(() => {
    glow.set(withTiming(lit ? 1 : 0, { duration: motion.base }))
  }, [lit, glow])
  const halo = useAnimatedStyle(() => ({
    opacity: glow.get(),
    transform: [{ scale: 0.985 + glow.get() * 0.015 }],
  }))

  return (
    <View style={styles.wrap}>
      <Text variant="caption" weight="medium" color={colors.textMuted} style={styles.label}>
        {label}
      </Text>

      <View>
        <Animated.View
          pointerEvents="none"
          style={[styles.halo, invalid ? styles.haloInvalid : null, halo]}
        />
        <View style={[styles.box, focused ? styles.boxFocused : null, invalid ? styles.boxInvalid : null]}>
          {prefix ? (
            <Text variant="strong" color={colors.textMuted}>
              {prefix}
            </Text>
          ) : null}
          <TextInput
            {...rest}
            accessibilityLabel={rest.accessibilityLabel ?? label}
            selectionColor={colors.brandBright}
            cursorColor={colors.brandBright}
            onFocus={(event) => { setFocused(true); onFocus?.(event) }}
            onBlur={(event) => { setFocused(false); onBlur?.(event) }}
            placeholderTextColor={colors.textSubtle}
            style={[styles.input, rest.editable === false ? styles.inputReadOnly : null, style]}
          />
        </View>
      </View>

      {hint ? (
        <Text variant="caption" color={invalid ? colors.red : colors.textMuted} style={styles.hint}>
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

/** Row of small preset pills that fill a value in one tap. */
export function QuickPicks({
  values,
  selected,
  onSelect,
  format,
}: {
  values: readonly number[]
  selected?: number
  onSelect: (value: number) => void
  format: (value: number) => string
}) {
  return (
    <View style={styles.picks}>
      {values.map((value) => {
        const active = value === selected
        return (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={format(value)}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(value)}
            hitSlop={4}
            style={({ pressed }) => [styles.pick, active ? styles.pickActive : null, pressed ? styles.pickPressed : null]}
          >
            <Text style={[styles.pickLabel, active ? styles.pickLabelActive : null]}>
              {format(value)}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  label: {
    paddingLeft: spacing.xs,
  },
  hint: {
    paddingHorizontal: spacing.xs,
  },
  halo: {
    position: 'absolute',
    top: -HALO,
    left: -HALO,
    right: -HALO,
    bottom: -HALO,
    borderRadius: radius.lg + HALO,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(58, 79, 180, 0.16)',
  },
  haloInvalid: {
    backgroundColor: 'rgba(217, 58, 58, 0.14)',
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    paddingHorizontal: 18,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    boxShadow: '0px 1px 2px rgba(20, 24, 43, 0.04)',
  },
  boxFocused: {
    borderColor: colors.navy,
  },
  boxInvalid: {
    borderColor: colors.red,
  },
  input: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 17,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
    color: colors.text,
    padding: 0,
    // Web draws its own focus ring inside the field; the field draws one already.
    outlineWidth: 0,
  },
  inputReadOnly: {
    color: colors.textMuted,
  },
  picks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pick: {
    height: 34,
    minWidth: 52,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
    boxShadow: '0px 6px 14px rgba(20, 24, 43, 0.20)',
  },
  pickPressed: {
    opacity: 0.7,
  },
  pickLabel: {
    fontFamily: fonts.medium,
    fontSize: 13.5,
    lineHeight: 18,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  pickLabelActive: {
    fontFamily: fonts.semibold,
    color: colors.white,
  },
})
