import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Loader2, Trash2 } from 'lucide-react'
import { formatFileSize, sanitizeFileName } from '../../utils/helpers'
import { useConversion, useDownloadFile, useStartConversion, useUpload } from '../../hooks/useConversions'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { Alert } from '../ui/Alert'
import { FileDropzone, FileList } from './FileDropzone'
import type { ConversionJob, ConversionResult, FileItem, RejectedFile } from '../../types'

/** Formatos de entrada com conversor implementado no backend. */
const INPUT_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'svg', 'tiff', 'bmp']

/** Extensoes aceitas na entrada (TIF e um alias de TIFF, JPE/JFIF de JPEG). */
const INPUT_EXTENSIONS = new Set([...INPUT_FORMATS, 'tif', 'jpe', 'jfif'])

/** Formatos de saida com conversor implementado no backend. */
const OUTPUT_FORMATS = ['png', 'jpg', 'webp', 'avif', 'gif', 'tiff', 'bmp']

const SUPPORTED_INPUT_LABEL = 'JPG/JPEG, PNG, WEBP, AVIF, GIF, SVG, TIFF/TIF e BMP'

/**
 * Tipos usados apenas como dica no seletor do navegador. A validacao real e
 * feita pela extensao de cada arquivo, porque o MIME informado pelo sistema
 * operacional nem sempre corresponde ao conteudo.
 */
const ACCEPTED_INPUT_FILES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg', '.jpe', '.jfif'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/avif': ['.avif'],
  'image/gif': ['.gif'],
  'image/svg+xml': ['.svg'],
  'image/tiff': ['.tiff', '.tif'],
  'image/bmp': ['.bmp'],
}

const toLabel = (format: string) => format.toUpperCase()

/** Normaliza JPG/JPEG/JPE/JFIF e TIF/TIFF para o mesmo formato antes de comparar. */
function normalizeFormat(format: string): string {
  const normalized = format.toLowerCase()
  if (normalized === 'jpeg' || normalized === 'jpe' || normalized === 'jfif') return 'jpg'
  if (normalized === 'tif') return 'tiff'
  return normalized
}

function isSupportedInput(extension: string): boolean {
  return INPUT_EXTENSIONS.has(extension.toLowerCase())
}

/** Formatos distintos detectados pela extensao dos arquivos do lote. */
function getDetectedInputFormats(files: FileItem[]): string[] {
  const formats = new Set<string>()

  for (const file of files) {
    if (isSupportedInput(file.extension)) {
      formats.add(normalizeFormat(file.extension))
    }
  }

  return Array.from(formats)
}

/**
 * Calcula os formatos de saida compativeis com todos os arquivos selecionados.
 * A selecao so aparece depois que ha arquivos, e um formato de saida nunca pode
 * ser igual ao formato de nenhuma entrada (o backend rejeita o lote inteiro).
 */
function getOutputOptions(files: FileItem[]): Array<{ value: string; label: string }> {
  if (files.length === 0) return []

  const inputFormats = new Set(getDetectedInputFormats(files))

  if (inputFormats.size === 0) return []

  return OUTPUT_FORMATS.filter((output) => !inputFormats.has(normalizeFormat(output))).map((format) => ({
    value: format,
    label: toLabel(format),
  }))
}

const MAX_FILES = 50

export function BatchManager({ onStartConversion }: { onStartConversion?: (files: FileItem[], outputFormat: string) => void }) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [outputFormat, setOutputFormat] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [conversionId, setConversionId] = useState<string | null>(null)
  const [conversionJob, setConversionJob] = useState<ConversionJob | null>(null)
  const uploadMutation = useUpload()
  const startMutation = useStartConversion()
  const downloadMutation = useDownloadFile()
  const filesRef = useRef<FileItem[]>([])
  const chainRef = useRef<Promise<void>>(Promise.resolve())
  const pendingRef = useRef(0)
  const enqueuedRef = useRef<Set<string>>(new Set())
  const autoConvertedIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    filesRef.current = files
  }, [files])

  const outputOptions = useMemo(() => getOutputOptions(files), [files])
  const detectedInputFormats = useMemo(() => getDetectedInputFormats(files), [files])

  useEffect(() => {
    if (outputFormat && !outputOptions.some((option) => option.value === outputFormat)) {
      setOutputFormat('')
    }
  }, [outputFormat, outputOptions])

  useEffect(() => {
    if (isUploading || startMutation.isPending) return
    if (!outputFormat) return
    if (!outputOptions.some((option) => option.value === outputFormat)) return

    const pending = files.filter(
      (f) => f.serverId && f.status === 'uploaded' && !autoConvertedIdsRef.current.has(f.id),
    )
    if (pending.length === 0) return

    handleStart(new Set(pending.map((f) => f.id)))
  }, [files, isUploading, outputFormat, outputOptions, startMutation.isPending])

  const applyServerResult = (batch: FileItem[], result: { uploadId: string; files: Array<{ id: string; originalName: string; size: number; url: string }>; rejected: RejectedFile[] }) => {
    const byName = new Map(result.files.map((file) => [sanitizeFileName(file.originalName), file]))
    const rejectedByName = new Map(result.rejected.map((entry) => [sanitizeFileName(entry.name), entry]))

    setFiles((prev) =>
      prev.map((item) => {
        if (!batch.some((entry) => entry.id === item.id)) return item

        const uploaded = byName.get(sanitizeFileName(item.name))
        if (uploaded) {
          return {
            ...item,
            status: 'uploaded',
            progress: 100,
            error: undefined,
            serverId: uploaded.id,
            uploadId: result.uploadId,
            outputUrl: uploaded.url,
            size: uploaded.size || item.size,
          }
        }

        const rejection = rejectedByName.get(sanitizeFileName(item.name))
        return {
          ...item,
          status: 'error',
          error: rejection?.reason ?? 'Arquivo rejeitado pelo servidor',
        }
      }),
    )
  }

  const runUpload = async (targets: FileItem[], ids: Set<string>) => {
    setFiles((prev) =>
      prev.map((item) =>
        ids.has(item.id) ? { ...item, status: 'uploading', progress: 0, error: undefined } : item,
      ),
    )

    try {
      const result = await uploadMutation.mutateAsync({
        files: targets.map((item) => item.file),
      })

      applyServerResult(targets, result)

      if (result.rejected.length > 0) {
        setNotice({
          type: 'error',
          text: `${result.files.length} enviado(s). Rejeitados: ${result.rejected
            .map((entry) => `${entry.name} (${entry.reason})`)
            .join('; ')}`,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha no envio dos arquivos'
      setFiles((prev) =>
        prev.map((item) => (ids.has(item.id) ? { ...item, status: 'error', progress: 0, error: message } : item)),
      )
      setNotice({ type: 'error', text: message })
    }
  }

  const enqueueUpload = (batch: FileItem[]) => {
    const targets = batch.filter(
      (item) => item.file && item.status !== 'uploaded' && !enqueuedRef.current.has(item.id),
    )
    if (targets.length === 0) return

    const ids = new Set(targets.map((item) => item.id))
    targets.forEach((item) => enqueuedRef.current.add(item.id))

    pendingRef.current += 1
    setIsUploading(true)
    setNotice(null)

    chainRef.current = chainRef.current
      .then(() => runUpload(targets, ids))
      .catch(() => undefined)
      .then(() => {
        targets.forEach((item) => enqueuedRef.current.delete(item.id))
        pendingRef.current -= 1
        if (pendingRef.current === 0) setIsUploading(false)
      })
  }

  const handleFilesAdd = (newFiles: FileItem[]) => {
    const previous = filesRef.current
    const remaining = Math.max(0, MAX_FILES - previous.length)

    if (remaining === 0) {
      setNotice({
        type: 'error',
        text: `Limite de ${MAX_FILES} arquivos atingido. Remova algum arquivo antes de adicionar outros.`,
      })
      return
    }

    // A extensao identifica o formato. O conteudo sera validado pelo backend
    // durante a conversao, sem exigir uma escolha previa de formato de entrada.
    const compatible = newFiles.filter((file) => isSupportedInput(file.extension))
    const unsupported = newFiles.filter((file) => !isSupportedInput(file.extension))

    if (compatible.length === 0) {
      const names = unsupported.slice(0, 3).map((file) => file.name).join(', ')
      const extra = unsupported.length > 3 ? ` e mais ${unsupported.length - 3}` : ''
      setNotice({
        type: 'error',
        text: `Nenhum arquivo aceito. Formatos suportados: ${SUPPORTED_INPUT_LABEL}.${
          names ? ` Ignorados: ${names}${extra}.` : ''
        }`,
      })
      return
    }

    const accepted = compatible.slice(0, remaining)
    const overLimit = compatible.length - accepted.length
    setFiles((prev) => [...prev, ...accepted])

    if (unsupported.length > 0 || overLimit > 0) {
      const parts: string[] = []

      if (unsupported.length > 0) parts.push(`${unsupported.length} com formato não suportado`)
      if (overLimit > 0) parts.push(`${overLimit} além do limite de ${MAX_FILES} arquivos`)

      setNotice({
        type: 'error',
        text: `${parts.join(' e ')} ignorado(s). Formatos suportados: ${SUPPORTED_INPUT_LABEL}.`,
      })
    }

    enqueueUpload([...previous, ...accepted])
  }

  const handleRetry = (id: string) => {
    const target = filesRef.current.find((item) => item.id === id)
    if (target) enqueueUpload([target])
  }

  const handleRemove = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleClearAll = () => {
    setFiles([])
    setNotice(null)
    setConversionId(null)
    setConversionJob(null)
    setOutputFormat('')
    autoConvertedIdsRef.current.clear()
  }

  const handleDownload = (result: ConversionResult) => {
    if (!conversionId) return
    setNotice(null)

    downloadMutation.mutate(
      { jobId: conversionId, fileId: result.fileId },
      {
        onSuccess: (blob) => {
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = result.outputName
          document.body.appendChild(link)
          link.click()
          link.remove()
          URL.revokeObjectURL(url)
        },
        onError: (error) => {
          setNotice({
            type: 'error',
            text: `Falha ao baixar "${result.outputName}": ${error.message}`,
          })
        },
      },
    )
  }

  const handleStart = (targetIds?: Set<string>) => {
    if (!outputFormat) return

    const targets = files.filter(
      (f) =>
        f.serverId &&
        f.status !== 'error' &&
        f.status !== 'converting' &&
        (targetIds === undefined || targetIds.has(f.id)),
    )
    if (targets.length === 0) return

    targets.forEach((f) => autoConvertedIdsRef.current.add(f.id))

    const targetSet = new Set(targets.map((f) => f.id))
    const fileIds = targets.map((f) => f.serverId as string)

    setFiles((prev) =>
      prev.map((f) => (targetSet.has(f.id) ? { ...f, status: 'converting' as const, outputFormat, error: undefined } : f)),
    )
    setNotice(null)
    onStartConversion?.(targets, outputFormat)

    startMutation.mutate(
      { fileIds, outputFormat },
      {
        onSuccess: (job) => {
          const results = job.results ?? []
          const byFileId = new Map(results.map((result) => [result.fileId, result]))

          setConversionId(job.id)
          setConversionJob(job)

          setFiles((prev) =>
            prev.map((f) => {
              if (!targetSet.has(f.id)) return f
              const result = f.serverId ? byFileId.get(f.serverId) : undefined
              if (result) {
                return { ...f, status: 'completed', progress: 100, outputUrl: result.outputUrl, error: undefined }
              }
              return { ...f, status: 'error', progress: 0, error: job.error ?? 'Falha na conversão' }
            }),
          )

          const failed = targets.length - results.length
          if (failed > 0) {
            setNotice({
              type: 'error',
              text: `${results.length} de ${targets.length} arquivo(s) convertido(s). ${job.error ?? ''}`.trim(),
            })
          }
        },
        onError: (error) => {
          setConversionId(null)
          setConversionJob(null)
          setFiles((prev) =>
            prev.map((f) =>
              targetSet.has(f.id)
                ? { ...f, status: 'uploaded', progress: 100, error: error.message }
                : f,
            ),
          )
          setNotice({ type: 'error', text: `Falha ao converter os arquivos: ${error.message}` })
        },
      },
    )
  }

  const isConverting = startMutation.isPending
  const errorCount = files.filter((f) => f.status === 'error').length
  const totalSize = files.reduce((acc, f) => acc + f.size, 0)

  const { data: jobDetail } = useConversion(conversionId)
  const activeJob = jobDetail ?? conversionJob
  const results = activeJob?.results ?? []

  const hasNoOutputOptions = files.length > 0 && outputOptions.length === 0
  const convertibleFiles = files.filter((file) => file.serverId && file.status === 'uploaded')
  const canConvert =
    results.length === 0 &&
    Boolean(outputFormat) &&
    !isUploading &&
    !isConverting &&
    convertibleFiles.length > 0 &&
    outputOptions.some((option) => option.value === outputFormat)

  let convertDisabledReason = ''
  if (isUploading) {
    convertDisabledReason = 'Aguarde o envio dos arquivos.'
  } else if (outputOptions.length === 0) {
    convertDisabledReason = 'Nenhum formato de saída compatível com o lote.'
  } else if (!outputFormat) {
    convertDisabledReason = 'Escolha o formato de saída.'
  } else if (convertibleFiles.length === 0) {
    convertDisabledReason =
      errorCount > 0 ? 'Nenhum arquivo válido para converter.' : 'Aguarde o envio dos arquivos.'
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      {results.length === 0 ? (
        <>
          <FileDropzone
            onFilesAdd={handleFilesAdd}
            accept={ACCEPTED_INPUT_FILES}
            disabled={isUploading || isConverting || files.length >= MAX_FILES}
            maxFiles={Math.max(1, MAX_FILES - files.length)}
            compact={files.length > 0}
          />

          {files.length > 0 && (
            <div className="mt-4 space-y-4">
              <FileList
                files={files}
                onRemove={handleRemove}
                onRetry={handleRetry}
                uploading={isUploading}
              />

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <Select
                  id="output-format"
                  label="Converter para"
                  value={outputFormat}
                  onChange={(event) => setOutputFormat(event.target.value)}
                  options={outputOptions}
                  placeholder={outputOptions.length > 0 ? 'Selecione' : 'Nenhum formato disponível'}
                  disabled={outputOptions.length === 0}
                  className="w-full"
                />
                <Button
                  variant="primary"
                  onClick={() => handleStart()}
                  disabled={!canConvert}
                  className="w-full sm:w-auto"
                >
                  {isConverting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {isConverting ? 'Convertendo...' : 'Converter arquivos'}
                </Button>
              </div>

              {hasNoOutputOptions && (
                <p className="text-[12px] leading-5 text-amber-700">
                  Nenhum formato de saída compatível com todos os arquivos do lote
                  {detectedInputFormats.length > 0
                    ? ` (${detectedInputFormats.map(toLabel).join(', ')}).`
                    : '.'}
                </p>
              )}

              {!canConvert && !isConverting && convertDisabledReason && !hasNoOutputOptions && (
                <p className="text-[12px] leading-5 text-gray-500">{convertDisabledReason}</p>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-[14px] font-semibold text-gray-900">Resultados</p>
            <p className="text-[12px] text-gray-500">
              {results.length} {results.length === 1 ? 'arquivo convertido' : 'arquivos convertidos'} para .
              {(activeJob?.outputFormat ?? outputFormat).toUpperCase()}
            </p>
          </div>

          <ul className="divide-y divide-gray-100 border-t border-gray-100">
            {results.map((result) => (
              <li key={result.fileId} className="flex flex-wrap items-center gap-3 py-2.5 sm:flex-nowrap">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-gray-900" title={result.originalName}>
                    {result.originalName}
                  </p>
                  <p className="numeric mt-0.5 truncate text-[11px] text-gray-500" title={result.outputName}>
                    {result.outputName}
                  </p>
                </div>
                <span className="numeric shrink-0 text-[11px] text-gray-500">
                  {formatFileSize(result.outputSize)}
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  className="shrink-0"
                  disabled={downloadMutation.isPending || isConverting}
                  onClick={() => handleDownload(result)}
                  aria-label={`Baixar ${result.outputName}`}
                  title={`Baixar ${result.outputName}`}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Baixar
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {notice && (
        <Alert variant={notice.type} className="mt-4">
          {notice.text}
        </Alert>
      )}

      {files.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
          <p className="text-[11px] text-gray-500">
            {files.length} {files.length === 1 ? 'arquivo' : 'arquivos'} · {formatFileSize(totalSize)}
            {errorCount > 0 && <span className="text-red-600"> · {errorCount} com erro</span>}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            disabled={isUploading || isConverting || files.length === 0}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Limpar tudo
          </Button>
        </div>
      )}
    </div>
  )
}
