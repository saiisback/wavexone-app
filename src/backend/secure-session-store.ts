import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

/**
 * The only place session material is held.
 *
 * Guide §3.3:
 *  - platform secure storage for tokens and secret keys
 *  - never persist the password
 *  - clear everything on logout or account removal
 *
 * There is deliberately no `password` field anywhere in this file. The
 * password is a parameter to `signIn` and nothing else ever sees it.
 */

export type SessionMaterial = {
  /** Returned by `collect=check`. Identifies the trading account. */
  accountToken: string
  /**
   * Database id paired with `accountToken` by `collect=accountList`.
   * `create_fingerprint` requires this value as `account_id`; it is not the
   * trading token and linked demo accounts commonly use different values.
   */
  orderAccountId?: string
  /** Sent as the `Secretkey` header. */
  secretKey: string
  /**
   * Server session created by `collect=check`. The trading API calls this
   * `sid`; demo-account fingerprint registration needs it to bind the
   * selected account to the authenticated login session.
   */
  sessionId?: string
  /**
   * The whole body of `collect=bearer`, which is a raw token rather than
   * JSON (guide §3.1 step 4).
   */
  bearerToken: string
  /**
   * Stable per-install device identifier, sent to `check` and `bearer`.
   *
   * Not the same thing as the order `fingerprint` below, despite reading like
   * a synonym. This one is client-chosen, exists before authentication, and
   * is a short free-form label rather than the fingerprint's
   * `<hex>_<accountId>` form. The app generates a random UUID per install.
   */
  footprint: string
  /**
   * Server-issued, per-account, required by every order mutation
   * (`placeorder`, `squareoff`, `modify`, the bulk closes). Comes from
   * `collect=create_fingerprint&token=…&account_id=…` and must be treated as
   * an opaque value owned by the service.
   *
   * Absent until an order mutation needs one, which is why it is optional:
   * a phase-1 build never asks for it.
   */
  orderFingerprint?: string
  /** When the bearer was issued, so expiry can be reasoned about. */
  issuedAt: string
}

const KEY = 'wavex.session.v1'
const FOOTPRINT_KEY = 'wavex.footprint.v1'

/**
 * iOS has historically rejected keychain values over ~2KB. The bearer token
 * is an unknown length, so the store checks rather than failing at runtime in
 * front of a user.
 */
const MAX_VALUE_BYTES = 2048

export interface SessionStore {
  read(): Promise<SessionMaterial | null>
  write(material: SessionMaterial): Promise<void>
  clear(): Promise<void>
  /** Stable per-install identifier, created on first use. */
  footprint(): Promise<string>
}

/** Keychain / Keystore backed. The real implementation on device. */
class SecureSessionStore implements SessionStore {
  async read(): Promise<SessionMaterial | null> {
    const raw = await SecureStore.getItemAsync(KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as SessionMaterial
    } catch {
      // A value we cannot parse is a value we cannot trust. Drop it rather
      // than leaving a half-session that makes `restore` behave oddly.
      await this.clear()
      return null
    }
  }

  async write(material: SessionMaterial): Promise<void> {
    const raw = JSON.stringify(material)
    if (raw.length > MAX_VALUE_BYTES) {
      throw new Error(
        `Session material is ${raw.length} bytes, over the ${MAX_VALUE_BYTES}-byte keychain limit. ` +
          'Store the bearer token under its own key before shipping this.',
      )
    }
    await SecureStore.setItemAsync(KEY, raw, {
      // Survives a reboot but never leaves the device in an iCloud or iTunes
      // backup, and is unavailable while the device is locked.
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    })
  }

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(KEY)
  }

  async footprint(): Promise<string> {
    const existing = await SecureStore.getItemAsync(FOOTPRINT_KEY)
    if (existing) return existing

    // A random per-install value rather than a hardware identifier: it gives
    // the backend the stable footprint the auth flow needs without turning
    // into a cross-app tracking key.
    const created = Crypto.randomUUID()
    await SecureStore.setItemAsync(FOOTPRINT_KEY, created, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    })
    return created
  }
}

/**
 * Web fallback: memory only, cleared when the tab closes.
 *
 * `expo-secure-store` has no web implementation, and `localStorage` is
 * readable by any script on the origin — persisting a bearer token there
 * would break guide §3.3 while looking like it satisfied it. The app is run
 * on web for design review, so the honest behaviour is to work for one
 * session and forget.
 */
class MemorySessionStore implements SessionStore {
  private material: SessionMaterial | null = null
  private cachedFootprint: string | null = null

  async read() {
    return this.material
  }

  async write(material: SessionMaterial) {
    this.material = material
  }

  async clear() {
    this.material = null
  }

  async footprint() {
    this.cachedFootprint ??= Crypto.randomUUID()
    return this.cachedFootprint
  }
}

export function createSessionStore(): SessionStore {
  return Platform.OS === 'web' ? new MemorySessionStore() : new SecureSessionStore()
}
