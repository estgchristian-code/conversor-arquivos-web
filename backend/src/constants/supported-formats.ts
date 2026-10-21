/**
 * Extensoes de entrada com conversor real.
 * Esta lista e compartilhada entre o upload e o servico de conversao para
 * evitar que o upload aceite formatos que a conversao nao consegue processar.
 */
export const SUPPORTED_EXTENSIONS: ReadonlySet<string> = new Set([
  'jpg',
  'jpeg',
  'jpe',
  'jfif',
  'png',
  'webp',
  'avif',
  'gif',
  'svg',
  'tiff',
  'tif',
  'bmp',
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