import { setTimeout as delay } from 'node:timers/promises'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { ROOM_ID, type ServerMessage, type Track } from './protocol.ts'
import { RadioSpace, type RadioSocket } from './radio-space.ts'

interface MockSocket extends RadioSocket {
  sent: ServerMessage[]
  terminated: number
}

function createSocket(): MockSocket {
  return {
    readyState: 1,
    sent: [],
    terminated: 0,
    send(data) {
      this.sent.push(JSON.parse(data) as ServerMessage)
    },
    close() {
      this.readyState = 3
    },
    terminate() {
      this.terminated++
      this.readyState = 3
    },
  }
}

function createRoom(options: ConstructorParameters<typeof RadioSpace>[0] = {}): RadioSpace {
  return new RadioSpace({ persist: false, ...options })
}

function track(id = 'track-1'): Track {
  return {
    id,
    title: `Track ${id}`,
    url: `/uploads/${id}.mp3`,
    addedAt: 1,
  }
}

function messagesOf<Type extends ServerMessage['type']>(socket: MockSocket, type: Type): Extract<ServerMessage, { type: Type }>[] {
  return socket.sent.filter((message): message is Extract<ServerMessage, { type: Type }> => message.type === type)
}

async function flushAsyncWork(): Promise<void> {
  await delay(0)
}

describe('RadioSpace queue and playback coordination', () => {
  it('sends room state on connect and broadcasts queue updates', async () => {
    let room = createRoom()
    let socket = createSocket()

    room.connect(socket, { clientId: 'client-1', name: 'Ada' })
    await room.addTrack(track())

    let roomState = messagesOf(socket, 'ROOM_STATE')[0]
    let queueUpdates = messagesOf(socket, 'QUEUE_UPDATED')

    assert.equal(roomState.snapshot.roomId, ROOM_ID)
    assert.equal(roomState.snapshot.clients[0]?.name, 'Ada')
    assert.equal(queueUpdates.at(-1)?.tracks[0]?.id, 'track-1')

    room.disconnect('client-1', socket)
  })

  it('broadcasts LOAD_TRACK and waits for all connected clients before scheduling play', async () => {
    let room = createRoom()
    let client1 = createSocket()
    let client2 = createSocket()
    let client3 = createSocket()

    room.connect(client1, { clientId: 'client-1', name: 'Ada' })
    room.connect(client2, { clientId: 'client-2', name: 'Linus' })
    room.connect(client3, { clientId: 'client-3', name: 'Grace' })
    await room.addTrack(track())
    client1.sent = []
    client2.sent = []
    client3.sent = []

    room.requestPlay('client-1', 'track-1', 42.5)
    assert.equal(messagesOf(client1, 'LOAD_TRACK').length, 1)
    assert.equal(messagesOf(client2, 'LOAD_TRACK').length, 1)
    assert.equal(messagesOf(client3, 'LOAD_TRACK').length, 1)
    assert.equal(messagesOf(client1, 'SCHEDULED_PLAY').length, 0)

    room.markTrackReady('client-2', 'track-1')
    await flushAsyncWork()
    assert.equal(messagesOf(client1, 'SCHEDULED_PLAY').length, 0)

    room.markTrackReady('client-3', 'track-1')
    await flushAsyncWork()

    let scheduled = messagesOf(client1, 'SCHEDULED_PLAY')
    assert.equal(scheduled.length, 1)
    assert.equal(scheduled[0].trackId, 'track-1')
    assert.equal(scheduled[0].trackTimeSeconds, 42.5)
    assert.equal(room.snapshot().playback.type, 'playing')
    assert.equal(room.snapshot().playback.trackId, 'track-1')

    room.disconnect('client-1', client1)
    room.disconnect('client-2', client2)
    room.disconnect('client-3', client3)
  })

  it('is idempotent when the same client reports a track ready more than once', async () => {
    let room = createRoom()
    let client1 = createSocket()
    let client2 = createSocket()

    room.connect(client1, { clientId: 'client-1', name: 'Ada' })
    room.connect(client2, { clientId: 'client-2', name: 'Linus' })
    await room.addTrack(track())
    client1.sent = []

    room.requestPlay('client-1', 'track-1', 0)
    room.markTrackReady('client-2', 'track-1')
    await flushAsyncWork()
    room.markTrackReady('client-2', 'track-1')
    await flushAsyncWork()

    assert.equal(messagesOf(client1, 'SCHEDULED_PLAY').length, 1)

    room.disconnect('client-1', client1)
    room.disconnect('client-2', client2)
  })

  it('does not schedule play after a pending track is removed', async () => {
    let room = createRoom()
    let client1 = createSocket()
    let client2 = createSocket()

    room.connect(client1, { clientId: 'client-1', name: 'Ada' })
    room.connect(client2, { clientId: 'client-2', name: 'Linus' })
    await room.addTrack(track())
    client1.sent = []

    room.requestPlay('client-1', 'track-1', 0)
    await room.removeTrack('track-1')
    room.markTrackReady('client-2', 'track-1')
    await flushAsyncWork()

    assert.equal(messagesOf(client1, 'SCHEDULED_PLAY').length, 0)
    assert.equal(room.snapshot().playback.type, 'paused')

    room.disconnect('client-1', client1)
    room.disconnect('client-2', client2)
  })

  it('keeps a replacement connection when the previous socket closes', () => {
    let room = createRoom()
    let previousSocket = createSocket()
    let replacementSocket = createSocket()

    room.connect(previousSocket, { clientId: 'client-1', name: 'Ada' })
    room.connect(replacementSocket, { clientId: 'client-1', name: 'Grace' })
    room.disconnect('client-1', previousSocket)

    assert.equal(previousSocket.readyState, 3)
    assert.equal(room.snapshot().clients.length, 1)
    assert.equal(room.snapshot().clients[0]?.name, 'Grace')

    room.disconnect('client-1', replacementSocket)
  })
})

describe('RadioSpace liveness', () => {
  it('pings a silent client, keeps clients alive on pong, and reaps missed pongs', async () => {
    let room = createRoom({ livenessPingAfterMs: 15, livenessReapAfterMs: 80, heartbeatIntervalMs: 5 })
    let socket = createSocket()

    room.connect(socket, { clientId: 'client-1', name: 'Ada' })
    await delay(25)
    assert.ok(messagesOf(socket, 'LIVENESS_PING').length >= 1)

    room.markSeen('client-1')
    await delay(20)
    assert.equal(socket.terminated, 0)
    assert.equal(room.snapshot().clients.length, 1)

    await delay(90)
    assert.equal(socket.terminated, 1)
    assert.equal(room.snapshot().clients.length, 0)
  })
})
