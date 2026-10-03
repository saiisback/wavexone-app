import type { WaveXBackend } from './contract'
import { DEFAULT_TIMEOUT_MS, type BackendConfig } from './gate'
import { createLiveBackend } from './live-backend'
import { createMockBackend } from './mock-backend'
import type { Phase } from './endpoints'

export type { WaveXBackend } from './contract'
export type {
  CloseOrderRequest,
  FundingConfiguration,
  FundingRequest,
  ModifyOrderRequest,
  OrderCounts,
  OpenAccountRequest,
  OrderSide,
  PlaceOrderRequest,
  SaveProfileRequest,
  SignInResult,
  SetFavoriteRequest,
  SwitchAccountRequest,
  TransferRequest,
  WithdrawalOtpRequest,
  LiveQuote,
  TradingEvent,
} from './contract'
export {
  BackendError,
  mutationFailureMessage,
  userMessageFor,
  type BackendErrorKind,
} from './errors'
export { DENIED_ENDPOINTS, type Phase } from './endpoints'
export type { BackendConfig } from './gate'
export { createMockBackend } from './mock-backend'
export { createLiveBackend } from './live-backend'
export * as Money from './decimal'

/** The WaveXOne servers the app talks to (API reference, "Base URL"). */
export const WAVEX_TRADING_URL = 'https://trade.wavexone.com'
export const WAVEX_PORTAL_URL = 'https://trade.wavexone.com/client-portal'
export const WAVEX_PORTAL_ORIGIN = 'https://trade.wavexone.com'

/**
 * Picks an implementation.
 *
 * The real WaveXOne API is the default, so signing in always shows the
 * signed-in user's own data. The fixture backend is only used when asked for
 * explicitly with `EXPO_PUBLIC_WAVEX_BACKEND=mock` (design review, demos).
 * The `EXPO_PUBLIC_WAVEX_*_URL` values can still point the app elsewhere.
 */
export function createBackend(): WaveXBackend {
  if (process.env.EXPO_PUBLIC_WAVEX_BACKEND === 'mock') return createMockBackend()
  return createLiveBackend(configFromEnvironment())
}

function configFromEnvironment(): BackendConfig {
  const portalBaseUrl = process.env.EXPO_PUBLIC_WAVEX_PORTAL_URL || WAVEX_PORTAL_URL
  return {
    tradingBaseUrl: process.env.EXPO_PUBLIC_WAVEX_TRADING_URL || WAVEX_TRADING_URL,
    portalBaseUrl,
    portalOrigin: process.env.EXPO_PUBLIC_WAVEX_PORTAL_ORIGIN || WAVEX_PORTAL_ORIGIN,
    chartingBaseUrl: process.env.EXPO_PUBLIC_WAVEX_CHARTING_URL || portalBaseUrl,
    phase: readPhase(),
    timeoutMs: DEFAULT_TIMEOUT_MS,
  }
}

/**
 * Phase 3 — sign-in, reads, trading and funding — unless the environment
 * selects a different delivery phase.
 */
function readPhase(): Phase {
  const raw = Number(process.env.EXPO_PUBLIC_WAVEX_PHASE || '3')
  return raw === 1 || raw === 2 || raw === 4 ? raw : 3
}
