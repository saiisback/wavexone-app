import { useEffect } from 'react'

import { useBackendQuery, type QueryState } from '../../backend/provider'
import { useSession } from '../../data/store'
import { hasAccountSummary, type Account, type DetailedAccount, type Profile } from '../../data/types'

export type AccountData = {
  accounts: readonly Account[]
  /** Selected identity remains available even before its portal summary arrives. */
  selectedAccount: Account | null
  account: DetailedAccount | null
  profile: Profile
}

export function useAccountData(): QueryState<AccountData> {
  const accountId = useSession((state) => state.accountId)
  const selectAccount = useSession((state) => state.selectAccount)
  const accounts = useBackendQuery(`accounts:${accountId ?? 'initial'}`, (backend) =>
    backend.accounts.list(),
  )
  const profile = useBackendQuery(`profile:${accountId ?? 'initial'}`, (backend) =>
    backend.accounts.profile(),
  )

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

  const selectedAccount = accounts.data.find((account) => account.id === accountId) ?? null

  return {
    status: 'ready',
    data: {
      accounts: accounts.data,
      selectedAccount,
      account: selectedAccount && hasAccountSummary(selectedAccount) ? selectedAccount : null,
      profile: profile.data,
    },
  }
}
