import { StyleSheet } from 'react-native'

import { Gutter, Screen } from '../design-system'
import { UnavailableState } from '../features/shared/query-state'
import { ScreenHeader } from '../features/shared/screen-header'

/** No confirmed backend endpoint currently supplies trading signals. */
export function SignalsScreen() {
  return (
    <Screen>
      <ScreenHeader title="Trading Signals" />
      <Gutter style={styles.content}>
        <UnavailableState
          title="Trading signals are coming soon"
          message="Signals will appear here as soon as they are available for your account."
        />
      </Gutter>
    </Screen>
  )
}

const styles = StyleSheet.create({ content: { paddingTop: 16 } })
