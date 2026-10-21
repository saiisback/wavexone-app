import { NavigationContext } from '@react-navigation/native'
import { useCallback, useContext, useSyncExternalStore } from 'react'

/** Global consumers outside a screen stay active (for example account bootstrap). */
export function useScreenFocus(): boolean {
  const navigation = useContext(NavigationContext)
  const subscribe = useCallback((notify: () => void) => {
    if (!navigation) return () => {}
    const unsubscribeFocus = navigation.addListener('focus', notify)
    const unsubscribeBlur = navigation.addListener('blur', notify)
    return () => {
      unsubscribeFocus()
      unsubscribeBlur()
    }
  }, [navigation])
  const read = useCallback(() => navigation?.isFocused() ?? true, [navigation])
  return useSyncExternalStore(subscribe, read, read)
}
