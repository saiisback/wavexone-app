import { StyleSheet, View } from 'react-native'

import { colors } from './colors'
import { PressableScale } from './pressable'
import { Text } from './text'

export type CircleButtonProps = {
  children: React.ReactNode
  onPress?: () => void
  size?: number
  tone?: 'outline' | 'gold' | 'onInk'
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
    <PressableScale onPress={onPress} scaleTo={0.9} hitSlop={6}>
      <View
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[styles.base, tones[tone], { width: size, height: size, borderRadius: size / 2 }]}
      >
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
    <PressableScale onPress={onPress} scaleTo={0.94} style={styles.action}>
      <View
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.base, tones[tone], styles.actionCircle]}
      >
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
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gold: {
    backgroundColor: colors.gold,
  },
  onInk: {
    backgroundColor: colors.onInkCircle,
  },
})
