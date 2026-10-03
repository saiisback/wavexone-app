import type { NavigatorScreenParams } from '@react-navigation/native'

import type { FundingMode } from '../data/types'

/** Home tab: the dashboard and everything it pushes. */
export type HomeStackParamList = {
  Dashboard: undefined
  /** "Your Balance" — funding actions plus Market Watch. */
  Balance: undefined
  Notifications: undefined
}

/** More tab: the account menu and everything it pushes. */
export type MoreStackParamList = {
  Account: undefined
  Activity: undefined
  Profile: undefined
  Settings: undefined
  Signals: undefined
}

export type TabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined
  Markets: undefined
  Trade: { instrumentId?: string } | undefined
  Positions: undefined
  More: NavigatorScreenParams<MoreStackParamList> | undefined
}

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined
  /**
   * Instrument detail sits above the tabs: the mockup replaces the tab bar
   * with the Sell / Buy pair.
   */
  Instrument: { instrumentId: string }

  /* Presented as native form sheets. */
  Funding: { mode: FundingMode }
  /** `lots` and `orderType` carry the Trade tab's draft; absent elsewhere. */
  OrderTicket: {
    instrumentId: string
    side: 'Buy' | 'Sell'
    lots?: number
    orderType?: 'Market' | 'Limit'
  }
  /** SL/TP edit for an open position or pending order already on the account. */
  ModifyOrder: { positionId: string }
  /** The one profile field `apiSaveProfile` lets the user change. */
  EditPhone: undefined
  AccountSwitcher: undefined
  InstrumentPicker: undefined
}

declare global {
  namespace ReactNavigation {
    // The empty body is the point: this is React Navigation's global type
    // augmentation, which makes `useNavigation()` typed without a generic.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
