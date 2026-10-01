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
          title="Trading signals unavailable"
          message="WaveXOne has not supplied a confirmed signals endpoint. No fixture or generated signal is shown in a live session."
        />
      </Gutter>
    </Screen>
  )
}

const styles = StyleSheet.create({ content: { paddingTop: 16 } })
