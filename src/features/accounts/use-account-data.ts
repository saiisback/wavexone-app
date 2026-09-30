import { useEffect } from 'react'

import { useBackendQuery, type QueryState } from '../../backend/provider'
import { useSession } from '../../data/store'
import type { Account, Profile } from '../../data/types'

export type AccountData = {
  accounts: readonly Account[]
  account: Account | null
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
    if (!accountId || !accounts.data.some((account) => account.id === accountId)) {
      selectAccount(accounts.data[0].id)
    }
  }, [accountId, accounts, selectAccount])

  if (accounts.status === 'error') return accounts
  if (profile.status === 'error') return profile
  if (accounts.status === 'loading' || profile.status === 'loading') return { status: 'loading' }

  return {
    status: 'ready',
    data: {
      accounts: accounts.data,
      account: accounts.data.find((account) => account.id === accountId) ?? accounts.data[0] ?? null,
      profile: profile.data,
    },
  }
}
