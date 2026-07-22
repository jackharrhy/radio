import type * as http from 'node:http'

import { WebSocketServer, type WebSocket } from 'ws'

import { parseClientMessage, epochNow } from './protocol.ts'
import { radioSpace, type RadioSocket } from './radio-space.ts'

interface AttachedSocket extends WebSocket {
  radioClientId?: string
}

export function attachRadioWebSocketServer(server: http.Server): WebSocketServer {
  let wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (request, socket, head) => {
    let url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
    if (url.pathname !== '/ws') return

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)
    })
  })

  wss.on('connection', (socket: AttachedSocket) => {
    socket.on('message', (raw) => {
      let t1 = epochNow()
      let parsedJson: unknown
      try {
        parsedJson = JSON.parse(raw.toString())
      } catch {
        socket.send(JSON.stringify({ type: 'ERROR', message: 'Invalid JSON' }))
        return
      }

      let message = parseClientMessage(parsedJson)
      if (!message) {
        socket.send(JSON.stringify({ type: 'ERROR', message: 'Invalid message' }))
        return
      }

      if (socket.radioClientId) radioSpace.markSeen(socket.radioClientId)

      if (message.type === 'JOIN') {
        socket.radioClientId = message.clientId
        radioSpace.connect(wrapSocket(socket), { clientId: message.clientId, name: message.name })
        return
      }

      let clientId = socket.radioClientId
      if (!clientId) {
        socket.send(JSON.stringify({ type: 'ERROR', message: 'Join before sending commands' }))
        return
      }

      if (message.type === 'NTP_REQUEST') {
        radioSpace.processNtp(clientId, message)
        socket.send(
          JSON.stringify({
            type: 'NTP_RESPONSE',
            t0: message.t0,
            t1,
            t2: epochNow(),
            probeGroupId: message.probeGroupId,
            probeGroupIndex: message.probeGroupIndex,
          }),
        )
        return
      }

      switch (message.type) {
        case 'TRACK_READY':
          radioSpace.markTrackReady(clientId, message.trackId)
          break
        case 'PLAY':
          radioSpace.requestPlay(clientId, message.trackId, message.trackTimeSeconds)
          break
        case 'PAUSE':
          void radioSpace.requestPause(message.trackId, message.trackTimeSeconds)
          break
        case 'SET_VOLUME':
          void radioSpace.setVolume(message.volume)
          break
        case 'REMOVE_TRACK':
          void radioSpace.removeTrack(message.trackId)
          break
        case 'REORDER_TRACKS':
          void radioSpace.reorderTracks(message.trackIds)
          break
        case 'LIVENESS_PONG':
          radioSpace.markSeen(clientId)
          break
      }
    })

    socket.on('close', () => {
      if (socket.radioClientId) radioSpace.disconnect(socket.radioClientId)
    })
  })

  return wss
}

function wrapSocket(socket: WebSocket): RadioSocket {
  return {
    get readyState() {
      return socket.readyState
    },
    send(data) {
      if (socket.readyState === socket.OPEN) socket.send(data)
    },
    close() {
      socket.close()
    },
    terminate() {
      socket.terminate()
    },
  }
}
