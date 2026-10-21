import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  Download,
  FileImage,
  Files,
  HardDrive,
  Layers,
  Loader2,
  Lock,
  Trash2,
} from 'lucide-react'
import { formatFileSize, sanitizeFileName } from '../../utils/helpers'
import { useConversion, useDownloadFile, useStartConversion, useUpload } from '../../hooks/useConversions'
import { Button } from '../ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card'
import { Select } from '../ui/Select'
import { Progress } from '../ui/Progress'
import { Badge } from '../ui/Badge'
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

const STEPS = [
  'Adicione os arquivos; o formato de cada um é identificado pela extensão.',
  'Selecione o formato de saída para iniciar a conversão automaticamente.',
  'Acompanhe o progresso e baixe os resultados.',
]

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Files
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <dt className="flex items-center gap-2 text-gray-500">
        <Icon className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
        {label}
      </dt>
      <dd className="numeric truncate font-medium text-gray-900">{value}</dd>
    </div>
  )
}

export function BatchManager({ onStartConversion }: { onStartConversion?: (files: FileItem[], outputFormat: string) => void }) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [outputFormat, setOutputFormat] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
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
    setUploadProgress(0)
    setFiles((prev) =>
      prev.map((item) =>
        ids.has(item.id) ? { ...item, status: 'uploading', progress: 0, error: undefined } : item,
      ),
    )

    try {
      const result = await uploadMutation.mutateAsync({
        files: targets.map((item) => item.file),
        onProgress: (percent) => {
          setUploadProgress(percent)
          setFiles((prev) =>
            prev.map((item) =>
              ids.has(item.id) ? { ...item, progress: percent } : item,
            ),
          )
        },
      })

      applyServerResult(targets, result)
      setUploadProgress(100)

      if (result.rejected.length > 0) {
        setNotice({
          type: 'error',
          text: `${result.files.length} enviado(s). Rejeitados: ${result.rejected
            .map((entry) => `${entry.name} (${entry.reason})`)
            .join('; ')}`,
        })
      } else {
        setNotice({ type: 'success', text: `${result.files.length} arquivo(s) enviado(s) com sucesso.` })
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
    setUploadProgress(0)
    setNotice(null)
    setConversionId(null)
    setConversionJob(null)
    setOutputFormat('')
    autoConvertedIdsRef.current.clear()
  }

  const handleClearResults = () => {
    setConversionId(null)
    setConversionJob(null)
    setNotice(null)
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
          setNotice({
            type: failed > 0 ? 'error' : 'success',
            text:
              failed > 0
                ? `${results.length} de ${targets.length} arquivo(s) convertido(s). ${job.error ?? ''}`.trim()
                : `${results.length} arquivo(s) convertido(s) para .${job.outputFormat}.`,
          })
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

  const batchStatus = isUploading
    ? { label: 'Enviando', variant: 'info' as const }
    : isConverting
      ? { label: 'Convertendo', variant: 'info' as const }
      : results.length > 0
        ? { label: 'Concluído', variant: 'success' as const }
        : errorCount > 0
          ? { label: 'Com erros', variant: 'error' as const }
          : { label: 'Pronto', variant: 'secondary' as const }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-600 ring-1 ring-inset ring-primary-100">
                <Layers className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <CardTitle>Arquivos e envio</CardTitle>
                <CardDescription>
                  Adicione os arquivos; o formato de cada um é identificado pela extensão.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {files.length > 0 && (
              <div className="max-w-sm">
                <Select
                  id="output-format"
                  label="Converter para"
                  value={outputFormat}
                  onChange={(event) => setOutputFormat(event.target.value)}
                  options={outputOptions}
                  placeholder={outputOptions.length > 0 ? 'Selecione' : 'Nenhum formato disponível'}
                  disabled={outputOptions.length === 0}
                  hint={
                    outputOptions.length > 0
                      ? 'A conversão inicia após a escolha.'
                      : 'Remova arquivos de um formato para liberar uma saída.'
                  }
                  className="w-full"
                />
              </div>
            )}

            {hasNoOutputOptions && (
              <Alert variant="warning" title="Nenhum formato de saída compatível">
                <p>
                  Não há formato de saída compatível com todos os arquivos do lote. Remova os
                  arquivos de pelo menos um dos formatos de entrada na lista abaixo para liberar
                  uma conversão sem redundância.
                </p>
                {detectedInputFormats.length > 0 && (
                  <p className="mt-1.5">
                    Formatos detectados: {detectedInputFormats.map(toLabel).join(', ')}.
                  </p>
                )}
              </Alert>
            )}

            {files.length === 0 && (
              <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-gray-200 bg-gray-50/70 px-3.5 py-2.5">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                <p className="text-[12px] leading-4 text-gray-500">
                  O formato de saída aparece depois que você adicionar arquivos.
                </p>
              </div>
            )}

            {results.length === 0 && (
              <div className="border-t border-gray-100 pt-5">
                <FileDropzone
                  onFilesAdd={handleFilesAdd}
                  accept={ACCEPTED_INPUT_FILES}
                  disabled={isUploading || isConverting || files.length >= MAX_FILES}
                  maxFiles={Math.max(1, MAX_FILES - files.length)}
                  compact={files.length > 0}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {notice && <Alert variant={notice.type}>{notice.text}</Alert>}

        {files.length > 0 && (
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Arquivos do lote</CardTitle>
                <CardDescription>
                  <span className="numeric">{files.length}</span>{' '}
                  {files.length === 1 ? 'arquivo' : 'arquivos'} ·{' '}
                  <span className="numeric">{formatFileSize(totalSize)}</span>
                  {errorCount > 0 && (
                    <>
                      {' '}
                      · <span className="font-medium text-red-600">{errorCount} com erro</span>
                    </>
                  )}
                </CardDescription>
              </div>
              <Badge variant={batchStatus.variant} dot>
                {batchStatus.label}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {isUploading && (
                <div className="rounded-lg border border-gray-200 bg-gray-50/80 px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="flex items-center gap-2 font-medium text-gray-700">
                      <Loader2 className="h-4 w-4 animate-spin text-primary-600" aria-hidden="true" />
                      Enviando arquivos...
                    </span>
                    <span className="numeric text-gray-500">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} size="sm" className="mt-2" />
                </div>
              )}

              {isConverting && (
                <div className="flex items-center gap-3 rounded-lg border border-primary-100 bg-primary-50/60 px-4 py-3 text-[13px] text-primary-800">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary-600" aria-hidden="true" />
                  <span>Convertendo arquivos no servidor...</span>
                </div>
              )}

              {results.length === 0 && (
                <FileList
                  files={files}
                  onRemove={handleRemove}
                  onRetry={handleRetry}
                  uploading={isUploading}
                />
              )}

              {results.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-green-200">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-green-200 bg-green-50/80 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-green-100 text-green-700">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-[13px] font-semibold text-green-900">
                          {results.length} {results.length === 1 ? 'arquivo convertido' : 'arquivos convertidos'}
                        </p>
                        <p className="text-[11px] text-green-700">
                          Formato de saída: .{(activeJob?.outputFormat ?? outputFormat).toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearResults}
                      disabled={isConverting || isUploading}
                    >
                      Limpar resultados
                    </Button>
                  </div>
                  <ul className="divide-y divide-green-100">
                    {results.map((result) => (
                      <li
                        key={result.fileId}
                        className="flex flex-wrap items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-green-50/50 sm:flex-nowrap"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-green-50 text-green-600">
                          <FileImage className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-gray-900" title={result.originalName}>
                            {result.originalName}
                          </p>
                          <p className="numeric mt-0.5 truncate text-[11px] text-gray-500" title={result.outputName}>
                            {result.outputName}
                          </p>
                        </div>
                        <span className="numeric shrink-0 text-[12px] text-gray-500">
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

              <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-x-2 text-[12px] text-gray-500">
                  <span className="numeric">
                    {files.length} {files.length === 1 ? 'arquivo' : 'arquivos'}
                  </span>
                  <span aria-hidden="true" className="text-gray-300">
                    ·
                  </span>
                  <span className="numeric">{formatFileSize(totalSize)}</span>
                  {errorCount > 0 && (
                    <>
                      <span aria-hidden="true" className="text-gray-300">
                        ·
                      </span>
                      <span className="numeric font-medium text-red-600">{errorCount} com erro</span>
                    </>
                  )}
                </div>

                <Button
                  variant="outline"
                  onClick={handleClearAll}
                  disabled={isUploading || isConverting || files.length === 0}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Limpar tudo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <aside className="space-y-5" aria-label="Resumo do lote">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Resumo do lote</CardTitle>
                <CardDescription>Atualizado conforme você adiciona arquivos.</CardDescription>
              </div>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-200">
                <Files className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2.5">
              <SummaryRow icon={Files} label="Arquivos" value={`${files.length} de ${MAX_FILES}`} />
              <SummaryRow icon={HardDrive} label="Tamanho total" value={formatFileSize(totalSize)} />
              <SummaryRow
                icon={Layers}
                label="Entrada"
                value={detectedInputFormats.length > 0 ? detectedInputFormats.map(toLabel).join(', ') : '—'}
              />
              <SummaryRow icon={Layers} label="Saída" value={outputFormat ? toLabel(outputFormat) : '—'} />
            </dl>

            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-gray-500">
                <span>Capacidade do lote</span>
                <span className="numeric">
                  {files.length}/{MAX_FILES}
                </span>
              </div>
              <Progress value={files.length} max={MAX_FILES} size="sm" />
            </div>

            {errorCount > 0 && (
              <p className="mt-3 text-[12px] font-medium text-red-600">
                {errorCount === 1 ? '1 arquivo com erro no lote.' : `${errorCount} arquivos com erro no lote.`}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Como funciona</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {STEPS.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="numeric mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-gray-200 bg-gray-50 text-[10px] font-semibold text-gray-500">
                    {index + 1}
                  </span>
                  <p className="text-[12px] leading-5 text-gray-500">{step}</p>
                </li>
              ))}
            </ol>
            <p className="mt-4 rounded-lg border border-primary-100 bg-primary-50/60 px-3 py-2.5 text-[11px] leading-4 text-primary-800">
              A conversão começa automaticamente quando o formato de saída é escolhido.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Formatos suportados</CardTitle>
            <CardDescription>Conversões disponíveis nesta versão.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">Saída</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {OUTPUT_FORMATS.map((format) => (
                <Badge key={format} variant="secondary">
                  {toLabel(format)}
                </Badge>
              ))}
            </div>
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">Entrada</p>
            <p className="mt-1.5 text-[12px] leading-5 text-gray-500">
              JPG/JPEG, PNG, WEBP, AVIF, GIF, SVG, TIFF/TIF e BMP.
            </p>
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}
