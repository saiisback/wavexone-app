import { StyleSheet, View } from 'react-native'

import { Button, ButtonText, Card, Text, colors, radius, spacing } from '../../design-system'
import type { QueryState } from '../../backend/provider'

type QueryStateViewProps<T> = {
  state: QueryState<T>
  render(data: T): React.ReactNode
  isEmpty?: (data: T) => boolean
  emptyTitle?: string
  emptyMessage?: string
  onRetry?: () => void
}

export function QueryStateView<T>({
  state,
  render,
  isEmpty,
  emptyTitle = 'Nothing here yet',
  emptyMessage,
  onRetry,
}: QueryStateViewProps<T>) {
  if (state.status === 'loading') {
    return (
      <View style={styles.loading} accessible accessibilityLabel="Loading" accessibilityState={{ busy: true }}>
        <View testID="loading-skeleton-block" style={[styles.block, styles.headingBlock]} />
        <View testID="loading-skeleton-block" style={[styles.block, styles.panelBlock]} />
        <View testID="loading-skeleton-block" style={[styles.block, styles.lineBlock]} />
        <View testID="loading-skeleton-block" style={[styles.block, styles.shortLineBlock]} />
      </View>
    )
  }

  if (state.status === 'error') {
    return (
      <StateCard title="Could not load this" message={state.error} action="Try again" onAction={onRetry} />
    )
  }

  if (isEmpty?.(state.data)) {
    return <StateCard title={emptyTitle} message={emptyMessage} />
  }

  return <>{render(state.data)}</>
}

export function UnavailableState({ title, message }: { title: string; message: string }) {
  return <StateCard title={title} message={message} />
}

function StateCard({
  title,
  message,
  action,
  onAction,
}: {
  title: string
  message?: string
  action?: string
  onAction?: () => void
}) {
  return (
    <Card style={styles.card}>
      <Text variant="strong">{title}</Text>
      {message ? (
        <Text variant="body" color={colors.textMuted}>
          {message}
        </Text>
      ) : null}
      {action && onAction ? (
        <Button tone="track" onPress={onAction} accessibilityLabel={action}>
          <ButtonText tone="track">{action}</ButtonText>
        </Button>
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 180,
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  block: {
    backgroundColor: colors.navySoft,
    borderRadius: radius.sm,
  },
  headingBlock: {
    width: '42%',
    height: 20,
  },
  panelBlock: {
    width: '100%',
    height: 68,
    borderRadius: radius.md,
  },
  lineBlock: {
    width: '76%',
    height: 14,
  },
  shortLineBlock: {
    width: '54%',
    height: 14,
  },
  card: {
    padding: 20,
    gap: 10,
  },
})
