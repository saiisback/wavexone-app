import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native'
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
} from '@react-navigation/native-stack'

import { fonts, useColors, useTheme, type Palette } from '../design-system'
import { AccountSwitcherScreen } from '../screens/account-switcher-screen'
import { EditPhoneScreen } from '../screens/edit-phone-screen'
import { FundingScreen } from '../screens/funding-screen'
import { InstrumentPickerScreen } from '../screens/instrument-picker-screen'
import { InstrumentScreen } from '../screens/instrument-screen'
import { ModifyOrderScreen } from '../screens/modify-order-screen'
import { OrderTicketScreen } from '../screens/order-ticket-screen'
import { TabNavigator } from './tab-navigator'
import type { RootStackParamList } from './types'

const Stack = createNativeStackNavigator<RootStackParamList>()

/**
 * Native stack throughout. Every screen draws its own header, so the native
 * one is disabled rather than replaced with a JS `header` component.
 *
 * The sheet routes use the platform's form-sheet presentation, so
 * swipe-to-dismiss, the dimmed backdrop and keyboard avoidance are native
 * rather than reimplemented in JS.
 */
/** Mounted only after `SessionProvider` has established both backend sessions. */
export function RootNavigator() {
  const colors = useColors()
  const { scheme } = useTheme()
  const contentStyle = { backgroundColor: colors.bg }
  const navigationTheme = makeNavigationTheme(colors, scheme === 'dark')
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle }}>
        <Stack.Screen name="Tabs" component={TabNavigator} />
        <Stack.Screen name="Instrument" component={InstrumentScreen} />

        <Stack.Group screenOptions={{ ...SHEET_OPTIONS, contentStyle }}>
          <Stack.Screen name="Funding" component={FundingScreen} />
          <Stack.Screen name="OrderTicket" component={OrderTicketScreen} />
          <Stack.Screen name="ModifyOrder" component={ModifyOrderScreen} />
          <Stack.Screen name="EditPhone" component={EditPhoneScreen} />
          <Stack.Screen name="AccountSwitcher" component={AccountSwitcherScreen} />
          <Stack.Screen name="InstrumentPicker" component={InstrumentPickerScreen} />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  )
}

const SHEET_OPTIONS: NativeStackNavigationOptions = {
  presentation: 'formSheet',
  // Fixed detents rather than `fitToContents`: the sheets scroll, so they
  // have no intrinsic height for the platform to measure.
  sheetAllowedDetents: [0.72, 0.96],
  sheetCornerRadius: 28,
  sheetGrabberVisible: true,
}

const makeNavigationTheme = (colors: Palette, dark: boolean): Theme => ({
  ...DefaultTheme,
  dark,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    primary: colors.brand,
    border: colors.border,
  },
  fonts: {
    regular: { fontFamily: fonts.regular, fontWeight: '400' },
    medium: { fontFamily: fonts.medium, fontWeight: '500' },
    bold: { fontFamily: fonts.bold, fontWeight: '700' },
    heavy: { fontFamily: fonts.extrabold, fontWeight: '800' },
  },
})
