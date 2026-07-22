import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'

import type { Track } from './protocol.ts'
import { radioSpace } from './radio-space.ts'

const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
const allowedAudioTypes = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/flac',
  'video/webm',
])

export async function saveUploadedTrack(file: File): Promise<Track> {
  if (!file.name) throw new Error('Missing filename')
  if (file.size <= 0) throw new Error('File is empty')
  if (file.size > 200 * 1024 * 1024) throw new Error('File is too large')
  if (file.type && !allowedAudioTypes.has(file.type)) throw new Error('Unsupported audio type')

  await fs.mkdir(uploadsDir, { recursive: true })

  let id = randomUUID()
  let safeName = sanitizeFileName(file.name)
  let ext = path.extname(safeName) || extensionFor(file.type)
  let title = path.basename(safeName, ext) || 'Untitled track'
  let filename = `${id}${ext}`
  let diskPath = path.join(uploadsDir, filename)
  let bytes = new Uint8Array(await file.arrayBuffer())

  await fs.writeFile(diskPath, bytes)

  let track: Track = {
    id,
    title,
    url: `/uploads/${filename}`,
    addedAt: Date.now(),
  }

  await radioSpace.addTrack(track)
  return track
}

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\]/g, '-').replace(/[^A-Za-z0-9._ -]/g, '').trim() || 'audio'
}

function extensionFor(contentType: string): string {
  switch (contentType) {
    case 'audio/wav':
      return '.wav'
    case 'audio/ogg':
      return '.ogg'
    case 'audio/webm':
    case 'video/webm':
      return '.webm'
    case 'audio/mp4':
    case 'audio/aac':
      return '.m4a'
    case 'audio/flac':
      return '.flac'
    default:
      return '.mp3'
  }
}
