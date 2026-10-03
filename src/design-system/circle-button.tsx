import { StyleSheet, View } from 'react-native'

import { colors } from './colors'
import { PressableScale } from './pressable'
import { Text } from './text'
import { shadow } from './tokens'

export type CircleButtonProps = {
  children: React.ReactNode
  onPress?: () => void
  size?: number
  tone?: 'outline' | 'gold' | 'onInk' | 'ink' | 'tint' | 'glass'
  accessibilityLabel?: string
}

/** Round icon button: back / favourite in headers, funding actions on the balance card. */
export function CircleButton({
  children,
  onPress,
  size = 48,
  tone = 'outline',
  accessibilityLabel,
}: CircleButtonProps) {
  return (
    // The press target already carries the button role; a second one inside
    // it nests a <button> in a <button> on web.
    <PressableScale onPress={onPress} scaleTo={0.9} hitSlop={6} accessibilityLabel={accessibilityLabel}>
      <View style={[styles.base, tones[tone], { width: size, height: size, borderRadius: size / 2 }]}>
        {children}
      </View>
    </PressableScale>
  )
}

/** Funding action: circle above a caption, as on the balance card. */
export function CircleAction({
  children,
  label,
  onPress,
  tone = 'onInk',
}: {
  children: React.ReactNode
  label: string
  onPress?: () => void
  tone?: 'onInk' | 'gold'
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.94} style={styles.action} accessibilityLabel={label}>
      <View style={[styles.base, tones[tone], styles.actionCircle]}>
        {children}
      </View>
      <Text variant="caption" color={colors.onInk} style={styles.actionLabel}>
        {label}
      </Text>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
  },
  actionCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  actionLabel: {
    fontSize: 15,
    marginTop: 10,
    textAlign: 'center',
  },
})

const tones = StyleSheet.create({
  // Frosted disc on the canvas.
  outline: {
    backgroundColor: colors.glass,
    boxShadow: shadow.card,
  },
  gold: {
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    boxShadow: '0px 8px 18px rgba(214, 169, 42, 0.35)',
  },
  // Solid brand disc: the one primary action in a header.
  ink: {
    backgroundColor: colors.brand,
    boxShadow: '0px 8px 18px rgba(20, 24, 43, 0.25)',
  },
  // Liquid Glass disc: thin white with a specular rim.
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    boxShadow: 'inset 0px 1px 1px rgba(255, 255, 255, 0.95), 0px 0px 0px 0.5px rgba(20, 24, 43, 0.06), 0px 6px 18px rgba(20, 24, 43, 0.08)',
  },
  // Quiet tinted disc.
  tint: {
    backgroundColor: colors.track,
  },
  // Frosted disc on navy.
  onInk: {
    backgroundColor: colors.glassOnInkStrong,
    borderWidth: 1,
    borderColor: colors.glassOnInkEdge,
  },
})
