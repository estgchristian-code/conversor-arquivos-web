import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config/index.js'
import { createChildLogger } from '../utils/logger.js'

const storageLogger = createChildLogger({ module: 'storage' })

export interface StoragePaths {
  uploadDir: string
  outputDir: string
}

export function getStoragePaths(): StoragePaths {
  return {
    uploadDir: path.resolve(process.cwd(), config.storage.local.uploadDir),
    outputDir: path.resolve(process.cwd(), config.storage.local.outputDir),
  }
}

export async function ensureStorageDirs(): Promise<StoragePaths> {
  const paths = getStoragePaths()
  await Promise.all([
    mkdir(paths.uploadDir, { recursive: true }),
    mkdir(paths.outputDir, { recursive: true }),
  ])
  storageLogger.debug({ paths }, 'Storage directories ready')
  return paths
}

export function sanitizeFileName(name: string): string {
  const base = path
    .basename(name)
    .replace(/\.\.+/g, '.')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/[\x00-\x1F\x7F]/g, '_')
    .trim()
    .replace(/[. ]+$/, '')

  return base.replace(/[^\p{L}\p{N}\p{M}._-]+/gu, '_') || 'arquivo'
}

export function buildUploadPath(fileId: string, originalName: string): string {
  const { uploadDir } = getStoragePaths()
  const extension = path.extname(sanitizeFileName(originalName))
  return path.join(uploadDir, `${fileId}${extension}`)
}

export function buildOutputPath(jobId: string, fileId: string, extension: string): string {
  const { outputDir } = getStoragePaths()
  const safeExtension = extension.replace(/^\./, '')
  return path.join(outputDir, jobId, `${fileId}.${safeExtension}`)
}

export function toPublicPath(absolutePath: string): string {
  const { uploadDir, outputDir } = getStoragePaths()
  const relative = path.relative(process.cwd(), absolutePath).split(path.sep).join('/')
  if (relative.startsWith('..')) return path.basename(absolutePath)
  return `/${relative}`
}