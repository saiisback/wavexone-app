import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Button, ButtonText, EmptyState, SkeletonRows, Text, spacing } from '../../design-system'
import { useColors } from '../../design-system/theme'
import type { QueryState } from '../../backend/provider'

type QueryStateViewProps<T> = {
  state: QueryState<T>
  render(data: T): React.ReactNode
  isEmpty?: (data: T) => boolean
  emptyTitle?: string
  emptyMessage?: string
  onRetry?: () => void
}

/**
 * Loading, failed and empty reads in one place: row-shaped placeholders while
 * the first read is in flight, then the shared empty state. A re-read after
 * invalidation keeps the previous data on screen (see `useBackendQuery`).
 */
export function QueryStateView<T>({
  state,
  render,
  isEmpty,
  emptyTitle = 'Nothing here yet',
  emptyMessage,
  onRetry,
}: QueryStateViewProps<T>) {
  const colors = useColors()
  if (state.status === 'loading') return <SkeletonRows />

  if (state.status === 'error') {
    return (
      <EmptyState
        title="Could not load this"
        message={state.error}
        action="Try again"
        onAction={onRetry ?? state.retry}
      />
    )
  }

  return <>
    {state.refreshing ? <View style={styles.feedback} accessibilityLiveRegion="polite" accessibilityState={{ busy: true }}>
      <ActivityIndicator color={colors.textMuted} size="small" />
      <Text variant="caption" color={colors.textMuted}>Updating…</Text>
    </View> : null}
    {state.refreshError ? <View style={styles.feedback} accessibilityLiveRegion="polite">
      <Text variant="caption" color={colors.textMuted} style={styles.message}>{state.refreshError}</Text>
      <Button tone="surface" onPress={onRetry ?? state.retry} accessibilityLabel="Retry update"><ButtonText tone="surface">Try again</ButtonText></Button>
    </View> : null}
    {isEmpty?.(state.data) ? <EmptyState title={emptyTitle} message={emptyMessage} /> : render(state.data)}
  </>
}

const styles = StyleSheet.create({
  feedback: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  message: { flex: 1 },
})

export function UnavailableState({ title, message }: { title: string; message: string }) {
  return <EmptyState title={title} message={message} />
}
