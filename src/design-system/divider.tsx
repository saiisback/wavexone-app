import { useColors } from './theme'
import { StyleSheet, View } from 'react-native'


/** Hairline between rows inside a card. */
export function Divider({ inset = 0, color }: { inset?: number; color?: string }) {
  const colors = useColors()
  color ??= colors.divider

  return <View style={[styles.base, { marginLeft: inset, backgroundColor: color }]} />
}

/** Vertical hairline, used to split the Activity summary into two columns. */
export function VerticalDivider({ color }: { color?: string }) {
  const colors = useColors()
  color ??= colors.onInkDivider

  return <View style={[styles.vertical, { backgroundColor: color }]} />
}

const styles = StyleSheet.create({
  base: {
    height: StyleSheet.hairlineWidth * 2,
  },
  vertical: {
    width: StyleSheet.hairlineWidth * 2,
    alignSelf: 'stretch',
  },
})
