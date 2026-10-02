import { useAccountData } from '../features/accounts/use-account-data'
import { useMarketData } from '../features/markets/use-market-data'
import { useSession } from '../data/store'

/**
 * Starts the read-only data needed throughout the signed-in app once, while
 * the provider-level query cache shares the results with whichever screen is
 * visible. Account data must resolve first because market reads are scoped to
 * the active trading account.
 */
export function SignedInDataBootstrap() {
  useAccountData()
  const accountId = useSession((state) => state.accountId)
  return accountId ? <MarketDataBootstrap accountId={accountId} /> : null
}

function MarketDataBootstrap({ accountId }: { accountId: string }) {
  useMarketData(accountId)
  return null
}
