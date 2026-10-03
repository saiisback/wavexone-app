import { StyleSheet, View } from 'react-native'

import {
  Amount,
  AssetIcon,
  CandlesIcon,
  DepositIcon,
  IconChip,
  MoreVerticalIcon,
  Pressable,
  PressableScale,
  Text,
  WithdrawIcon,
  colors,
  fonts,
  radius,
  spacing,
  type AssetIconKind,
} from '../../design-system'
import { calendarDate } from '../../data/activity-dates'
import { formatSignedMoney } from '../../data/format'

export type ActivityRowProps = {
  id: string
  kind: 'trade' | 'deposit' | 'withdrawal'
  title: string
  subtitle: string
  date: string
  time: string
  amount: number
  iconKind?: AssetIconKind
  iconLabel?: string
  iconTint?: string
  /** The traded instrument's ticker and category, for its logo. */
  iconSymbol?: string
  iconCategory?: string
  /** Show the calendar day beside the time (rows under "Earlier"). */
  showDate?: boolean
  onMenu: (id: string) => void
}

const TILE = 44

const TAG: Record<ActivityRowProps['kind'], { label: string; fill: string; ink: string }> = {
  trade: { label: 'Trade', fill: colors.tintBlue, ink: colors.tintBlueInk },
  deposit: { label: 'Deposit', fill: colors.tintMint, ink: colors.tintMintInk },
  withdrawal: { label: 'Withdrawal', fill: colors.tintRose, ink: colors.tintRoseInk },
}

/**
 * One line of history in the reference transaction style: a tinted icon
 * tile, the title over a meta line with a small coloured tag, and the
 * amount in green or red. Drawn flat; the list puts rows on a white card.
 */
export function ActivityRow({
  id,
  kind,
  title,
  subtitle,
  date,
  time,
  amount,
  iconKind,
  iconLabel,
  iconTint,
  iconSymbol,
  iconCategory,
  showDate = true,
  onMenu,
}: ActivityRowProps) {
  const { tag, detail } = metaOf(kind, title, subtitle)
  const when = [showDate ? shortDate(date) : '', time].filter(Boolean).join(' · ')
  const flat = Math.abs(amount) < 0.005

  // The row and its ⋮ are siblings, not nested: a button inside a button is
  // invalid (and nests <button> elements on web).
  return (
    <View style={styles.row}>
      <PressableScale onPress={() => onMenu(id)} scaleTo={0.985} style={styles.press}>
        <View style={styles.body}>
          <IconChip size={TILE} shape="square" tone={kind === 'deposit' ? 'mint' : kind === 'withdrawal' ? 'rose' : 'blue'}>
            {kind === 'deposit' ? <DepositIcon size={20} color={colors.tintMintInk} /> : null}
            {kind === 'withdrawal' ? <WithdrawIcon size={20} color={colors.tintRoseInk} /> : null}
            {kind === 'trade' ? (
              iconKind ? (
                <AssetIcon
                  kind={iconKind}
                  label={iconLabel}
                  tint={iconTint}
                  symbol={iconSymbol}
                  category={iconCategory}
                  size={28}
                />
              ) : (
                <CandlesIcon size={20} color={colors.tintBlueInk} />
              )
            ) : null}
          </IconChip>

          <View style={styles.identity}>
            <Text variant="strong" numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.meta}>
              <View style={[styles.tag, { backgroundColor: tag.fill }]}>
                <Text style={[styles.tagLabel, { color: tag.ink }]}>{tag.label}</Text>
              </View>
              {detail ? (
                <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.detail}>
                  {detail}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.trailing}>
            {tag.label === 'Pending' && flat ? (
              <Text variant="strong" color={colors.textSubtle}>
                —
              </Text>
            ) : (
              <Amount
                variant="strong"
                color={flat ? colors.textMuted : amount < 0 ? colors.red : colors.green}
                style={styles.amount}
                numberOfLines={1}
              >
                {formatSignedMoney(amount)}
              </Amount>
            )}
            {when ? (
              <Text variant="caption" color={colors.textSubtle} numberOfLines={1}>
                {when}
              </Text>
            ) : null}
          </View>
        </View>
      </PressableScale>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`More actions for ${title}`}
        hitSlop={10}
        onPress={() => onMenu(id)}
        style={styles.more}
      >
        <MoreVerticalIcon size={18} color={colors.textSubtle} />
      </Pressable>
    </View>
  )
}

type Tag = { label: string; fill: string; ink: string }

/**
 * The coloured tag and the rest of the meta line. Trades lead with their
 * side ("Buy" · 0.50 lots), pending orders with "Pending", and funding rows
 * whose title already names the kind lead with their status instead.
 */
function metaOf(kind: ActivityRowProps['kind'], title: string, subtitle: string): { tag: Tag; detail: string } {
  if (kind === 'trade') {
    const pending = /^Pending\s*•\s*/.exec(subtitle)
    if (pending) {
      return { tag: { label: 'Pending', fill: colors.tintAmber, ink: colors.tintAmberInk }, detail: subtitle.slice(pending[0].length) }
    }
    const side = /^(Buy|Sell)\s+/.exec(subtitle)
    if (side) {
      const buy = side[1] === 'Buy'
      return {
        tag: { label: side[1], fill: buy ? colors.greenSoft : colors.redSoft, ink: buy ? colors.greenSoftText : colors.redSoftText },
        detail: subtitle.slice(side[0].length),
      }
    }
  }
  const base = TAG[kind]
  if (title.trim().toLowerCase() === base.label.toLowerCase() && subtitle) {
    return { tag: { ...base, label: subtitle }, detail: '' }
  }
  return { tag: base, detail: subtitle }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "29 Sep" from an API day; the raw text if it carries no day. */
function shortDate(value: string): string {
  const day = calendarDate(value)
  return day ? `${day.getDate()} ${MONTHS[day.getMonth()]}` : value
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
  },
  press: {
    flex: 1,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  tagLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
  },
  detail: {
    flexShrink: 1,
  },
  trailing: {
    flexShrink: 0,
    maxWidth: '42%',
    alignItems: 'flex-end',
    gap: 3,
  },
  amount: {
    fontVariant: ['tabular-nums'],
  },
  more: {
    minWidth: 28,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
