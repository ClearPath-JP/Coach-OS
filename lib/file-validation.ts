/** Client-reported MIME types we accept for images (includes common jpeg alias). */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024

function readAscii(bytes: Uint8Array, start: number, len: number): string {
  let s = ''
  for (let i = 0; i < len && start + i < bytes.length; i++) {
    s += String.fromCharCode(bytes[start + i]!)
  }
  return s
}

/** True if buffer is a JPEG (SOI + marker). */
export function isJpegMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

export function isPngMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
}

export function isGifMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 6) return false
  const sig = readAscii(bytes, 0, 6)
  return sig === 'GIF87a' || sig === 'GIF89a'
}

/** WebP: RIFF....WEBP */
export function isWebpMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  if (readAscii(bytes, 0, 4) !== 'RIFF') return false
  return readAscii(bytes, 8, 4) === 'WEBP'
}

export async function validateImageMagicBytes(buffer: ArrayBuffer): Promise<boolean> {
  const bytes = new Uint8Array(buffer)
  return isJpegMagic(bytes) || isPngMagic(bytes) || isGifMagic(bytes) || isWebpMagic(bytes)
}

export function isPdfMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && readAscii(bytes, 0, 4) === '%PDF'
}

/** ZIP-based (Office Open XML / docx). */
export function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 3 || bytes[2] === 5 || bytes[2] === 7)
}

/** Legacy OLE2 / .doc */
export function isOleMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1
  )
}

/** MP4 / MOV / similar: "ftyp" box typically at byte offset 4. */
export function isIsoBmffFtypMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  return bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
}

/** WebM / Matroska EBML header */
export function isWebmEbmlMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
}

/** Quick server-side check for common web video containers (not a full parse). */
export async function validateVideoMagicBytes(buffer: ArrayBuffer): Promise<boolean> {
  const bytes = new Uint8Array(buffer)
  return isIsoBmffFtypMagic(bytes) || isWebmEbmlMagic(bytes)
}

export async function validateDocumentMagicBytes(
  buffer: ArrayBuffer,
  mime: string
): Promise<boolean> {
  const bytes = new Uint8Array(buffer)
  const m = mime.toLowerCase()
  if (m === 'application/pdf') return isPdfMagic(bytes)
  if (m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return isZipMagic(bytes)
  }
  if (m === 'application/msword') {
    return isOleMagic(bytes)
  }
  return false
}

export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .toLowerCase()
    .slice(0, 100)
}

export function generateSafeStoragePath(userId: string, folder: string, fileName: string): string {
  const ext = fileName.split('.').pop() || 'bin'
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  return `${folder}/${userId}/${safeName}`
}

export function normalizeImageMime(mime: string): string {
  const m = mime.toLowerCase().trim()
  if (m === 'image/jpg') return 'image/jpeg'
  return m
}

export function isAllowedImageType(mime: string): boolean {
  const n = normalizeImageMime(mime)
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(n)
}

export function isAllowedDocumentType(mime: string): boolean {
  return (ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(mime.toLowerCase().trim())
}
