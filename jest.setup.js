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
