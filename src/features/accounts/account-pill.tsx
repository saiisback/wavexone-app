import { StyleSheet, View } from 'react-native'

import { ChevronDownIcon, Pressable, Text, colors, fonts, radius, shadow } from '../../design-system'

/**
 * The selected account as a pill — live/demo dot, mode and number — that
 * opens the account switcher. `light` is a white pill for page headers;
 * `onInk` is frosted for the brand gradient.
 */
export function AccountPill({
  mode,
  number,
  onPress,
  tone = 'light',
}: {
  mode: string
  number: string
  onPress: () => void
  tone?: 'light' | 'onInk'
}) {
  const ink = tone === 'onInk'
  const demo = mode === 'DEMO'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Switch account, ${mode} ${number}`}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.pill, ink ? styles.onInk : styles.light, pressed ? styles.pressed : null]}
    >
      <View style={[styles.dotHalo, demo ? styles.haloDemo : ink ? styles.haloOnInk : styles.haloLive]}>
        <View style={[styles.dot, demo ? styles.demo : ink ? styles.liveOnInk : styles.live]} />
      </View>
      <Text style={[styles.mode, { color: ink ? colors.onInk : colors.text }]}>{mode}</Text>
      <Text style={[styles.number, { color: ink ? colors.onInkMuted : colors.textMuted }]}>{number}</Text>
      <ChevronDownIcon size={14} color={ink ? colors.onInk : colors.textMuted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
  },
  light: {
    backgroundColor: colors.glass,
    boxShadow: shadow.card,
  },
  onInk: {
    backgroundColor: colors.glassOnInk,
    borderWidth: 1,
    borderColor: colors.glassOnInkEdge,
  },
  pressed: {
    opacity: 0.8,
  },
  dotHalo: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloLive: { backgroundColor: colors.greenSoft },
  haloOnInk: { backgroundColor: 'rgba(123, 227, 166, 0.22)' },
  haloDemo: { backgroundColor: 'rgba(230, 190, 63, 0.22)' },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  live: { backgroundColor: colors.green },
  liveOnInk: { backgroundColor: colors.greenOnInk },
  demo: { backgroundColor: colors.gold },
  mode: {
    fontFamily: fonts.semibold,
    fontSize: 12.5,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  number: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 17,
    fontVariant: ['tabular-nums'],
  },
})
