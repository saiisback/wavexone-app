import { ActivityIndicator, StyleSheet, View } from 'react-native'

import { Button, ButtonText, Card, Text, colors } from '../../design-system'
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
      <View style={styles.loading} accessibilityLabel="Loading">
        <ActivityIndicator color={colors.goldDeep} />
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    padding: 20,
    gap: 10,
  },
})
