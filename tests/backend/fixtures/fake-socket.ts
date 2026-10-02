/** A scriptable stand-in for `WebSocket`: the test decides when it opens and what arrives. */
export class FakeSocket {
  static instances: FakeSocket[] = []

  readyState = 0
  sent: unknown[] = []
  onopen: ((event: unknown) => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: ((event: unknown) => void) | null = null
  onerror: ((event: unknown) => void) | null = null

  constructor(readonly url: string) {
    FakeSocket.instances.push(this)
  }

  static latest(): FakeSocket {
    const socket = FakeSocket.instances.at(-1)
    if (!socket) throw new Error('No socket was opened')
    return socket
  }

  send(data: string) {
    this.sent.push(JSON.parse(data))
  }

  close() {
    this.readyState = 3
  }

  open() {
    this.readyState = 1
    this.onopen?.({})
  }

  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) })
  }

  drop() {
    this.readyState = 3
    this.onclose?.({})
  }
}

export const createFakeSocket = (url: string) => new FakeSocket(url) as unknown as WebSocket
