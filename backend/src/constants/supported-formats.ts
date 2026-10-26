/**
 * Extensoes com conversor real.
 * Esta lista e compartilhada entre o upload e o servico de conversao para
 * evitar que o upload aceite formatos que a conversao nao consegue processar.
 */
export const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
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

/** Textos e documentos processados pelo motor de escritorio. */
export const DOCUMENT_EXTENSIONS: ReadonlySet<string> = new Set([
  'doc',
  'docx',
  'odt',
  'rtf',
  'txt',
])

/** Planilhas processadas pelo motor de escritorio. */
export const SPREADSHEET_EXTENSIONS: ReadonlySet<string> = new Set([
  'xls',
  'xlsx',
  'ods',
  'csv',
])

/** Apresentacoes processadas pelo motor de escritorio. */
export const PRESENTATION_EXTENSIONS: ReadonlySet<string> = new Set([
  'ppt',
  'pptx',
  'odp',
])

export type OfficeCategory = 'document' | 'spreadsheet' | 'presentation'
export type FileCategory = 'image' | OfficeCategory

export const OFFICE_EXTENSIONS: ReadonlySet<string> = new Set([
  ...DOCUMENT_EXTENSIONS,
  ...SPREADSHEET_EXTENSIONS,
  ...PRESENTATION_EXTENSIONS,
])

export const SUPPORTED_EXTENSIONS: ReadonlySet<string> = new Set([
  ...IMAGE_EXTENSIONS,
  ...OFFICE_EXTENSIONS,
])

export const ALLOWED_UPLOAD_FIELDS: ReadonlySet<string> = new Set(['files', 'file'])

export function getFileCategory(extension: string): FileCategory | null {
  const normalized = extension.toLowerCase()

  if (IMAGE_EXTENSIONS.has(normalized)) return 'image'
  if (DOCUMENT_EXTENSIONS.has(normalized)) return 'document'
  if (SPREADSHEET_EXTENSIONS.has(normalized)) return 'spreadsheet'
  if (PRESENTATION_EXTENSIONS.has(normalized)) return 'presentation'

  return null
}

export function isOfficeExtension(extension: string): boolean {
  return OFFICE_EXTENSIONS.has(extension.toLowerCase())
}

export function isAllowedExtension(extension: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extension.toLowerCase())
}

export function formatSizeLimit(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
