import { useEffect } from 'react'

import { useBackend, useBackendQuery, type QueryState } from '../../backend/provider'
import { reconcileAccountEquity } from '../../backend/account-equity'
import { markPosition } from '../../data/live-quote'
import { useSession } from '../../data/store'
import { hasAccountSummary, type Account, type DetailedAccount, type Profile } from '../../data/types'
import { useLiveQuotesVersion } from '../markets/use-live-quote'

export type AccountData = {
  accounts: readonly Account[]
  /** Selected identity remains available even before its portal summary arrives. */
  selectedAccount: Account | null
  account: DetailedAccount | null
  profile: Profile
}

export function useAccountData(): QueryState<AccountData> {
  const backend = useBackend()
  const accountId = useSession((state) => state.accountId)
  const selectAccount = useSession((state) => state.selectAccount)
  const accounts = useBackendQuery(`accounts:${accountId ?? 'initial'}`, (backend) =>
    backend.accounts.list(),
  )
  const profile = useBackendQuery(`profile:${accountId ?? 'initial'}`, (backend) =>
    backend.accounts.profile(),
  )
  const positions = useBackendQuery(`positions:${accountId ?? 'none'}`, (backend) =>
    accountId ? backend.orders.list(accountId) : Promise.resolve([]),
  )
  const openInstrumentIds = positions.status === 'ready'
    ? positions.data.filter((position) => position.state === 'Open').map((position) => position.instrumentId)
    : []
  useLiveQuotesVersion(openInstrumentIds)

  useEffect(() => {
    if (accounts.status !== 'ready' || accounts.data.length === 0) return
    const selected = accounts.data.find((account) => account.id === accountId)
    if (!selected) {
      const fallback = accounts.data.find((account) => account.current) ?? accounts.data[0]
      if (fallback) selectAccount(fallback.id)
    }
  }, [accountId, accounts, selectAccount])

  if (accounts.status === 'error') return accounts
  if (profile.status === 'error') return profile
  if (accounts.status === 'loading' || profile.status === 'loading') return { status: 'loading' }

  const selectedSnapshot = accounts.data.find((account) => account.id === accountId) ?? null
  const valuedPositions = positions.status === 'ready'
    ? positions.data.map((position) => markPosition(
        position,
        undefined,
        backend.prices?.latest(position.instrumentId),
      ))
    : []
  const hasOpenPositions = positions.status === 'ready' && positions.data.some((position) => position.state === 'Open')
  const isFlatAccount = selectedSnapshot && hasAccountSummary(selectedSnapshot) && positions.status === 'ready'
    && positions.data.length === 0
    && Math.abs(selectedSnapshot.freeMargin - selectedSnapshot.balance) < 0.005
  const selectedAccount = selectedSnapshot && hasAccountSummary(selectedSnapshot) && (hasOpenPositions || isFlatAccount)
    ? { ...selectedSnapshot, ...reconcileAccountEquity({
        balance: selectedSnapshot.balance,
        // With no positions and no margin in use, the portal equity is the
        // stale field we are correcting; do not subtract it from free margin.
        portalEquity: isFlatAccount ? selectedSnapshot.balance : selectedSnapshot.equity,
        portalFreeMargin: selectedSnapshot.freeMargin,
        positions: valuedPositions,
      }) }
    : selectedSnapshot
  const reconciledAccounts = selectedAccount
    ? accounts.data.map((account) => account.id === selectedAccount.id ? selectedAccount : account)
    : accounts.data

  return {
    status: 'ready',
    refreshing: accounts.refreshing || profile.refreshing || (positions.status === 'ready' && positions.refreshing) || false,
    refreshError: accounts.refreshError ?? profile.refreshError ?? (positions.status === 'ready' ? positions.refreshError : undefined),
    retry: () => {
      if (accounts.refreshError) accounts.retry?.()
      if (profile.refreshError) profile.retry?.()
      if (positions.status === 'ready' && positions.refreshError) positions.retry?.()
    },
    data: {
      accounts: reconciledAccounts,
      selectedAccount,
      account: selectedAccount && hasAccountSummary(selectedAccount) ? selectedAccount : null,
      profile: profile.data,
    },
  }
}
