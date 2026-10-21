// Diagnostics are dev-only by design (see src/backend/redact.ts). Tests run
// with them off so a failure report shows the failure, not the request log.
global.__DEV__ = false

// No test reaches the network. A socket here never opens; a test that needs
// one replaces `global.WebSocket` with `tests/backend/fixtures/fake-socket`.
global.WebSocket = class OfflineWebSocket {
  constructor(url) {
    this.url = url
    this.readyState = 0
  }
  send() {}
  close() {
    this.readyState = 3
  }
}

// The real WebView is a native TurboModule. Screen tests exercise our chart
// wrapper and bridge while this host view stands in for the unavailable iOS /
// Android view manager.
jest.mock('react-native-webview', () => {
  const React = require('react')
  const { View } = require('react-native')
  const WebView = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ injectJavaScript: jest.fn() }))
    return React.createElement(View, props)
  })
  WebView.displayName = 'WebView'
  return { WebView }
})
