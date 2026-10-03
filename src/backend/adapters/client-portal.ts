import { BackendError } from '../errors'
import type { Gate } from '../gate'
import { logBackendEvent } from '../redact'
import {
  parseFundingConfiguration,
  parseNotifications,
  parsePortalBootstrap,
  type PortalBootstrap,
} from '../responses/portal'
import type { SessionMaterial } from '../secure-session-store'
import type { WithdrawalOtpRequest } from '../contract'

/**
 * The Client Portal — cookie-backed, and a separate session from the trading
 * API even though both hang off the same account token (guide §3.2).
 *
 * The cookie itself is never touched by this code. On iOS and Android the
 * platform HTTP stack owns the jar; on web the browser does. Reading it into
 * JS would mean storing it, which guide §3.3 rules out.
 */
export class ClientPortalAdapter {
  /** Whether `setPortalSession` has succeeded since the app started. */
  private established = false

  constructor(private readonly gate: Gate) {}

  /**
   * Guide §3.2 steps 1–3. Idempotent from the caller's point of view: calling
   * it twice is harmless, and everything that needs the portal calls it first.
   */
  async establish(material: SessionMaterial): Promise<void> {
    if (this.established) return

    await this.gate.call('setPortalSession', {
      body: { token: material.accountToken },
    })
    this.established = true
    logBackendEvent('portal.session-established')
  }

  /**
   * Guide §3.2 step 5: re-establish after cookie expiry or an authorized 401.
   *
   * Only wraps reads. A mutation that 401s is *not* replayed here — guide
   * §4.5 forbids replaying mutations, and a withdrawal that failed on auth
   * may still have been recorded.
   */
  async read<T>(material: SessionMaterial, call: () => Promise<T>): Promise<T> {
    await this.establish(material)
    try {
      return await call()
    } catch (error) {
      if (!(error instanceof BackendError) || error.kind !== 'auth') throw error

      logBackendEvent('portal.session-expired')
      this.established = false
      await this.establish(material)
      return call()
    }
  }

  async readBootstrap(material: SessionMaterial): Promise<PortalBootstrap> {
    return this.read(material, async () => {
      const response = await this.gate.call('bootstrap')
      try {
        return parsePortalBootstrap(response.json)
      } catch (cause) {
        throw new BackendError('malformed', 'Portal bootstrap returned an unexpected shape.', {
          endpoint: 'bootstrap',
          cause,
        })
      }
    })
  }

  async fundingConfiguration(material: SessionMaterial, accountId: string) {
    return this.read(material, async () => {
      const response = await this.gate.call('redeemConfig', { query: { accountToken: accountId } })
      try {
        return parseFundingConfiguration(response.json)
      } catch (cause) {
        // An empty method list lands here too, so the account sees reviewed
        // copy rather than the generic fallback.
        throw new BackendError('malformed', 'Funding configuration returned an unexpected shape.', {
          endpoint: 'redeemConfig',
          cause,
        })
      }
    })
  }

  async notifications(material: SessionMaterial) {
    return this.read(material, async () => {
      const response = await this.gate.call('notifications')
      return parseNotifications(response.json)
    })
  }

  async markNotificationsRead(
    material: SessionMaterial,
    request: { ids: readonly string[]; idempotencyKey: string },
  ) {
    await this.establish(material)
    await this.gate.call('markNotificationsRead', {
      body: { ids: request.ids },
      idempotencyKey: request.idempotencyKey,
    })
  }

  /**
   * Virtual funds for a demo account. The route takes only an amount and
   * credits the account the portal session currently has selected, so the
   * caller must have checked that the target is that account.
   */
  async demoDeposit(material: SessionMaterial, request: { amount: string; idempotencyKey: string }) {
    await this.establish(material)
    const response = await this.gate.call('submitDemoDeposit', {
      body: { deposit_amount: request.amount },
      idempotencyKey: request.idempotencyKey,
    })
    assertPortalAcknowledged(response.json, 'submitDemoDeposit')
  }

  /** `name` is resent unchanged; the route has no way to update one field alone. */
  async saveProfile(
    material: SessionMaterial,
    request: { name?: string; mobile: string; idempotencyKey: string },
  ) {
    await this.establish(material)
    const response = await this.gate.call('saveProfile', {
      body: {
        ...(request.name === undefined ? {} : { name: request.name }),
        mobile: request.mobile,
      },
      idempotencyKey: request.idempotencyKey,
    })
    assertPortalAcknowledged(response.json, 'saveProfile')
  }

  /** The collection sends both routes with an empty body. */
  async openAccount(
    material: SessionMaterial,
    request: { kind: 'demo' | 'live'; idempotencyKey: string },
  ) {
    await this.establish(material)
    const endpoint = request.kind === 'demo' ? 'createDemoAccount' : 'requestAccountCreation'
    const response = await this.gate.call(endpoint, {
      body: {},
      idempotencyKey: request.idempotencyKey,
    })
    assertPortalAcknowledged(response.json, endpoint)
  }

  async sendWithdrawalOtp(material: SessionMaterial, request: WithdrawalOtpRequest) {
    await this.establish(material)
    const response = await this.gate.call('sendWithdrawOtp', {
      body: {
        sourceId: request.accountId,
        amount: request.amount,
        withdrawAddress: withdrawAddressFor(request.details),
      },
      idempotencyKey: request.idempotencyKey,
    })
    assertPortalAcknowledged(response.json, 'sendWithdrawOtp')
  }

  /**
   * Guide §3.2 step 4. Sent when acting on a sibling account rather than the
   * one the portal session defaulted to.
   */
  headers(portalToken?: string): Record<string, string> {
    return portalToken ? { 'X-Portal-Token': portalToken } : {}
  }

  /** Called on sign-out so the next user does not inherit a session. */
  reset(): void {
    this.established = false
  }
}

/**
 * One encoding for both withdrawal routes. If the OTP and the submission
 * described the destination differently, the OTP would be for an address the
 * withdrawal never names.
 */
function withdrawAddressFor(details: Readonly<Record<string, string>> | undefined): string {
  return JSON.stringify(details ?? {})
}

function assertPortalAcknowledged(input: unknown, endpoint: string): void {
  if (
    typeof input !== 'object' ||
    input === null ||
    String((input as Record<string, unknown>).status).toLowerCase() !== 'success'
  ) {
    throw new BackendError('malformed', 'The portal did not acknowledge the mutation.', {
      endpoint,
    })
  }
}
