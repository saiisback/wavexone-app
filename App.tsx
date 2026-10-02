import './src/design-system/fonts.css'

import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { BackendProvider } from './src/backend/provider'
import { SignedInDataBootstrap } from './src/backend/data-bootstrap'
import { SessionProvider, useAppSession } from './src/backend/session-provider'
import { ActionMenuProvider, Gutter, Screen, Text } from './src/design-system'
import { RootNavigator } from './src/navigation/root-navigator'
import { SignInScreen } from './src/screens/sign-in-screen'

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {/*
         * One backend for the whole app. The duplicate-submission memo lives
         * on the instance, so a second one would let a mutation run twice.
         */}
        <BackendProvider>
          <SessionProvider>
            <ActionMenuProvider>
              <SessionGate />
            </ActionMenuProvider>
          </SessionProvider>
        </BackendProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

function SessionGate() {
  const { state } = useAppSession()

  if (state === 'restoring') {
    return (
      <Screen edges={['top', 'bottom']} style={styles.restoring}>
        <Gutter>
          <Text variant="strong">Restoring your secure session…</Text>
        </Gutter>
      </Screen>
    )
  }

  return state === 'signed-in' ? (
    <>
      <SignedInDataBootstrap />
      <RootNavigator />
    </>
  ) : (
    <SignInScreen />
  )
}

const styles = {
  root: { flex: 1 },
  restoring: { justifyContent: 'center' },
} as const
