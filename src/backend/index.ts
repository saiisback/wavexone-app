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
  OrderSide,
  PlaceOrderRequest,
  SignInResult,
  SetFavoriteRequest,
  SwitchAccountRequest,
  TransferRequest,
  WithdrawalOtpRequest,
} from './contract'
export { BackendError, userMessageFor, type BackendErrorKind } from './errors'
export { DENIED_ENDPOINTS, type Phase } from './endpoints'
export type { BackendConfig } from './gate'
export { createMockBackend } from './mock-backend'
export { createLiveBackend } from './live-backend'
export * as Money from './decimal'

/**
 * Picks an implementation from the environment.
 *
 * The default is the fixture backend, and deliberately so: guide §2 says
 * "Production trading and real-money funding must remain disabled until
 * mutation testing is authorized", and a build that reaches the real API by
 * accident is the way that goes wrong. Pointing at the live API takes three
 * explicit `EXPO_PUBLIC_` values.
 */
export function createBackend(): WaveXBackend {
  const config = configFromEnvironment()
  return config ? createLiveBackend(config) : createMockBackend()
}

function configFromEnvironment(): BackendConfig | null {
  const tradingBaseUrl = process.env.EXPO_PUBLIC_WAVEX_TRADING_URL
  const portalBaseUrl = process.env.EXPO_PUBLIC_WAVEX_PORTAL_URL
  const portalOrigin = process.env.EXPO_PUBLIC_WAVEX_PORTAL_ORIGIN

  if (!tradingBaseUrl || !portalBaseUrl || !portalOrigin) return null

  return {
    tradingBaseUrl,
    portalBaseUrl,
    portalOrigin,
    chartingBaseUrl: process.env.EXPO_PUBLIC_WAVEX_CHARTING_URL ?? portalBaseUrl,
    phase: readPhase(),
    timeoutMs: DEFAULT_TIMEOUT_MS,
  }
}

function readPhase(): Phase {
  const raw = Number(process.env.EXPO_PUBLIC_WAVEX_PHASE ?? '1')
  return raw === 2 || raw === 3 || raw === 4 ? raw : 1
}
