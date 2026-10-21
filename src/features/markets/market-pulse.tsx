import { useColors, useThemeStyles } from '../../design-system/theme'
import type { Palette } from '../../design-system/colors'
import { StyleSheet, View } from 'react-native'

import {
  AssetIcon,
  ChevronRightIcon,
  PressableScale,
  Text,
  radius,
  spacing,
} from '../../design-system'
import { formatPercent } from '../../data/format'
import type { Instrument } from '../../data/types'

export function MarketPulse({
  instruments,
  onPress,
}: {
  instruments: readonly Instrument[]
  onPress: () => void
}) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  if (instruments.length === 0) return null

  const rising = instruments.filter((item) => item.changePercent > 0).length
  const leader = instruments.reduce((best, item) =>
    Math.abs(item.changePercent) > Math.abs(best.changePercent) ? item : best,
  )
  const leaderVerb = leader.changePercent >= 0 ? 'leads' : 'moves most'

  return (
    <PressableScale
      accessibilityLabel="View all markets from market pulse"
      onPress={onPress}
      scaleTo={0.985}
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <Text variant="caption" weight="semibold" color={colors.white}>Market pulse</Text>
          <View style={styles.live}>
            <View style={styles.liveDot} />
            <Text variant="micro" weight="semibold" color={colors.goldSoft}>LIVE</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.message}>
            <Text variant="heading" color={colors.white}>
              {`${rising} of ${instruments.length} markets are moving higher`}
            </Text>
            <Text variant="caption" color={colors.navyOnMuted}>
              {`${leader.symbol} ${leaderVerb} at ${formatPercent(leader.changePercent)}`}
            </Text>
          </View>
          <View style={styles.mark}>
            <AssetIcon
              kind={leader.icon}
              label={leader.iconLabel}
              tint={leader.iconTint}
              symbol={leader.symbol}
              category={leader.category}
              size={42}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.rule} />
          <Text variant="caption" weight="semibold" color={colors.gold}>View markets</Text>
          <ChevronRightIcon size={14} color={colors.gold} />
        </View>
      </View>
    </PressableScale>
  )
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  card: {
    overflow: 'hidden',
    padding: spacing.xl,
    gap: spacing.xl,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    backgroundColor: colors.royal,
    boxShadow: '0px 10px 26px rgba(30, 42, 94, 0.18)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gold,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  message: {
    flex: 1,
    gap: spacing.sm,
  },
  mark: {
    width: 54,
    height: 54,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  footer: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    marginRight: spacing.sm,
    backgroundColor: colors.navyDivider,
  },
}))
