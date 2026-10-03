import { StyleSheet, View } from 'react-native'

import { colors } from './colors'
import { DeltaTriangle } from './icons'
import { Text } from './text'
import { fonts } from './tokens'

export type DeltaProps = {
  /** Pre-formatted, e.g. "+0.34%". */
  label: string
  direction: 'up' | 'down'
  /** Dark cards use brighter semantic foregrounds than light ones. */
  onInk?: boolean
  size?: number
}

/** Triangle plus signed percentage, the pairing used on every price surface. */
export function Delta({ label, direction, onInk = false, size = 17 }: DeltaProps) {
  const tint =
    direction === 'up'
      ? (onInk ? colors.greenOnInk : colors.green)
      : (onInk ? colors.redOnInk : colors.red)

  return (
    <View style={styles.row}>
      <DeltaTriangle direction={direction} color={tint} size={size * 0.72} />
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
    fontFamily: fonts.bold,
  },
})
