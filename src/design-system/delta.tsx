import { useColors } from './theme'
import { StyleSheet, View } from 'react-native'

import { DeltaTriangle } from './icons'
import { Text } from './text'
import { fonts } from './tokens'

export type DeltaProps = {
  /** Pre-formatted, e.g. "+0.34%". */
  label: string
  /** `flat` is an exact zero: muted, with no arrow claiming a direction. */
  direction: 'up' | 'down' | 'flat'
  /** Dark cards use brighter semantic foregrounds than light ones. */
  onInk?: boolean
  /** Written on the navy Wallet card: light gain and loss shades. */
  onCard?: boolean
  size?: number
}

/** Triangle plus signed percentage, the pairing used on every price surface. */
export function Delta({ label, direction, onInk = false, onCard = false, size = 17 }: DeltaProps) {
  const colors = useColors()

  const tint = onCard
    ? direction === 'flat' ? 'rgba(255, 255, 255, 0.72)' : direction === 'up' ? colors.walletGain : colors.walletLoss
    : direction === 'flat'
      ? (onInk ? colors.onInkMuted : colors.textMuted)
      : direction === 'up'
        ? (onInk ? colors.greenOnInk : colors.green)
        : (onInk ? colors.redOnInk : colors.red)

  return (
    <View style={styles.row}>
      {direction === 'flat' ? null : (
        <DeltaTriangle direction={direction} color={tint} size={size * 0.72} />
      )}
      <Text style={[styles.label, { color: tint, fontSize: size, lineHeight: size * 1.3 }]}>
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontFamily: fonts.semibold,
  },
})

/**
 * The same pairing on a tinted chip — for dense lists, where a bare coloured
 * number gets lost next to the price.
 */
export function DeltaPill({ label, direction, size = 13 }: Omit<DeltaProps, 'onInk'>) {
  const colors = useColors()

  const flat = direction === 'flat'
  const up = direction === 'up'
  // Stocks style: a solid pill with white figures.
  const tint = flat ? colors.textMuted : colors.white
  const fill = flat ? colors.track : up ? colors.greenFill : colors.redFill
  return (
    <View style={[pill.base, { backgroundColor: fill }]}>
      {flat ? null : <DeltaTriangle direction={direction} color={tint} size={size * 0.62} />}
      <Text style={[styles.label, { color: tint, fontSize: size, lineHeight: size * 1.3 }]}>
        {label}
      </Text>
    </View>
  )
}

const pill = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderCurve: 'continuous',
  },
})
