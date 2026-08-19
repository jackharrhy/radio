import * as fs from "node:fs/promises";

import type { Track } from "./protocol.ts";
import { RadioSpace, radioSpace } from "./radio-space.ts";
import {
  createPendingTrack,
  maxUploadSizeBytes,
  trackFilePath,
  trackPartPath,
  uploadsDir,
} from "./track-files.ts";

const progressIntervalBytes = 512 * 1024;
const progressIntervalMs = 100;

interface AudioStoreOptions {
  space?: RadioSpace;
  uploadDirectory?: string;
}

export class AudioStore {
  private readonly space: RadioSpace;
  private readonly uploadDirectory: string;
  private readonly activeTrackIds = new Set<string>();

  constructor(options: AudioStoreOptions = {}) {
    this.space = options.space ?? radioSpace;
    this.uploadDirectory = options.uploadDirectory ?? uploadsDir;
  }

  async begin(input: { name: string; mediaType: string; sizeBytes: number }): Promise<Track> {
    let track = createPendingTrack(input);
    await fs.mkdir(this.uploadDirectory, { recursive: true });

    let reservation = await fs.open(trackPartPath(track, this.uploadDirectory), "wx");
    await reservation.close();

    try {
      await this.space.addTrack(track);
      return track;
    } catch (error) {
      await fs.rm(trackPartPath(track, this.uploadDirectory), { force: true });
      throw error;
    }
  }

  async write(trackId: string, request: Request): Promise<Track> {
    if (this.activeTrackIds.has(trackId)) throw new Error("Upload is already in progress");
    this.activeTrackIds.add(trackId);
    try {
      return await this.writeActive(trackId, request);
    } finally {
      this.activeTrackIds.delete(trackId);
    }
  }

  private async writeActive(trackId: string, request: Request): Promise<Track> {
    let track = this.space.getTrack(trackId);
    if (!track?.upload || track.upload.status !== "uploading") {
      throw new Error("Upload no longer exists");
    }
    if (!request.body) throw new Error("Missing track file");

    let contentLengthHeader = request.headers.get("content-length");
    let contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
    if (
      contentLength !== null &&
      Number.isFinite(contentLength) &&
      (contentLength > maxUploadSizeBytes || contentLength > track.upload.sizeBytes)
    ) {
      throw new Error("File is too large");
    }

    let file = await fs.open(trackPartPath(track, this.uploadDirectory), "w");
    let bytesReceived = 0;
    let lastReportedBytes = 0;
    let lastReportedAt = performance.now();
    let movedIntoPlace = false;

    try {
      await request.body.pipeTo(
        new WritableStream<Uint8Array>({
          write: async (chunk) => {
            bytesReceived += chunk.byteLength;
            if (bytesReceived > track.upload!.sizeBytes || bytesReceived > maxUploadSizeBytes) {
              throw new Error("File is too large");
            }
            await file.writeFile(chunk);

            let now = performance.now();
            if (
              bytesReceived - lastReportedBytes >= progressIntervalBytes &&
              now - lastReportedAt >= progressIntervalMs
            ) {
              this.space.reportTrackUploadProgress(track.id, bytesReceived);
              lastReportedBytes = bytesReceived;
              lastReportedAt = now;
            }
          },
        }),
      );

      if (bytesReceived !== track.upload.sizeBytes) {
        throw new Error("Upload size did not match the selected file");
      }

      this.space.reportTrackUploadProgress(track.id, bytesReceived);
      await file.sync();
      await file.close();
      await fs.rename(
        trackPartPath(track, this.uploadDirectory),
        trackFilePath(track, this.uploadDirectory),
      );
      movedIntoPlace = true;

      let completedTrack = await this.space.completeTrackUpload(track.id);
      if (!completedTrack) throw new Error("Upload no longer exists");
      return completedTrack;
    } catch (error) {
      await file.close().catch(() => {});
      await fs.rm(trackPartPath(track, this.uploadDirectory), { force: true });
      if (movedIntoPlace) {
        await fs.rm(trackFilePath(track, this.uploadDirectory), { force: true });
      }
      await this.space.failTrackUpload(track.id).catch(() => {});
      throw error;
    }
  }
}

const audioStore = new AudioStore();

export function beginUploadedTrack(input: {
  name: string;
  mediaType: string;
  sizeBytes: number;
}): Promise<Track> {
  return audioStore.begin(input);
}

export function writeUploadedTrack(trackId: string, request: Request): Promise<Track> {
  return audioStore.write(trackId, request);
}
