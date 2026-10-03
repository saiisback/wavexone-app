import { useNavigation } from '@react-navigation/native'
import { useCallback } from 'react'

/**
 * `goBack` that never fires into the void.
 *
 * A sheet that closes itself after a request can already have been swiped
 * away; a back button can be tapped twice; a pushed page can be the first
 * screen of its stack. In each case a bare `goBack()` is unhandled and React
 * Navigation logs an error. This goes back when there is somewhere to go,
 * otherwise returns to the first screen of the current navigator — or does
 * nothing when already there.
 */
export function useSafeBack() {
  const navigation = useNavigation()
  return useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack()
      return
    }
    const state = navigation.getState()
    const first = state?.routeNames?.[0]
    const current = state ? state.routes[state.index]?.name : undefined
    if (first && current !== first) {
      ;(navigation as unknown as { navigate: (name: string) => void }).navigate(first)
    }
  }, [navigation])
}
