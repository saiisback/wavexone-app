import { useNavigation } from '@react-navigation/native'

import { useSafeBack } from '../design-system'

import type { FundingMode } from '../data/types'
import type { HomeStackParamList, RootStackParamList, TabParamList } from './types'

type LooseNavigation = {
  navigate: (name: string, params?: object) => void
}

/**
 * Typed facade for the routes that live above the current navigator.
 *
 * React Navigation bubbles an unhandled action up to the parent, so a screen
 * deep in a tab stack can open a root route directly. Funnelling that through
 * one hook keeps `getParent()` chains — which break whenever the navigator
 * tree is reshaped — out of the screens.
 */
export function useAppNavigation() {
  // The navigator that handles each route is resolved at runtime by bubbling,
  // which no single static navigator type can express. The cast is contained
  // here; every caller gets the typed methods returned below.
  const navigation = useNavigation() as unknown as LooseNavigation
  const goBack = useSafeBack()

  return {
    openInstrument: (instrumentId: string) => navigation.navigate('Instrument', { instrumentId }),

    openFunding: (mode: FundingMode) => navigation.navigate('Funding', { mode }),

    openOrderTicket: (
      instrumentId: string,
      side: 'Buy' | 'Sell',
      draft?: Pick<RootStackParamList['OrderTicket'], 'lots' | 'orderType'>,
    ) => navigation.navigate('OrderTicket', { instrumentId, side, ...draft }),

    openModifyOrder: (positionId: string) => navigation.navigate('ModifyOrder', { positionId }),

    openEditPhone: () => navigation.navigate('EditPhone'),

    openAccountSwitcher: () => navigation.navigate('AccountSwitcher'),

    openInstrumentPicker: () => navigation.navigate('InstrumentPicker'),

    openTab: (tab: keyof TabParamList) => navigation.navigate(tab),

    /** Jumps to the Home tab and lands on one of its screens. */
    openHomeScreen: (screen: keyof HomeStackParamList) => navigation.navigate('Home', { screen }),

    goBack,
  }
}
