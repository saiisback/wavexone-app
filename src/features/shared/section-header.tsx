import { StyleSheet, View } from 'react-native'

import { ChevronDownIcon, ChevronRightIcon, Pressable, Text, colors, fonts } from '../../design-system'

export type SectionHeaderProps = {
  title: string
  /** Right-hand affordance: "See all", "This month ⌄". */
  action?: string
  /** `down` opens a picker ("This month ⌄"); `right` goes to another screen. */
  withChevron?: boolean | 'right'
  onPressAction?: () => void
}

/** Section title with its action as a quiet text link: "Watchlist · See all ›". */
export function SectionHeader({
  title,
  action,
  withChevron = false,
  onPressAction,
}: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text variant="section">{title}</Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${action}, ${title}`}
          onPress={onPressAction}
          hitSlop={8}
          style={styles.action}
        >
          <Text style={styles.actionLabel}>{action}</Text>
          {withChevron === 'right' ? (
            <ChevronRightIcon size={14} color={colors.textMuted} />
          ) : withChevron ? (
            <ChevronDownIcon size={14} color={colors.textMuted} />
          ) : null}
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 32,
    paddingLeft: 4,
  },
  actionLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
  },
})
