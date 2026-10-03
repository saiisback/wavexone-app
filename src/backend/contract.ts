import type { LiveQuote, TradingEvent } from './market-feed'
import type { MarketPeriod } from '../data/store'
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

export type SetFavoriteRequest = {
  instrumentId: string
  favorite: boolean
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

/**
 * Open positions and pending orders are edited through different routes, and
 * the pending one wants the order's trigger price sent back with the SL/TP.
 */
export type ModifyOrderRequest = {
  positionId: string
  stopLoss?: string
  takeProfit?: string
  idempotencyKey: string
} & (
  | { state: 'Open' }
  | {
      state: 'Pending'
      /** Decimal string. The order's current trigger; this edit does not move it. */
      trigger: string
    }
)

export type CloseOrderRequest = {
  positionId: string
  idempotencyKey: string
}

export type FundingConfiguration = {
  depositMethods: readonly string[]
  withdrawalMethods: readonly string[]
  withdrawalFields: readonly { id: string; name: string; label: string }[]
  quickAmounts: readonly number[]
  kycStatus: Profile['kycStatus']
  availableFund: number
  minimumDeposit: number
  minimumWithdrawal: number
}

export type MarkNotificationsReadRequest = { ids: readonly string[]; idempotencyKey: string }

export type FundingRequest = {
  accountId: string
  /** Decimal string. */
  amount: string
  method: string
  details?: Readonly<Record<string, string>>
  otp?: string
  idempotencyKey: string
}

export type WithdrawalOtpRequest = {
  accountId: string
  amount: string
  /**
   * The destination, keyed by `FundingConfiguration.withdrawalFields[].name`.
   * Encoded exactly as `requestWithdrawal` encodes it, so the OTP is issued
   * for the destination the withdrawal is then submitted to.
   */
  details: Readonly<Record<string, string>>
  idempotencyKey: string
}

/** `apiSaveProfile` accepts a name and a mobile number; only the number is editable here. */
export type SaveProfileRequest = { phone: string; idempotencyKey: string }

export type OpenAccountRequest = {
  /** `demo` opens one immediately; `live` asks the broker to open one. */
  kind: 'demo' | 'live'
  idempotencyKey: string
}

export type { LiveQuote, TradingEvent } from './market-feed'

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
    saveProfile(request: SaveProfileRequest): Promise<void>
    openAccount(request: OpenAccountRequest): Promise<void>
  }

  markets: {
    catalogue(): Promise<readonly Instrument[]>
    favorites(): Promise<readonly string[]>
    setFavorite(request: SetFavoriteRequest): Promise<void>
    quoteSnapshot(instrumentIds: readonly string[]): Promise<readonly Instrument[]>
    candles(instrumentId: string, timeframe: Timeframe): Promise<ChartSeries>
    /** Closes over `period` per instrument, for row sparklines; missing ids are absent. */
    sparklines(
      instrumentIds: readonly string[],
      period: MarketPeriod,
    ): Promise<ReadonlyMap<string, readonly number[]>>
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
    sendWithdrawalOtp(request: WithdrawalOtpRequest): Promise<void>
    /** On a demo account this adds virtual funds instead of a payment request. */
    deposit(request: FundingRequest): Promise<void>
    requestWithdrawal(request: FundingRequest): Promise<void>
    history(accountId: string): Promise<readonly ActivityEntry[]>
  }

  engagement: {
    notifications(): Promise<readonly Notification[]>
    markNotificationsRead(request: MarkNotificationsReadRequest): Promise<void>
  }

  /** Streaming prices. Synchronous so a row can read one inside render. */
  prices: {
    subscribe(instrumentId: string, listener: () => void): () => void
    latest(instrumentId: string): LiveQuote | undefined
  }

  /** Order and balance changes pushed by the server: a cue to re-read. */
  events: {
    subscribe(listener: (event: TradingEvent) => void): () => void
  }
}
