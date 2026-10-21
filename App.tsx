import './src/design-system/fonts.css'

import { useFonts } from 'expo-font'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { BackendProvider } from './src/backend/provider'
import { SignedInDataBootstrap } from './src/backend/data-bootstrap'
import { SessionProvider, useAppSession } from './src/backend/session-provider'
import { ActionMenuProvider, BrandSplash, ThemeProvider, useTheme, Text, useColors } from './src/design-system'
import { RootNavigator } from './src/navigation/root-navigator'
import { SignInScreen } from './src/screens/sign-in-screen'

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        {/*
         * One backend for the whole app. The duplicate-submission memo lives
         * on the instance, so a second one would let a mutation run twice.
         */}
        <BackendProvider>
          <SessionProvider>
            <ThemeProvider>
              <AppAppearance />
              <ActionMenuProvider>
                <SessionGate />
              </ActionMenuProvider>
            </ThemeProvider>
          </SessionProvider>
        </BackendProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

function AppAppearance() {
  const { scheme, error } = useTheme()
  const colors = useColors()
  return <>
    <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    {error ? <Text accessibilityRole="alert" style={{ backgroundColor: colors.surface, color: colors.red, padding: 16 }}>{error}</Text> : null}
  </>
}

/**
 * Inter, registered under the family names `tokens.ts` uses. A native build
 * embeds these at build time through the expo-font config plugin; Expo Go
 * skips config plugins, so without this it falls back to the system font.
 * Loading them again in a native build is quick and harmless.
 */
const INTER = {
  Inter_400Regular: require('./assets/fonts/Inter_400Regular.ttf'),
  Inter_500Medium: require('./assets/fonts/Inter_500Medium.ttf'),
  Inter_600SemiBold: require('./assets/fonts/Inter_600SemiBold.ttf'),
  Inter_700Bold: require('./assets/fonts/Inter_700Bold.ttf'),
  Inter_800ExtraBold: require('./assets/fonts/Inter_800ExtraBold.ttf'),
}

function SessionGate() {
  const { state } = useAppSession()
  const [fontsLoaded, fontError] = useFonts(INTER)

  // A failed font load is not fatal: carry on with the system font.
  if (state === 'restoring' || (!fontsLoaded && !fontError)) {
    return <BrandSplash message="Restoring your secure session…" />
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
} as const
