import { createWriteStream } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { lookup as lookupMimeType } from 'mime-types'
import type { Multipart, MultipartFile } from '@fastify/multipart'
import { config } from '../config/index.js'
import {
  ALLOWED_UPLOAD_FIELDS,
  formatSizeLimit,
  isAllowedExtension,
} from '../constants/supported-formats.js'
import { uploadRepository } from '../repositories/upload.repository.js'
import type {
  RejectedFile,
  UploadRecord,
  UploadResponse,
  UploadResponseFile,
  UploadedFileRecord,
} from '../types/index.js'
import { createChildLogger } from '../utils/logger.js'
import { buildUploadPath, ensureStorageDirs, sanitizeFileName, toPublicPath } from './storage.service.js'

const uploadLogger = createChildLogger({ module: 'upload' })

export class UploadValidationError extends Error {
  readonly statusCode = 400

  constructor(message: string) {
    super(message)
    this.name = 'UploadValidationError'
  }
}

export async function processUpload(parts: AsyncIterable<Multipart>): Promise<UploadResponse> {
  await ensureStorageDirs()

  const uploadId = randomUUID()
  const createdAt = new Date().toISOString()

  const records: UploadedFileRecord[] = []
  const rejected: RejectedFile[] = []
  let partCount = 0

  // Cada part.file precisa ser consumido dentro deste laco: o busboy so avanca para a
  // proxima parte quando o stream da atual e drenado.
  for await (const part of parts) {
    if (part.type !== 'file') continue

    partCount += 1

    if (partCount > config.upload.maxFiles) {
      throw new UploadValidationError(
        `Quantidade excedida: sao permitidos ate ${config.upload.maxFiles} arquivos por envio.`,
      )
    }

    const originalName = sanitizeFileName(part.filename || 'arquivo')
    const extension = path.extname(originalName).replace('.', '').toLowerCase()

    if (!ALLOWED_UPLOAD_FIELDS.has(part.fieldname)) {
      drain(part)
      rejected.push({ name: originalName, reason: `campo "${part.fieldname}" nao suportado` })
      continue
    }

    if (!isAllowedExtension(extension)) {
      drain(part)
      rejected.push({ name: originalName, reason: `formato ".${extension}" nao suportado` })
      continue
    }

    const id = randomUUID()
    const destination = buildUploadPath(id, originalName)
    const target = createWriteStream(destination)

    try {
      await pipeline(part.file, target)
    } catch (error) {
      await unlink(destination).catch(() => undefined)
      uploadLogger.error({ err: error, originalName }, 'Falha ao gravar arquivo enviado')
      rejected.push({ name: originalName, reason: 'falha ao gravar o arquivo no storage' })
      continue
    }

    const size = target.bytesWritten

    if (part.file.truncated || size > config.upload.maxFileSize) {
      await unlink(destination).catch(() => undefined)
      rejected.push({
        name: originalName,
        reason: `excede o tamanho maximo de ${formatSizeLimit(config.upload.maxFileSize)}`,
      })
      continue
    }

    if (size === 0) {
      await unlink(destination).catch(() => undefined)
      rejected.push({ name: originalName, reason: 'arquivo vazio' })
      continue
    }

    records.push({
      id,
      originalName,
      size,
      mimeType: lookupMimeType(originalName) || part.mimetype || 'application/octet-stream',
      extension,
      path: destination,
      uploadedAt: createdAt,
    })
  }

  if (partCount === 0) {
    throw new UploadValidationError('Nenhum arquivo foi enviado.')
  }

  if (records.length === 0) {
    throw new UploadValidationError(
      rejected[0]?.reason ? `Nenhum arquivo aceito: ${rejected[0].reason}.` : 'Nenhum arquivo aceito.',
      )
  }

  const record: UploadRecord = { uploadId, files: records, createdAt }
  await uploadRepository.save(record)

  const files: UploadResponseFile[] = records.map((file) => ({
    id: file.id,
    originalName: file.originalName,
    size: file.size,
    mimeType: file.mimeType,
    url: toPublicPath(file.path),
  }))

  if (rejected.length > 0) {
    uploadLogger.warn({ uploadId, rejectedCount: rejected.length }, 'Arquivos rejeitados no upload')
  }

  return { uploadId, files, rejected }
}

function drain(part: MultipartFile): void {
  part.file.resume()
}