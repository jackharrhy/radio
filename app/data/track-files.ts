import { randomUUID } from "node:crypto";
import * as path from "node:path";

import type { Track } from "./protocol.ts";

export const uploadsDir = path.join(process.cwd(), "public", "uploads");
export const maxUploadSizeBytes = 1024 * 1024 * 1024;

const allowedAudioTypes = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/flac",
  "video/webm",
]);
const allowedAudioExtensions = new Set([
  ".aac",
  ".flac",
  ".m4a",
  ".mp3",
  ".mp4",
  ".oga",
  ".ogg",
  ".wav",
  ".webm",
]);

export function createPendingTrack(input: {
  name: string;
  mediaType: string;
  sizeBytes: number;
}): Track {
  validateUploadMetadata(input);

  let id = randomUUID();
  let originalName = path.basename(input.name);
  let originalExtension = path.extname(originalName);
  let extension = normalizeExtension(originalExtension, input.mediaType);
  let title = normalizeTrackTitle(path.basename(originalName, originalExtension));
  let filename = createStorageFilename(id, title, extension);

  return {
    id,
    title,
    url: uploadUrl(filename),
    addedAt: Date.now(),
    mediaType: input.mediaType,
    upload: {
      status: "uploading",
      bytesReceived: 0,
      sizeBytes: input.sizeBytes,
    },
  };
}

export function createRenamedTrack(track: Track, requestedTitle: string): Track {
  let title = normalizeTrackTitle(requestedTitle);
  let filename = filenameFromTrack(track);
  let extension = normalizeExtension(path.extname(filename), track.mediaType ?? "");
  let nextFilename = createStorageFilename(track.id, title, extension);
  return { ...track, title, url: uploadUrl(nextFilename) };
}

export function trackFilePath(track: Track, directory = uploadsDir): string {
  return path.join(directory, filenameFromTrack(track));
}

export function trackPartPath(track: Track, directory = uploadsDir): string {
  return `${trackFilePath(track, directory)}.part`;
}

export function normalizeTrackTitle(value: string): string {
  let title = value
    .normalize("NFKC")
    .replace(/\p{Cc}/gu, "")
    .replace(/[/\\]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  if (!title) throw new Error("Track title is required");
  return Array.from(title).slice(0, 120).join("");
}

export function validateUploadMetadata(input: {
  name: string;
  mediaType: string;
  sizeBytes: number;
}): void {
  if (!input.name.trim()) throw new Error("Missing filename");
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new Error("File is empty");
  }
  if (input.sizeBytes > maxUploadSizeBytes) throw new Error("File is too large");
  if (input.mediaType && !allowedAudioTypes.has(input.mediaType)) {
    throw new Error("Unsupported audio type");
  }
}

function filenameFromTrack(track: Track): string {
  if (!track.url.startsWith("/uploads/")) throw new Error("Track is not stored locally");
  let filename = path.basename(decodeURIComponent(track.url));
  if (!filename || filename === "." || filename === "..") {
    throw new Error("Track filename is invalid");
  }
  return filename;
}

function createStorageFilename(id: string, title: string, extension: string): string {
  let safeStem = title
    .replace(/[^\p{L}\p{N}._ -]+/gu, "-")
    .replace(/[ .-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return `${id}-${safeStem || "track"}${extension}`;
}

function uploadUrl(filename: string): string {
  return `/uploads/${encodeURIComponent(filename)}`;
}

function normalizeExtension(extension: string, contentType: string): string {
  let normalized = extension.toLowerCase().replace(/[^a-z0-9.]/g, "");
  return allowedAudioExtensions.has(normalized) ? normalized : extensionFor(contentType);
}

function extensionFor(contentType: string): string {
  switch (contentType) {
    case "audio/wav":
      return ".wav";
    case "audio/ogg":
      return ".ogg";
    case "audio/webm":
    case "video/webm":
      return ".webm";
    case "audio/mp4":
    case "audio/aac":
      return ".m4a";
    case "audio/flac":
      return ".flac";
    default:
      return ".mp3";
  }
}
