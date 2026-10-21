import { randomUUID } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { lookup as lookupMimeType } from 'mime-types'
import { conversionRepository } from '../repositories/conversion.repository.js'
import { uploadRepository } from '../repositories/upload.repository.js'
import { buildOutputPath, ensureStorageDirs, sanitizeFileName, toPublicPath } from './storage.service.js'
import { BmpDecodeError, BmpEncodeError, decodeBmp, encodeBmp } from '../utils/bmp.js'
import { createChildLogger } from '../utils/logger.js'
import { SUPPORTED_EXTENSIONS } from '../constants/supported-formats.js'
import type {
  ConversionJobRecord,
  ConversionOptions,
  ConversionResultRecord,
  PaginatedResult,
  StartConversionRequest,
  UploadedFileRecord,
} from '../types/index.js'

const conversionLogger = createChildLogger({ module: 'conversion' })

/** Formatos de entrada aceitos pelo motor de imagens nesta etapa. */
export const IMAGE_INPUT_FORMATS: ReadonlySet<string> = SUPPORTED_EXTENSIONS

/** Formatos de saida produzidos pelo motor de imagens nesta etapa. */
export const IMAGE_OUTPUT_FORMATS: ReadonlySet<string> = new Set([
  'png',
  'jpg',
  'webp',
  'avif',
  'gif',
  'tiff',
  'bmp',
])

/** Normaliza aliases de extensao para comparar formatos equivalentes. */
function normalizeFormat(format: string): string {
  if (format === 'jpeg' || format === 'jpe' || format === 'jfif') return 'jpg'
  if (format === 'tif') return 'tiff'
  return format
}

const DEFAULT_QUALITY = 90
const MIN_QUALITY = 1
const MAX_QUALITY = 100
const MAX_SVG_BYTES = 10 * 1024 * 1024
const MAX_SVG_PIXELS = 100_000_000
const SVG_DENSITY = 72

export class ConversionError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'ConversionError'
    this.statusCode = statusCode
  }
}

export interface ConversionOutputFile {
  result: ConversionResultRecord
  absolutePath: string
}

/**
 * Cria um job de conversão e processa os arquivos de forma sincrona.
 *
 * Nao ha fila nesta etapa: o processamento acontece dentro da requisicao e o
 * progresso e persistido a cada arquivo concluido.
 */
export async function startConversion(request: StartConversionRequest): Promise<ConversionJobRecord> {
  const fileIds = normalizeFileIds(request?.fileIds)
  const outputFormat = normalizeOutputFormat(request?.outputFormat)
  const options = normalizeOptions(request?.options)

  const sources = await resolveSources(fileIds)
  assertConvertible(sources, outputFormat)

  const id = randomUUID()
  const now = new Date().toISOString()

  await conversionRepository.create({
    id,
    fileIds: sources.map((file) => file.id),
    inputFiles: sources.map((file) => ({
      id: file.id,
      originalName: file.originalName,
      size: file.size,
      mimeType: file.mimeType,
    })),
    outputFormat,
    status: 'queued',
    progress: 0,
    createdAt: now,
    updatedAt: now,
    results: [],
  })

  await updateJob(id, { status: 'processing' })

  await ensureStorageDirs()

  const results: ConversionResultRecord[] = []
  const failures: string[] = []

  for (const [index, source] of sources.entries()) {
    try {
      results.push(await convertImage(source, id, outputFormat, options))
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'erro desconhecido'
      failures.push(`${source.originalName}: ${reason}`)
      conversionLogger.warn({ err: error, jobId: id, fileId: source.id }, 'Falha ao converter arquivo')
    }

    const progress = Math.round(((index + 1) / sources.length) * 100)
    await updateJob(id, { progress, results: [...results] })
  }

  const status =
    results.length === 0 ? 'failed' : results.length < sources.length ? 'partial' : 'completed'

  const job = await updateJob(id, {
    status,
    progress: 100,
    results,
    ...(failures.length > 0 ? { error: failures.join('; ') } : {}),
    ...(status === 'completed' || status === 'partial'
      ? { completedAt: new Date().toISOString() }
      : {}),
  })

  conversionLogger.info({ jobId: id, status, converted: results.length, total: sources.length }, 'Job concluido')

  if (!job) {
    throw new ConversionError(`Job de conversao nao encontrado: ${id}`, 500)
  }

  return job
}

export async function getConversion(jobId: string): Promise<ConversionJobRecord> {
  const job = await conversionRepository.findById(jobId)

  if (!job) {
    throw new ConversionError(`Job de conversao nao encontrado: ${jobId}`, 404)
  }

  return job
}

export async function getConversions(page = 1, limit = 20): Promise<PaginatedResult<ConversionJobRecord>> {
  return conversionRepository.findAll(page, limit)
}

export async function getConversionOutput(jobId: string, fileId: string): Promise<ConversionOutputFile> {
  const job = await getConversion(jobId)
  const result = job.results?.find((entry) => entry.fileId === fileId)

  if (!result) {
    throw new ConversionError(`Arquivo ${fileId} nao pertence ao job ${jobId}.`, 404)
  }

  const absolutePath = path.resolve(getOutputAbsolutePath(result.outputUrl))

  try {
    const stats = await stat(absolutePath)
    if (!stats.isFile()) throw new Error('nao e um arquivo')
  } catch {
    throw new ConversionError(`Arquivo convertido nao encontrado: ${result.outputName}`, 404)
  }

  return { result, absolutePath }
}

export function getOutputMimeType(outputName: string): string {
  return lookupMimeType(outputName) || 'application/octet-stream'
}

async function convertImage(
  source: UploadedFileRecord,
  jobId: string,
  outputFormat: string,
  options: ConversionOptions,
): Promise<ConversionResultRecord> {
  const destination = buildOutputPath(jobId, source.id, outputFormat)
  await mkdir(path.dirname(destination), { recursive: true })

  const baseName = path.parse(source.originalName).name || 'arquivo'
  const outputName = `${baseName}.${outputFormat}`
  const startedAt = Date.now()

  const image = await loadImage(source)
  let outputSize: number

  if (outputFormat === 'bmp') {
    const { data, info } = await image
      .flatten({ background: '#ffffff' })
      .removeAlpha()
      .toColourspace('srgb')
      .raw()
      .toBuffer({ resolveWithObject: true })

    try {
      const encoded = encodeBmp({
        data,
        width: info.width,
        height: info.height,
        channels: info.channels,
      })

      await writeFile(destination, encoded)
      outputSize = encoded.length
    } catch (error) {
      if (error instanceof BmpEncodeError) {
        throw new ConversionError(`Falha ao gerar BMP (${source.originalName}): ${error.message}`)
      }
      throw error
    }
  } else {
    switch (outputFormat) {
      case 'png':
        image.png()
        break
      case 'jpg':
        image.jpeg({ quality: options.quality ?? DEFAULT_QUALITY })
        break
      case 'webp':
        image.webp({ quality: options.quality ?? DEFAULT_QUALITY })
        break
      case 'avif':
        image.avif({ quality: options.quality ?? DEFAULT_QUALITY })
        break
      case 'gif':
        image.gif()
        break
      case 'tiff':
        image.tiff({ compression: 'lzw' })
        break
      default:
        throw new ConversionError(`Formato de saida nao suportado: ${outputFormat}`)
    }

    const info = await image.toFile(destination)
    outputSize = info.size
  }

  return {
    fileId: source.id,
    originalName: source.originalName,
    outputName,
    outputUrl: toPublicPath(destination),
    outputSize,
    duration: Date.now() - startedAt,
  }
}

async function loadImage(source: UploadedFileRecord): Promise<ReturnType<typeof sharp>> {
  if (source.extension === 'svg') {
    let content: string

    try {
      const buffer = await readFile(source.path)

      if (buffer.length > MAX_SVG_BYTES) {
        throw new ConversionError(
          `SVG excede o limite de ${Math.round(MAX_SVG_BYTES / (1024 * 1024))} MB (${source.originalName}).`,
        )
      }

      content = buffer.toString('utf8')
    } catch (error) {
      if (error instanceof ConversionError) throw error
      throw new ConversionError(`Arquivo de origem nao encontrado: ${source.originalName}`, 404)
    }

    assertSafeSvg(content, source.originalName)
    return sharp(source.path, {
      failOn: 'none',
      limitInputPixels: MAX_SVG_PIXELS,
      density: SVG_DENSITY,
    })
  }

  if (source.extension === 'bmp') {
    let buffer: Buffer

    try {
      buffer = await readFile(source.path)
    } catch {
      throw new ConversionError(`Arquivo de origem nao encontrado: ${source.originalName}`, 404)
    }

    try {
      const decoded = decodeBmp(buffer)
      return sharp(decoded.data, {
        raw: { width: decoded.width, height: decoded.height, channels: decoded.channels },
      })
    } catch (error) {
      if (error instanceof BmpDecodeError) {
        throw new ConversionError(`BMP invalido (${source.originalName}): ${error.message}`)
      }
      throw error
    }
  }

  return sharp(source.path, { failOn: 'none' })
}

/**
 * Bloqueia recursos ativos/externos em SVG antes da rasterizacao. O objetivo
 * nao e substituir um sanitizador XML completo, mas impedir os vetores mais
 * comuns em um arquivo enviado por usuario.
 */
function assertSafeSvg(content: string, originalName: string): void {
  const checks: Array<[RegExp, string]> = [
    [/<!entity/i, 'entidades XML'],
    [/<!doctype[^>]*(?:system|public)/i, 'DTD externo'],
    [/<script\b/i, 'scripts'],
    [/<foreignobject\b/i, 'foreignObject'],
    [/\son[a-z]+\s*=/i, 'eventos inline'],
    [/javascript\s*:/i, 'URL javascript'],
    [/@import\s+(?:url\()?\s*['"]?(?:https?:|file:|\/\/)/i, 'import externo'],
    [/url\(\s*['"]?\s*(?:https?:|file:|\/\/)/i, 'URL externa em CSS'],
    [/xml:base\s*=\s*["']\s*(?:https?:|file:|\/\/)/i, 'xml:base externo'],
  ]

  for (const [pattern, label] of checks) {
    if (pattern.test(content)) {
      throw new ConversionError(`SVG invalido (${originalName}): ${label} nao permitido.`)
    }
  }

  const hrefPattern = /\b(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi
  let match: RegExpExecArray | null

  while ((match = hrefPattern.exec(content)) !== null) {
    const value = (match[1] ?? match[2] ?? match[3] ?? '').trim().toLowerCase()

    if (!value || value.startsWith('#')) continue
    if (/^data:image\/(?:png|jpe?g|gif|webp|avif);base64,/.test(value)) continue

    throw new ConversionError(
      `SVG invalido (${originalName}): referencias externas nao sao permitidas.`,
    )
  }
}

async function resolveSources(fileIds: string[]): Promise<UploadedFileRecord[]> {
  const sources: UploadedFileRecord[] = []
  const missing: string[] = []

  for (const fileId of fileIds) {
    const file = await uploadRepository.findFileById(fileId)
    if (file) sources.push(file)
    else missing.push(fileId)
  }

  if (missing.length > 0) {
    throw new ConversionError(
      `Arquivo(s) enviado(s) nao encontrado(s) no storage: ${missing.join(', ')}.`,
      400,
    )
  }

  return sources
}

function assertConvertible(sources: UploadedFileRecord[], outputFormat: string): void {
  const unsupported = sources.filter((file) => !IMAGE_INPUT_FORMATS.has(file.extension))

  if (unsupported.length > 0) {
    const detail = unsupported.map((file) => `${file.originalName} (.${file.extension})`).join(', ')
    throw new ConversionError(
      `Formato(s) de entrada sem conversor disponivel nesta etapa: ${detail}. ` +
        `Aceitos: ${[...IMAGE_INPUT_FORMATS].join(', ')}.`,
    )
  }

  const normalizedOutput = normalizeFormat(outputFormat)
  const redundant = sources.filter((file) => normalizeFormat(file.extension) === normalizedOutput)

  if (redundant.length > 0) {
    const detail = redundant.map((file) => file.originalName).join(', ')
    throw new ConversionError(`Arquivo(s) ja esta(no) no formato de saida (${outputFormat}): ${detail}.`)
  }
}

function normalizeFileIds(fileIds: unknown): string[] {
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    throw new ConversionError('Informe ao menos um arquivo em "fileIds".')
  }

  const normalized = fileIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

  if (normalized.length !== fileIds.length) {
    throw new ConversionError('"fileIds" deve conter apenas identificadores validos.')
  }

  if (new Set(normalized).size !== normalized.length) {
    throw new ConversionError('"fileIds" contem identificadores repetidos.')
  }

  return normalized
}

function normalizeOutputFormat(outputFormat: unknown): string {
  if (typeof outputFormat !== 'string' || outputFormat.trim().length === 0) {
    throw new ConversionError('Informe o formato de saida em "outputFormat".')
  }

  const normalized = outputFormat.trim().toLowerCase().replace(/^\./, '')

  if (!IMAGE_OUTPUT_FORMATS.has(normalized)) {
    throw new ConversionError(
      `Formato de saida nao suportado: ${outputFormat}.Disponiveis: ${[...IMAGE_OUTPUT_FORMATS].join(', ')}.`,
    )
  }

  return normalized
}

function normalizeOptions(options: ConversionOptions | undefined): ConversionOptions {
  if (!options || typeof options !== 'object') return {}

  const { quality } = options

  if (quality === undefined) return options

  if (typeof quality !== 'number' || Number.isNaN(quality)) {
    throw new ConversionError('"options.quality" deve ser um numero.')
  }

  return {
    ...options,
    quality: Math.min(MAX_QUALITY, Math.max(MIN_QUALITY, Math.round(quality))),
  }
}

async function updateJob(
  jobId: string,
  patch: Partial<ConversionJobRecord>,
): Promise<ConversionJobRecord | undefined> {
  return conversionRepository.update(jobId, patch)
}

function getOutputAbsolutePath(outputUrl: string): string {
  const prefix = '/storage/outputs/'

  if (!outputUrl.startsWith(prefix)) {
    throw new ConversionError(`Caminho de saida invalido: ${outputUrl}`)
  }

  return path.join(process.cwd(), outputUrl.slice(1))
}