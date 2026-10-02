import { useEffect, useRef, useState } from 'react'
import { Trash2, Play, CheckCircle, AlertCircle, Download, Loader2 } from 'lucide-react'
import { cn, formatFileSize, sanitizeFileName } from '../../utils/helpers'
import { useConversion, useDownloadFile, useStartConversion, useUpload } from '../../hooks/useConversions'
import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { Select } from '../ui/Select'
import { Progress } from '../ui/Progress'
import { FileDropzone, FileList } from './FileDropzone'
import type { ConversionJob, ConversionResult, FileItem, RejectedFile } from '../../types'

/** Formatos de entrada com conversor implementado no backend. */
const INPUT_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'tiff', 'bmp']

/** Formatos de saida com conversor implementado no backend. */
const OUTPUT_FORMATS = ['png', 'jpg', 'webp', 'avif', 'gif']

/** Tipo usado pelo seletor de upload para validar a extensao escolhida. */
const INPUT_MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  tiff: 'image/tiff',
  bmp: 'image/bmp',
}

const toLabel = (format: string) => format.toUpperCase()

/** O backend rejeita converter um arquivo para o proprio formato. */
function isRedundantConversion(input: string, output: string): boolean {
  return output === input || (input === 'jpeg' && output === 'jpg')
}

function getOutputOptions(inputFormat: string): Array<{ value: string; label: string }> {
  if (!inputFormat) return []
  return OUTPUT_FORMATS.filter((output) => !isRedundantConversion(inputFormat, output)).map((format) => ({
    value: format,
    label: toLabel(format),
  }))
}

function isSupportedInput(extension: string): boolean {
  return INPUT_FORMATS.includes(extension.toLowerCase())
}

/** JPG e JPEG sao o mesmo formato: o seletor aceita as duas extensoes. */
function getAcceptedExtensions(inputFormat: string): string[] {
  if (inputFormat === 'jpg' || inputFormat === 'jpeg') return ['jpg', 'jpeg']
  return inputFormat ? [inputFormat] : []
}

function isAcceptedExtension(inputFormat: string, extension: string): boolean {
  return getAcceptedExtensions(inputFormat).includes(extension.toLowerCase())
}

/**
 * O react-dropzone achata os valores do mapa e compara por tipo MIME, entao a
 * extensao tambem e informada para o filtro funcionar pelos dois criterios.
 */
function buildAccept(inputFormat: string): Record<string, string[]> | undefined {
  const extensions = getAcceptedExtensions(inputFormat)
  if (extensions.length === 0) return undefined

  return Object.fromEntries(
    extensions.map((extension) => [
      `.${extension}`,
      [INPUT_MIME_TYPES[extension] ?? extension, `.${extension}`],
    ]),
  )
}

const MAX_FILES = 50

export function BatchManager({ onStartConversion }: { onStartConversion?: (files: FileItem[], outputFormat: string) => void }) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [inputFormat, setInputFormat] = useState<string>('')
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

  useEffect(() => {
    filesRef.current = files
  }, [files])

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

    // Segunda barreira: garante que so entre o formato de entrada escolhido.
    const compatible = newFiles.filter(
      (file) => isSupportedInput(file.extension) && isAcceptedExtension(inputFormat, file.extension),
    )
    const incompatible = newFiles.length - compatible.length

    if (compatible.length === 0) {
      setNotice({
        type: 'error',
        text: `Nenhum arquivo aceito: o formato de entrada selecionado é .${toLabel(inputFormat)}.`,
      })
      return
    }

    const accepted = compatible.slice(0, remaining)
    setFiles((prev) => [...prev, ...accepted])

    if (incompatible > 0) {
      setNotice({
        type: 'error',
        text: `${incompatible} arquivo(s) ignorado(s): o formato de entrada selecionado é .${toLabel(inputFormat)}.`,
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
  }

  const handleClearResults = () => {
    setConversionId(null)
    setConversionJob(null)
    setNotice(null)
  }

  const handleInputFormatChange = (format: string) => {
    setInputFormat(format)

    // A saida precisa continuar valida para a nova entrada.
    setOutputFormat((current) =>
      current && !isRedundantConversion(format, current) ? current : '',
    )

    if (filesRef.current.length > 0) {
      setFiles([])
      setConversionId(null)
      setConversionJob(null)
      setUploadProgress(0)
      setNotice({
        type: 'error',
        text: `A lista foi limpa porque o formato de entrada mudou para .${toLabel(format)}.`,
      })
    }
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

  const handleStart = () => {
    if (!inputFormat || !outputFormat) return

    const targets = files.filter((f) => f.serverId && f.status !== 'error' && f.status !== 'converting')
    if (targets.length === 0) return

    const targetIds = new Set(targets.map((f) => f.id))
    const fileIds = targets.map((f) => f.serverId as string)

    setFiles((prev) =>
      prev.map((f) => (targetIds.has(f.id) ? { ...f, outputFormat, error: undefined } : f)),
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
              if (!targetIds.has(f.id)) return f
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
              targetIds.has(f.id)
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
  const hasUploadedFiles = files.some((f) => f.serverId && f.status !== 'error')
  const canConvert =
    Boolean(inputFormat && outputFormat) && hasUploadedFiles && !isConverting && !isUploading
  const errorCount = files.filter((f) => f.status === 'error').length
  const totalSize = files.reduce((acc, f) => acc + f.size, 0)

  const { data: jobDetail } = useConversion(conversionId)
  const activeJob = jobDetail ?? conversionJob
  const results = activeJob?.results ?? []

  const acceptedFiles = buildAccept(inputFormat)

  return (
    <Card>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Select
            id="input-format"
            label="Formato dos arquivos"
            value={inputFormat}
            onChange={(event) => handleInputFormatChange(event.target.value)}
            options={INPUT_FORMATS.map((format) => ({ value: format, label: toLabel(format) }))}
            placeholder="Selecione"
            className="h-10 w-full sm:w-40"
          />

          <Select
            id="output-format"
            label="Converter para"
            value={outputFormat}
            onChange={(event) => setOutputFormat(event.target.value)}
            options={getOutputOptions(inputFormat)}
            placeholder={inputFormat ? 'Selecione' : 'Escolha o formato de entrada'}
            disabled={!inputFormat}
            className="h-10 w-full sm:w-40"
          />
        </div>

        <div className="mt-6">
          <FileDropzone
            onFilesAdd={handleFilesAdd}
            inputFormat={inputFormat}
            acceptedFiles={acceptedFiles}
            disabled={!inputFormat || isUploading || isConverting || files.length >= MAX_FILES}
            maxFiles={Math.max(1, MAX_FILES - files.length)}
            compact={files.length > 0}
          />
        </div>

        {files.length > 0 && (
          <div className="mt-4">
            <FileList
              files={files}
              onRemove={handleRemove}
              onRetry={handleRetry}
              uploading={isUploading}
            />
          </div>
        )}

        {files.length > 0 && (
          <>
            {notice && (
              <div
                className={cn(
                  'mt-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-[13px] leading-[18px]',
                  notice.type === 'success'
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-red-200 bg-red-50 text-red-700',
                )}
              >
                {notice.type === 'success' ? (
                  <CheckCircle className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <span>{notice.text}</span>
              </div>
            )}

            {isUploading && (
              <div className="mt-4 flex items-center gap-3">
                <Progress value={uploadProgress} className="flex-1" />
                <span className="numeric w-10 shrink-0 text-right text-xs text-gray-500">{uploadProgress}%</span>
              </div>
            )}

            {isConverting && (
              <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-[13px] text-gray-600">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-400" aria-hidden="true" />
                <span>Convertendo arquivos no servidor...</span>
              </div>
            )}

            {results.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
                <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2">
                  <p className="text-[13px] font-medium text-gray-700">
                    {results.length} {results.length === 1 ? 'arquivo convertido' : 'arquivos convertidos'}
                    <span className="font-normal text-gray-500">
                      {' '}
                      · job {conversionId?.slice(0, 8)}
                    </span>
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearResults}
                    disabled={isConverting || isUploading}
                  >
                    Limpar resultados
                  </Button>
                </div>
                <ul className="divide-y divide-gray-200">
                  {results.map((result) => (
                    <li key={result.fileId} className="flex items-center gap-3 px-4 py-2.5">
                      <CheckCircle className="h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-gray-900">
                        {result.outputName}
                      </span>
                      <span className="numeric shrink-0 text-xs text-gray-500">
                        {formatFileSize(result.outputSize)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={downloadMutation.isPending || isConverting}
                        onClick={() => handleDownload(result)}
                        aria-label={`Baixar ${result.outputName}`}
                        title={`Baixar ${result.outputName}`}
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                        Baixar
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-4 border-t border-gray-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-2 text-[13px] text-gray-500">
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
                    <span className="numeric font-medium text-red-600">
                      {errorCount} com erro
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:gap-3">
                <Button
                  variant="outline"
                  onClick={handleClearAll}
                  disabled={isUploading || isConverting || files.length === 0}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Limpar tudo
                </Button>

                <Button
                  size="lg"
                  onClick={handleStart}
                  disabled={!canConvert}
                  className="w-full shrink-0 sm:w-auto"
                >
                  {isConverting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  {isConverting ? 'Convertendo...' : 'Iniciar Conversão'}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}