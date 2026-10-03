import { EmptyState, SkeletonRows } from '../../design-system'
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

  if (isEmpty?.(state.data)) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />
  }

  return <>{render(state.data)}</>
}

export function UnavailableState({ title, message }: { title: string; message: string }) {
  return <EmptyState title={title} message={message} />
}
