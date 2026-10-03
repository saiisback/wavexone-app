import { formatPrice } from '../../data/format'
import type { Account } from '../../data/types'
import { Button, ButtonText } from '../../design-system'
import { useAppNavigation } from '../../navigation/use-app-navigation'
import { UnavailableState } from '../shared/query-state'

/** Keep the selected identity visible without borrowing another account's summary. */
export function AccountSummaryUnavailable({ account }: { account: Account | null }) {
  const { openAccountSwitcher } = useAppNavigation()
  return (
    <>
      <UnavailableState
        title={account ? 'Account summary unavailable' : 'No trading account'}
        message={account
          ? `${account.mode} · ${account.number}. Linked balance ${formatPrice(account.balance, 2)}. Full account details are not available yet. Select this account again to refresh its details, or choose another account.`
          : 'Choose an account to continue.'}
      />
      <Button tone="track" onPress={openAccountSwitcher}>
        <ButtonText tone="track">Switch account</ButtonText>
      </Button>
    </>
  )
}
