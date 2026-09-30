import type {
  Account,
  ActivityEntry,
  ChartSeries,
  Instrument,
  Notification,
  Position,
  Profile,
  Timeframe,
} from '../data/types'

/**
 * The seam. Guide §5: "Screens call its typed interface and must not know
 * about collection names, custom headers, portal cookies, raw token
 * responses, legacy parameter names, or inconsistent response envelopes."
 *
 * Everything here is expressed in the app's own domain types, so a screen
 * cannot tell whether it is talking to fixtures or to the API.
 */

export type SignInResult =
  | { kind: 'authenticated' }
  | { kind: 'verification-required' }

export type OrderCounts = { open: number; pending: number; total: number }

export type SwitchAccountRequest = {
  accountId: string
  idempotencyKey: string
}

export type OrderSide = 'Buy' | 'Sell'

export type PlaceOrderRequest = {
  instrumentId: string
  side: OrderSide
  /** Decimal string. Guide §5 forbids floats for order calculations. */
  lots: string
  /** Absent for a market order. */
  limitPrice?: string
  stopLoss?: string
  takeProfit?: string
  /**
   * Identifies one user intent. Required, because the underlying mutations
   * are `GET` requests (guide §4.5) and must never execute twice.
   */
  idempotencyKey: string
}

export type ModifyOrderRequest = {
  positionId: string
  stopLoss?: string
  takeProfit?: string
  idempotencyKey: string
}

export type CloseOrderRequest = {
  positionId: string
  idempotencyKey: string
}

export type FundingConfiguration = {
  depositMethods: readonly string[]
  withdrawalMethods: readonly string[]
  quickAmounts: readonly number[]
  kycStatus: Profile['kycStatus']
  minimumDeposit: number
  minimumWithdrawal: number
}

export type FundingRequest = {
  accountId: string
  /** Decimal string. */
  amount: string
  method: string
  idempotencyKey: string
}

export type TransferRequest = {
  fromAccountId: string
  toAccountId: string
  amount: string
  idempotencyKey: string
}

export interface WaveXBackend {
  session: {
    signIn(email: string, password: string): Promise<SignInResult>
    /** Restores a stored session on launch; false when there is none. */
    restore(): Promise<boolean>
    /** Re-issues the bearer token without asking for the password. */
    refresh(): Promise<void>
    signOut(): Promise<void>
  }

  accounts: {
    summary(accountId: string): Promise<Account>
    list(): Promise<readonly Account[]>
    switchAccount(request: SwitchAccountRequest): Promise<void>
    profile(): Promise<Profile>
  }

  markets: {
    catalogue(): Promise<readonly Instrument[]>
    favorites(): Promise<readonly string[]>
    setFavorite(instrumentId: string, favorite: boolean): Promise<void>
    quoteSnapshot(instrumentIds: readonly string[]): Promise<readonly Instrument[]>
    candles(instrumentId: string, timeframe: Timeframe): Promise<ChartSeries>
  }

  orders: {
    counts(accountId: string): Promise<OrderCounts>
    list(accountId: string): Promise<readonly Position[]>
    history(accountId: string): Promise<readonly Position[]>
    place(request: PlaceOrderRequest): Promise<void>
    modify(request: ModifyOrderRequest): Promise<void>
    cancel(request: CloseOrderRequest): Promise<void>
    close(request: CloseOrderRequest): Promise<void>
  }

  funds: {
    configuration(accountId: string): Promise<FundingConfiguration>
    deposit(request: FundingRequest): Promise<void>
    requestWithdrawal(request: FundingRequest): Promise<void>
    transfer(request: TransferRequest): Promise<void>
    history(accountId: string): Promise<readonly ActivityEntry[]>
  }

  engagement: {
    notifications(): Promise<readonly Notification[]>
    markNotificationsRead(ids: readonly string[]): Promise<void>
  }
}
