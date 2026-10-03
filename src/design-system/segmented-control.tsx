import { Pressable, StyleSheet, View } from 'react-native'

import { colors } from './colors'
import { Text } from './text'
import { fonts, radius } from './tokens'

export type SegmentedControlProps<T extends string> = {
  options: readonly T[]
  value: T
  onChange: (value: T) => void
}

/**
 * Navy segmented control used on Positions and Activity.
 *
 * The mockups draw a hairline between neighbouring *inactive* segments only —
 * the selected pill swallows the separators on either side of it.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.track}>
      {options.map((option, index) => {
        const selected = option === value
        const previousSelected = index > 0 && options[index - 1] === value
        const showDivider = index > 0 && !selected && !previousSelected

        return (
          <View key={option} style={styles.slot}>
            {showDivider ? <View style={styles.divider} /> : null}
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onChange(option)}
              style={[styles.segment, selected ? styles.segmentSelected : null]}
            >
              <Text style={[styles.label, selected ? styles.labelSelected : null]}>{option}</Text>
            </Pressable>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.track,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    padding: 4,
  },
  slot: {
    flex: 1,
    justifyContent: 'center',
  },
  divider: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 1,
    backgroundColor: colors.border,
  },
  segment: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderCurve: 'continuous',
  },
  segmentSelected: {
    backgroundColor: colors.navy,
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
  },
  labelSelected: {
    fontFamily: fonts.bold,
    color: colors.onInk,
  },
})
