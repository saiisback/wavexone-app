import { Linking } from 'react-native'

import { useActionMenu } from '../../design-system'

/**
 * The portal the app's own session is established against. Without live
 * configuration it falls back to the same host's `/client-portal`, which is
 * where the Postman environment puts it.
 */
export const CLIENT_PORTAL_URL =
  process.env.EXPO_PUBLIC_WAVEX_PORTAL_URL || 'https://trade.wavexone.com/client-portal'

/**
 * Hands a task the app has no endpoint for — API keys, password changes — to
 * the web portal, after saying that it leaves the app.
 */
export function useOpenClientPortal() {
  const showMenu = useActionMenu()

  return ({ title, reason }: { title: string; reason?: string }) =>
    showMenu({
      title,
      message: `${reason ? `${reason} ` : ''}This leaves the app and opens ${CLIENT_PORTAL_URL} in your browser.`,
      options: [
        {
          label: 'Open client portal',
          onSelect: () => {
            Linking.openURL(CLIENT_PORTAL_URL).catch(() => {
              showMenu({
                title: 'Could not open the portal',
                message: 'No browser is available to handle that link.',
                options: [{ label: 'Got it' }],
              })
            })
          },
        },
      ],
    })
}
