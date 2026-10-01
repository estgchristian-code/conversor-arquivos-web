export const SUPPORTED_EXTENSIONS: ReadonlySet<string> = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'md',
  'rtf',
  'odt',
  'ods',
  'odp',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'avif',
  'gif',
  'svg',
  'tiff',
  'bmp',
  'heic',
  'mp3',
  'wav',
  'flac',
  'ogg',
  'aac',
  'm4a',
  'opus',
  'mp4',
  'webm',
  'mov',
  'avi',
  'mkv',
  'flv',
  'zip',
  'tar',
  'gz',
  'rar',
  '7z',
])

export const ALLOWED_UPLOAD_FIELDS: ReadonlySet<string> = new Set(['files', 'file'])

export function isAllowedExtension(extension: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extension.toLowerCase())
}

export function formatSizeLimit(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}