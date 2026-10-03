import { StyleSheet, View } from 'react-native'

import {
  Amount,
  ArrowRightIcon,
  AssetIcon,
  Badge,
  Button,
  ButtonText,
  Card,
  ClockIcon,
  DeltaPill,
  MoreVerticalIcon,
  Pressable,
  PressableScale,
  Text,
  TickFlash,
  colors,
  radius,
  spacing,
  type AssetIconKind,
} from '../../design-system'
import { formatLots, formatPercent, formatPrice, formatSignedMoney, trendOf } from '../../data/format'

export type PositionCardProps = {
  id: string
  symbol: string
  description: string
  iconKind: AssetIconKind
  iconLabel?: string
  iconTint?: string
  /** "Stocks", "Forex", … — narrows the logo lookup. */
  category?: string
  side: 'Buy' | 'Sell'
  lots: number
  entry: number
  current: number
  precision: number
  pnl: number
  /**
   * `open` is the full goal-style card, `pending` the waiting-order card,
   * `closed` a compact result row.
   */
  variant?: 'open' | 'pending' | 'closed'
  /** "Open" for a filled position, "Order price" for a pending one. */
  entryLabel?: string
  /** "Current" while open, "Closed at" once closed. */
  currentLabel?: string
  /** Copy on the footer button — "Close", "Cancel", … */
  actionLabel: string
  onAction: (id: string) => void
  /** Shown beside the action when the order can still be changed. */
  onModify?: (id: string) => void
  onMenu: (id: string) => void
  /** Opens the instrument. */
  onPress?: () => void
}

/** A single open / pending / closed position. */
export function PositionCard(props: PositionCardProps) {
  if (props.variant === 'closed') return <ClosedTradeCard {...props} />
  if (props.variant === 'pending') return <PendingOrderCard {...props} />
  return <OpenPositionCard {...props} />
}

/**
 * The reference "goal card": who and which way, a big live P&L, where the
 * trade came in and where it is now, and the two things you can do to it.
 */
function OpenPositionCard({
  id,
  symbol,
  description,
  iconKind,
  iconLabel,
  iconTint,
  category,
  side,
  lots,
  entry,
  current,
  precision,
  pnl,
  entryLabel = 'Open',
  currentLabel = 'Current',
  actionLabel,
  onAction,
  onModify,
  onMenu,
  onPress,
}: PositionCardProps) {
  const move = priceMove(side, entry, current)
  const tint = pnl > 0.005 ? colors.green : pnl < -0.005 ? colors.red : colors.text

  return (
    <Card style={styles.card}>
      <PressableScale onPress={onPress} onLongPress={() => onMenu(id)} scaleTo={0.99}>
        <View style={styles.cardBody}>
          <Identity
            id={id}
            symbol={symbol}
            description={description}
            iconKind={iconKind}
            iconLabel={iconLabel}
            iconTint={iconTint}
            category={category}
            side={side}
            onMenu={onMenu}
          />

          <View style={styles.figureRow}>
            <View style={styles.figure}>
              <TickFlash value={pnl}>
                <Amount variant="display" color={tint} numberOfLines={1} adjustsFontSizeToFit>
                  {formatSignedMoney(pnl)}
                </Amount>
              </TickFlash>
              <Text variant="caption" color={colors.textMuted}>
                {`P&L on ${formatLots(lots)}`}
              </Text>
            </View>
            {move !== null ? (
              <DeltaPill label={formatPercent(move).replace(/^[+-]/, '')} direction={trendOf(move)} />
            ) : null}
          </View>

          <PricePair
            entryLabel={entryLabel}
            entry={formatPrice(entry, precision)}
            currentLabel={currentLabel}
            current={formatPrice(current, precision)}
          />
        </View>
      </PressableScale>
      <CardMenu id={id} symbol={symbol} onMenu={onMenu} />

      <View style={styles.actions}>
        <Button tone="track" onPress={() => onAction(id)} style={styles.action}>
          <ButtonText tone="track">{actionLabel}</ButtonText>
        </Button>
        {onModify ? (
          <Button tone="ink" onPress={() => onModify(id)} style={styles.action}>
            <ButtonText tone="ink">Modify</ButtonText>
          </Button>
        ) : null}
      </View>
    </Card>
  )
}

/**
 * A limit order waiting for its price: how far the market still has to
 * travel, and Cancel / Modify.
 */
function PendingOrderCard({
  id,
  symbol,
  description,
  iconKind,
  iconLabel,
  iconTint,
  category,
  side,
  lots,
  entry,
  current,
  precision,
  entryLabel = 'Order price',
  currentLabel = 'Current',
  actionLabel,
  onAction,
  onModify,
  onMenu,
  onPress,
}: PositionCardProps) {
  const away = current > 0 ? Math.abs((entry - current) / current) * 100 : null

  return (
    <Card style={styles.card}>
      <PressableScale onPress={onPress} onLongPress={() => onMenu(id)} scaleTo={0.99}>
        <View style={styles.cardBody}>
          <Identity
            id={id}
            symbol={symbol}
            description={description}
            iconKind={iconKind}
            iconLabel={iconLabel}
            iconTint={iconTint}
            category={category}
            side={side}
            onMenu={onMenu}
          />

          <View style={styles.pendingBand}>
            <ClockIcon size={16} color={colors.tintAmberInk} />
            <Text variant="caption" weight="medium" color={colors.text} style={styles.pendingText}>
              {`Waiting to fill · ${formatLots(lots)}`}
            </Text>
            {away !== null ? (
              <Text variant="caption" weight="semibold" color={colors.tintAmberInk}>
                {`${formatPercent(away).replace(/^[+-]/, '')} away`}
              </Text>
            ) : null}
          </View>

          <PricePair
            entryLabel={entryLabel}
            entry={formatPrice(entry, precision)}
            currentLabel={currentLabel}
            current={formatPrice(current, precision)}
          />
        </View>
      </PressableScale>
      <CardMenu id={id} symbol={symbol} onMenu={onMenu} />

      <View style={styles.actions}>
        <Button tone="track" onPress={() => onAction(id)} style={styles.action}>
          <ButtonText tone="track">{actionLabel}</ButtonText>
        </Button>
        {onModify ? (
          <Button tone="ink" onPress={() => onModify(id)} style={styles.action}>
            <ButtonText tone="ink">Modify</ButtonText>
          </Button>
        ) : null}
      </View>
    </Card>
  )
}

/**
 * A finished trade as one compact row: icon, side and size, open → close,
 * and the result in green or red. Tapping it opens the details.
 */
function ClosedTradeCard({
  id,
  symbol,
  iconKind,
  iconLabel,
  iconTint,
  category,
  side,
  lots,
  entry,
  current,
  precision,
  pnl,
  actionLabel,
  onAction,
  onMenu,
}: PositionCardProps) {
  const tint = pnl > 0.005 ? colors.green : pnl < -0.005 ? colors.red : colors.textMuted
  return (
    <Card padded={false} style={styles.closed}>
      <PressableScale
        onPress={() => onAction(id)}
        onLongPress={() => onMenu(id)}
        scaleTo={0.985}
        style={styles.closedPress}
        accessibilityLabel={`${actionLabel}, ${symbol} ${side} ${formatLots(lots)}, result ${formatSignedMoney(pnl)}`}
      >
        <View style={styles.closedBody}>
          <AssetIcon
            kind={iconKind}
            label={iconLabel}
            tint={iconTint}
            symbol={symbol}
            category={category}
            size={42}
          />
          <View style={styles.closedText}>
            <View style={styles.titleRow}>
              <Text variant="strong" numberOfLines={1} style={styles.symbol}>
                {symbol}
              </Text>
              <Badge tone={side === 'Buy' ? 'buy' : 'sell'}>{side}</Badge>
            </View>
            <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.tabular}>
              {`${formatPrice(entry, precision)} → ${formatPrice(current, precision)}`}
            </Text>
          </View>
          <View style={styles.closedResult}>
            <Amount variant="strong" color={tint} numberOfLines={1} style={styles.tabular}>
              {formatSignedMoney(pnl)}
            </Amount>
            <Text variant="caption" color={colors.textSubtle} numberOfLines={1}>
              {formatLots(lots)}
            </Text>
          </View>
        </View>
      </PressableScale>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`More actions for ${symbol}`}
        hitSlop={10}
        onPress={() => onMenu(id)}
        style={styles.moreCompact}
      >
        <MoreVerticalIcon size={18} color={colors.textSubtle} />
      </Pressable>
    </Card>
  )
}

/** Icon, symbol with its side badge, name, and the ⋮ menu. */
function Identity({
  id,
  symbol,
  description,
  iconKind,
  iconLabel,
  iconTint,
  category,
  side,
  onMenu,
}: Pick<PositionCardProps, 'id' | 'symbol' | 'description' | 'iconKind' | 'iconLabel' | 'iconTint' | 'category' | 'side' | 'onMenu'>) {
  return (
    <View style={styles.header}>
      <AssetIcon kind={iconKind} label={iconLabel} tint={iconTint} symbol={symbol} category={category} size={44} />
      <View style={styles.identity}>
        <View style={styles.titleRow}>
          <Text variant="strong" numberOfLines={1} style={styles.symbol}>
            {symbol}
          </Text>
          <Badge tone={side === 'Buy' ? 'buy' : 'sell'}>{side}</Badge>
        </View>
        <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
          {description}
        </Text>
      </View>
      {/* Room for the ⋮ button, which the card draws outside its press
          target: a button inside a button is invalid (and nests on web). */}
      <View style={styles.moreSlot} />
    </View>
  )
}

/** The ⋮ menu, floated over the card's top-right corner beside `Identity`. */
function CardMenu({ id, symbol, onMenu }: Pick<PositionCardProps, 'id' | 'symbol' | 'onMenu'>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`More actions for ${symbol}`}
      hitSlop={10}
      onPress={() => onMenu(id)}
      style={[styles.more, styles.moreFloat]}
    >
      <MoreVerticalIcon size={20} color={colors.textMuted} />
    </Pressable>
  )
}

/** Two inset wells, where the trade came in → where it is now. */
function PricePair({
  entryLabel,
  entry,
  currentLabel,
  current,
}: {
  entryLabel: string
  entry: string
  currentLabel: string
  current: string
}) {
  return (
    <View style={styles.pair}>
      <View style={styles.well}>
        <Text variant="overline" color={colors.textSubtle}>
          {entryLabel}
        </Text>
        <Text variant="strong" numberOfLines={1} style={styles.tabular}>
          {entry}
        </Text>
      </View>
      <View style={styles.arrow}>
        <ArrowRightIcon size={14} color={colors.brandBright} />
      </View>
      <View style={styles.well}>
        <Text variant="overline" color={colors.textSubtle}>
          {currentLabel}
        </Text>
        <Text variant="strong" numberOfLines={1} style={styles.tabular}>
          {current}
        </Text>
      </View>
    </View>
  )
}

/** Price move in the trade's favour, in percent; null without an entry. */
function priceMove(side: 'Buy' | 'Sell', entry: number, current: number): number | null {
  if (!(entry > 0)) return null
  const raw = ((current - entry) / entry) * 100
  return side === 'Buy' ? raw : -raw
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  cardBody: {
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  symbol: {
    flexShrink: 1,
  },
  moreSlot: {
    width: 36,
    height: 36,
  },
  // Aligned with the 44pt icon in the header row: card padding plus half
  // the difference in height.
  moreFloat: {
    position: 'absolute',
    top: spacing.lg + 4,
    right: spacing.lg,
  },
  closedPress: {
    flex: 1,
  },
  closedBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  more: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.track,
  },
  figureRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  figure: {
    flex: 1,
    gap: 2,
  },
  pair: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  well: {
    flex: 1,
    gap: 2,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.well,
  },
  arrow: {
    width: 28,
    height: 28,
    marginHorizontal: -6,
    zIndex: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    boxShadow: '0px 2px 8px rgba(20, 24, 43, 0.10)',
  },
  pendingBand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.tintAmber,
  },
  pendingText: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
  closed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 72,
    paddingVertical: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
  },
  closedText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  closedResult: {
    alignItems: 'flex-end',
    gap: 3,
  },
  moreCompact: {
    minWidth: 28,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
})
