import { useEffect, useRef, useState } from 'react'
import { Trash2, Play, CheckCircle, AlertCircle } from 'lucide-react'
import { cn, formatFileSize, sanitizeFileName } from '../../utils/helpers'
import { useUpload } from '../../hooks/useConversions'
import { Button } from '../ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Select } from '../ui/Select'
import { Progress } from '../ui/Progress'
import { FileDropzone, FileList } from './FileDropzone'
import type { FileItem, RejectedFile } from '../../types'

const SUPPORTED_FORMATS: Record<string, string[]> = {
  pdf: ['docx', 'txt', 'html', 'png', 'jpg'],
  docx: ['pdf', 'txt', 'html', 'odt'],
  doc: ['pdf', 'docx', 'txt', 'html', 'odt'],
  xlsx: ['pdf', 'csv', 'html', 'ods'],
  xls: ['pdf', 'xlsx', 'csv', 'html', 'ods'],
  pptx: ['pdf', 'html', 'odp'],
  ppt: ['pdf', 'pptx', 'html', 'odp'],
  txt: ['pdf', 'docx', 'md', 'html'],
  md: ['pdf', 'html', 'docx', 'txt'],
  rtf: ['pdf', 'docx', 'txt', 'html'],
  odt: ['pdf', 'docx', 'txt', 'html'],
  ods: ['pdf', 'xlsx', 'csv', 'html'],
  odp: ['pdf', 'pptx', 'html'],
  jpg: ['png', 'webp', 'avif', 'pdf'],
  jpeg: ['png', 'webp', 'avif', 'pdf'],
  png: ['jpg', 'webp', 'avif', 'pdf'],
  webp: ['jpg', 'png', 'avif', 'pdf'],
  avif: ['jpg', 'png', 'webp', 'pdf'],
  gif: ['png', 'webp', 'jpg'],
  svg: ['png', 'jpg', 'webp', 'pdf'],
  tiff: ['jpg', 'png', 'webp', 'pdf'],
  bmp: ['jpg', 'png', 'webp'],
  heic: ['jpg', 'png', 'webp'],
  mp3: ['wav', 'ogg', 'flac', 'aac'],
  wav: ['mp3', 'ogg', 'flac', 'aac'],
  flac: ['mp3', 'wav', 'ogg', 'aac'],
  ogg: ['mp3', 'wav', 'flac', 'aac'],
  aac: ['mp3', 'wav', 'ogg', 'flac'],
  m4a: ['mp3', 'wav', 'ogg', 'flac'],
  opus: ['mp3', 'wav', 'ogg', 'flac'],
  mp4: ['webm', 'mov', 'gif'],
  webm: ['mp4', 'mov', 'gif'],
  mov: ['mp4', 'webm', 'gif'],
  avi: ['mp4', 'webm', 'mov'],
  mkv: ['mp4', 'webm', 'mov'],
  flv: ['mp4', 'webm', 'mov'],
  zip: ['tar', 'gz'],
  tar: ['zip', 'gz'],
  gz: ['zip', 'tar'],
  rar: ['zip', 'tar'],
  '7z': ['zip', 'tar'],
}

const MAX_FILES = 50

export function BatchManager({ onStartConversion }: { onStartConversion?: (files: FileItem[], outputFormat: string) => void }) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [globalFormat, setGlobalFormat] = useState<string>('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const uploadMutation = useUpload()
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

    const accepted = newFiles.slice(0, remaining)
    setFiles((prev) => [...prev, ...accepted])

    if (newFiles.length > accepted.length) {
      setNotice({
        type: 'error',
        text: `Apenas ${accepted.length} arquivo(s) adicionado(s): o limite é ${MAX_FILES} por sessão.`,
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
    setGlobalFormat('')
    setUploadProgress(0)
    setNotice(null)
  }

  const handleFormatChange = (id: string, format: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, outputFormat: format } : f)))
  }

  const handleGlobalFormatChange = (format: string) => {
    setGlobalFormat(format)
    setFiles((prev) => prev.map((f) => ({ ...f, outputFormat: format })))
  }

  const handleStart = () => {
    if (!onStartConversion) return
    const validFiles = files.filter((f) => f.outputFormat && f.status !== 'error')
    if (validFiles.length === 0) return
    onStartConversion(validFiles, globalFormat)
  }

  const canConvert = files.some((f) => f.outputFormat && f.status !== 'error' && f.status !== 'converting')

  const uploadedCount = files.filter((f) => f.status === 'uploaded').length
  const errorCount = files.filter((f) => f.status === 'error').length
  const totalSize = files.reduce((acc, f) => acc + f.size, 0)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Conversão em Lote</CardTitle>
        </CardHeader>
        <CardContent>
          <FileDropzone
            onFilesAdd={handleFilesAdd}
            disabled={isUploading || files.length >= MAX_FILES}
            maxFiles={Math.max(1, MAX_FILES - files.length)}
            acceptedFiles={Object.fromEntries(
              Object.entries(SUPPORTED_FORMATS).map(([ext, formats]) => [`.${ext}`, formats])
            )}
          />

          <FileList
            files={files}
            onRemove={handleRemove}
            onRetry={handleRetry}
            onFormatChange={handleFormatChange}
            availableFormats={SUPPORTED_FORMATS}
            uploading={isUploading}
          />

          {files.length > 0 && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{files.length} arquivo(s)</span>
                  <span>{formatFileSize(totalSize)}</span>
                  <Badge variant="success">{uploadedCount} enviado(s)</Badge>
                  {errorCount > 0 && <Badge variant="error">{errorCount} com erro</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={globalFormat}
                    onChange={(e) => handleGlobalFormatChange(e.target.value)}
                    options={getCommonFormats(files)}
                    placeholder="Aplicar a todos..."
                    disabled={isUploading}
                    className="w-48"
                  />
                </div>
              </div>

              {isUploading && (
                <div className="flex items-center gap-3">
                  <Progress value={uploadProgress} className="flex-1" />
                  <span className="text-sm text-gray-500 w-12 text-right">{uploadProgress}%</span>
                </div>
              )}

              {notice && (
                <div
                  className={cn(
                    'flex items-start gap-2 rounded-lg border p-3 text-sm',
                    notice.type === 'success'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-red-200 bg-red-50 text-red-700',
                  )}
                >
                  {notice.type === 'success' ? (
                    <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  )}
                  <span>{notice.text}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <Button variant="outline" onClick={handleClearAll} disabled={isUploading || files.length === 0}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar tudo
                </Button>
                <Button
                  onClick={handleStart}
                  disabled={isUploading || !canConvert || !onStartConversion}
                  title={!onStartConversion ? 'Conversão ainda não disponível' : undefined}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Iniciar Conversão
                </Button>
              </div>

              {!onStartConversion && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    A conversão ainda não está disponível: a rota de conversão do servidor responde
                    <span className="font-medium"> 501 Not Implemented</span>. Os arquivos acima já
                    foram enviados e ficam listados; o botão será habilitado quando o processamento
                    existir no backend.
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function getCommonFormats(files: FileItem[]): Array<{ value: string; label: string }> {
  if (files.length === 0) return []
  
  const firstFile = files[0]
  const formats = SUPPORTED_FORMATS[firstFile.extension] || []
  
  if (files.length === 1) {
    return formats.map((f) => ({ value: f, label: f.toUpperCase() }))
  }

  const commonFormats = files.slice(1).reduce((acc, file) => {
    const fileFormats = SUPPORTED_FORMATS[file.extension] || []
    return acc.filter((f) => fileFormats.includes(f))
  }, formats)

  return commonFormats.map((f) => ({ value: f, label: f.toUpperCase() }))
}