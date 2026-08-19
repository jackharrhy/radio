import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { ROOM_ID, type ServerMessage, type Track } from "./protocol.ts";
import { RadioSpace, type RadioSocket } from "./radio-space.ts";

interface MockSocket extends RadioSocket {
  sent: ServerMessage[];
  terminated: number;
}

function createSocket(): MockSocket {
  return {
    readyState: 1,
    sent: [],
    terminated: 0,
    send(data) {
      this.sent.push(JSON.parse(data) as ServerMessage);
    },
    close() {
      this.readyState = 3;
    },
    terminate() {
      this.terminated++;
      this.readyState = 3;
    },
  };
}

function createRoom(options: ConstructorParameters<typeof RadioSpace>[0] = {}): RadioSpace {
  return new RadioSpace({ persist: false, ...options });
}

function track(id = "track-1"): Track {
  return {
    id,
    title: `Track ${id}`,
    url: `/uploads/${id}.mp3`,
    addedAt: 1,
  };
}

function messagesOf<Type extends ServerMessage["type"]>(
  socket: MockSocket,
  type: Type,
): Extract<ServerMessage, { type: Type }>[] {
  return socket.sent.filter(
    (message): message is Extract<ServerMessage, { type: Type }> => message.type === type,
  );
}

async function flushAsyncWork(): Promise<void> {
  await delay(0);
}

describe("RadioSpace queue and playback coordination", () => {
  it("sends room state on connect and broadcasts queue updates", async () => {
    let room = createRoom();
    let socket = createSocket();

    room.connect(socket, { clientId: "client-1", name: "Ada" });
    await room.addTrack(track());

    let roomState = messagesOf(socket, "ROOM_STATE")[0];
    let queueUpdates = messagesOf(socket, "QUEUE_UPDATED");

    assert.equal(roomState.snapshot.roomId, ROOM_ID);
    assert.equal(roomState.snapshot.clients[0]?.name, "Ada");
    assert.equal(queueUpdates.at(-1)?.tracks[0]?.id, "track-1");

    room.disconnect("client-1", socket);
  });

  it("broadcasts LOAD_TRACK and waits for all connected clients before scheduling play", async () => {
    let room = createRoom();
    let client1 = createSocket();
    let client2 = createSocket();
    let client3 = createSocket();

    room.connect(client1, { clientId: "client-1", name: "Ada" });
    room.connect(client2, { clientId: "client-2", name: "Linus" });
    room.connect(client3, { clientId: "client-3", name: "Grace" });
    await room.addTrack(track());
    client1.sent = [];
    client2.sent = [];
    client3.sent = [];

    room.requestPlay("client-1", "track-1", 42.5);
    assert.equal(messagesOf(client1, "LOAD_TRACK").length, 1);
    assert.equal(messagesOf(client2, "LOAD_TRACK").length, 1);
    assert.equal(messagesOf(client3, "LOAD_TRACK").length, 1);
    assert.equal(messagesOf(client1, "SCHEDULED_PLAY").length, 0);
    assert.equal(messagesOf(client1, "TRACK_BUFFERING").at(-1)?.readyClientCount, 0);
    assert.equal(messagesOf(client1, "TRACK_BUFFERING").at(-1)?.totalClientCount, 3);

    room.markTrackReady("client-1", "track-1");
    await flushAsyncWork();
    assert.equal(messagesOf(client1, "SCHEDULED_PLAY").length, 0);

    room.markTrackReady("client-2", "track-1");
    await flushAsyncWork();
    assert.equal(messagesOf(client1, "SCHEDULED_PLAY").length, 0);

    room.markTrackReady("client-3", "track-1");
    await flushAsyncWork();

    let scheduled = messagesOf(client1, "SCHEDULED_PLAY");
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0].trackId, "track-1");
    assert.equal(scheduled[0].trackTimeSeconds, 42.5);
    assert.equal(room.snapshot().playback.type, "playing");
    assert.equal(room.snapshot().playback.trackId, "track-1");

    room.disconnect("client-1", client1);
    room.disconnect("client-2", client2);
    room.disconnect("client-3", client3);
  });

  it("is idempotent when the same client reports a track ready more than once", async () => {
    let room = createRoom();
    let client1 = createSocket();
    let client2 = createSocket();

    room.connect(client1, { clientId: "client-1", name: "Ada" });
    room.connect(client2, { clientId: "client-2", name: "Linus" });
    await room.addTrack(track());
    client1.sent = [];

    room.requestPlay("client-1", "track-1", 0);
    room.markTrackReady("client-1", "track-1");
    room.markTrackReady("client-2", "track-1");
    await flushAsyncWork();
    room.markTrackReady("client-2", "track-1");
    await flushAsyncWork();

    assert.equal(messagesOf(client1, "SCHEDULED_PLAY").length, 1);

    room.disconnect("client-1", client1);
    room.disconnect("client-2", client2);
  });

  it("does not schedule play after a pending track is removed", async () => {
    let room = createRoom();
    let client1 = createSocket();
    let client2 = createSocket();

    room.connect(client1, { clientId: "client-1", name: "Ada" });
    room.connect(client2, { clientId: "client-2", name: "Linus" });
    await room.addTrack(track());
    client1.sent = [];

    room.requestPlay("client-1", "track-1", 0);
    await room.removeTrack("track-1");
    room.markTrackReady("client-2", "track-1");
    await flushAsyncWork();

    assert.equal(messagesOf(client1, "SCHEDULED_PLAY").length, 0);
    assert.equal(room.snapshot().playback.type, "paused");

    room.disconnect("client-1", client1);
    room.disconnect("client-2", client2);
  });

  it("advances to the next playable track exactly once after a natural ending", async () => {
    let room = createRoom();
    let client1 = createSocket();
    let client2 = createSocket();

    room.connect(client1, { clientId: "client-1", name: "Ada" });
    room.connect(client2, { clientId: "client-2", name: "Linus" });
    await room.addTrack(track("track-1"));
    await room.addTrack(track("track-2"));

    room.requestPlay("client-1", "track-1", 0);
    room.markTrackReady("client-1", "track-1");
    room.markTrackReady("client-2", "track-1");
    await flushAsyncWork();
    client1.sent = [];

    await Promise.all([
      room.requestTrackEnded("client-1", "track-1", 120),
      room.requestTrackEnded("client-2", "track-1", 120),
    ]);

    assert.equal(messagesOf(client1, "LOAD_TRACK").length, 1);
    assert.equal(messagesOf(client1, "LOAD_TRACK")[0]?.track.id, "track-2");
    assert.equal(room.snapshot().playback.type, "paused");
    assert.equal(room.snapshot().playback.trackId, "track-1");

    room.markTrackReady("client-1", "track-2");
    room.markTrackReady("client-2", "track-2");
    await flushAsyncWork();

    assert.equal(messagesOf(client1, "SCHEDULED_PLAY").length, 1);
    assert.equal(messagesOf(client1, "SCHEDULED_PLAY")[0]?.trackId, "track-2");

    room.disconnect("client-1", client1);
    room.disconnect("client-2", client2);
  });

  it("stays paused at the end when there is no other playable track", async () => {
    let room = createRoom();
    let socket = createSocket();
    room.connect(socket, { clientId: "client-1", name: "Ada" });
    await room.addTrack(track());
    room.requestPlay("client-1", "track-1", 0);
    room.markTrackReady("client-1", "track-1");
    await flushAsyncWork();
    socket.sent = [];

    await room.requestTrackEnded("client-1", "track-1", 120);

    assert.equal(room.snapshot().playback.type, "paused");
    assert.equal(room.snapshot().playback.trackTimeSeconds, 120);
    assert.equal(messagesOf(socket, "LOAD_TRACK").length, 0);
    room.disconnect("client-1", socket);
  });

  it("renames both the queue entry and its file on disk", async () => {
    let uploadDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "radio-rename-"));
    let room = createRoom({ uploadDirectory });
    let socket = createSocket();
    let original = {
      ...track(),
      title: "Old title",
      url: "/uploads/track-1-Old-title.mp3",
    };

    try {
      room.connect(socket, { clientId: "client-1", name: "Ada" });
      await fs.writeFile(path.join(uploadDirectory, "track-1-Old-title.mp3"), "audio");
      await room.addTrack(original);
      room.requestPlay("client-1", original.id, 0);
      room.markTrackReady("client-1", original.id);
      await flushAsyncWork();
      socket.sent = [];

      await room.renameTrack("client-1", original.id, "New / title");

      let renamed = room.getTrack(original.id);
      assert.equal(renamed?.title, "New - title");
      assert.equal(renamed?.url, "/uploads/track-1-New-title.mp3");
      assert.equal(
        await fs.readFile(path.join(uploadDirectory, "track-1-New-title.mp3"), "utf8"),
        "audio",
      );
      assert.equal(
        await fs.access(path.join(uploadDirectory, "track-1-Old-title.mp3")).then(
          () => true,
          () => false,
        ),
        false,
      );
      assert.equal(messagesOf(socket, "QUEUE_UPDATED").at(-1)?.tracks[0]?.title, "New - title");
      assert.equal(messagesOf(socket, "LOAD_TRACK").at(-1)?.track.url, renamed?.url);
      assert.equal(messagesOf(socket, "SCHEDULED_PLAY").length, 0);

      room.markTrackReady("client-1", original.id);
      await flushAsyncWork();
      assert.equal(messagesOf(socket, "SCHEDULED_PLAY").length, 1);
    } finally {
      room.disconnect("client-1", socket);
      await fs.rm(uploadDirectory, { recursive: true, force: true });
    }
  });

  it("keeps a replacement connection when the previous socket closes", () => {
    let room = createRoom();
    let previousSocket = createSocket();
    let replacementSocket = createSocket();

    room.connect(previousSocket, { clientId: "client-1", name: "Ada" });
    room.connect(replacementSocket, { clientId: "client-1", name: "Grace" });
    room.disconnect("client-1", previousSocket);

    assert.equal(previousSocket.readyState, 3);
    assert.equal(room.snapshot().clients.length, 1);
    assert.equal(room.snapshot().clients[0]?.name, "Grace");

    room.disconnect("client-1", replacementSocket);
  });
});

describe("RadioSpace liveness", () => {
  it("pings a silent client, keeps clients alive on pong, and reaps missed pongs", async () => {
    let room = createRoom({
      livenessPingAfterMs: 15,
      livenessReapAfterMs: 80,
      heartbeatIntervalMs: 5,
    });
    let socket = createSocket();

    room.connect(socket, { clientId: "client-1", name: "Ada" });
    await delay(25);
    assert.ok(messagesOf(socket, "LIVENESS_PING").length >= 1);

    room.markSeen("client-1");
    await delay(20);
    assert.equal(socket.terminated, 0);
    assert.equal(room.snapshot().clients.length, 1);

    await delay(90);
    assert.equal(socket.terminated, 1);
    assert.equal(room.snapshot().clients.length, 0);
  });
});
