import { useCallback, useState } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import {
  Archive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Music,
  RotateCcw,
  Upload,
  Video,
  X,
} from 'lucide-react'
import { cn, formatFileSize, getFileExtension } from '../../utils/helpers'
import { Button } from '../ui/Button'
import { Progress } from '../ui/Progress'
import { Badge } from '../ui/Badge'
import { Alert } from '../ui/Alert'
import type { FileItem } from '../../types'

interface FileDropzoneProps {
  onFilesAdd: (files: FileItem[]) => void
  /** Dica de tipos para o seletor do navegador; a validacao real usa a extensao. */
  accept?: Record<string, string[]>
  maxFiles?: number
  maxFileSize?: number
  disabled?: boolean
  compact?: boolean
}

const FILE_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  rtf: FileText,
  odt: FileText,
  txt: FileText,
  md: FileText,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  ods: FileSpreadsheet,
  csv: FileSpreadsheet,
  ppt: FileText,
  pptx: FileText,
  odp: FileText,
  jpg: FileImage,
  jpeg: FileImage,
  jpe: FileImage,
  jfif: FileImage,
  png: FileImage,
  webp: FileImage,
  avif: FileImage,
  gif: FileImage,
  svg: FileImage,
  tiff: FileImage,
  tif: FileImage,
  bmp: FileImage,
  heic: FileImage,
  mp3: Music,
  wav: Music,
  flac: Music,
  ogg: Music,
  aac: Music,
  m4a: Music,
  opus: Music,
  mp4: Video,
  webm: Video,
  mov: Video,
  avi: Video,
  mkv: Video,
  flv: Video,
  zip: Archive,
  tar: Archive,
  gz: Archive,
  rar: Archive,
  '7z': Archive,
}

const STATUS_LABEL: Record<FileItem['status'], string> = {
  pending: 'Aguardando',
  uploading: 'Enviando',
  uploaded: 'Enviado',
  converting: 'Convertendo',
  completed: 'Concluído',
  error: 'Falhou',
}

function statusVariant(status: FileItem['status']) {
  if (status === 'completed' || status === 'uploaded') return 'success' as const
  if (status === 'error') return 'error' as const
  if (status === 'converting' || status === 'uploading') return 'info' as const
  return 'secondary' as const
}

export function FileDropzone({
  onFilesAdd,
  accept,
  maxFiles = 50,
  maxFileSize = 500 * 1024 * 1024,
  disabled = false,
  compact = false,
}: FileDropzoneProps) {
  const [rejectedFiles, setRejectedFiles] = useState<{ file: File; reason: string }[]>([])

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      if (accepted.length > 0) {
        const fileItems: FileItem[] = accepted.map((file) => ({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          extension: getFileExtension(file.name),
          status: 'pending',
          progress: 0,
        }))
        onFilesAdd(fileItems)
      }

      setRejectedFiles(
        rejected.map(({ file, errors }) => ({
          file,
          reason: errors.some((error) => error.code === 'file-invalid-type')
            ? 'Formato não suportado.'
            : errors.map((error) => error.message).join(', '),
        })),
      )
    },
    [onFilesAdd],
  )

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    maxSize: maxFileSize,
    disabled,
    noClick: false,
    noKeyboard: false,
  })

  const heading = disabled
    ? 'Envio indisponível no momento'
    : isDragActive
      ? 'Solte os arquivos aqui'
      : compact
        ? 'Arraste mais arquivos ou clique para adicionar'
        : 'Arraste os arquivos até aqui ou clique para selecionar'

  const helperText = disabled
    ? 'Aguarde a operação atual ou verifique o limite de arquivos.'
    : compact
      ? 'O formato é identificado pela extensão.'
      : 'O formato é identificado pela extensão e o conteúdo é validado no servidor.'

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'group relative flex rounded-xl border border-dashed transition-all duration-150',
          compact
            ? 'min-h-[76px] items-center gap-3.5 px-4 py-3.5'
            : 'min-h-[280px] flex-col items-center justify-center gap-3 px-6 py-10 text-center',
          !disabled && 'cursor-pointer',
          isDragActive
            ? 'border-primary-400 bg-primary-50/80 ring-4 ring-primary-100'
            : isDragReject
              ? 'border-red-300 bg-red-50/80 ring-4 ring-red-100'
              : 'border-gray-300 bg-gray-50/40 hover:border-primary-300 hover:bg-primary-50/30',
          disabled &&
            'cursor-not-allowed border-gray-200 bg-gray-50 opacity-75 hover:border-gray-200 hover:bg-gray-50',
        )}
      >
        <input {...getInputProps()} />

        <span
          className={cn(
            'grid shrink-0 place-items-center rounded-xl ring-1 ring-inset transition-colors',
            compact ? 'h-10 w-10' : 'h-14 w-14',
            isDragActive
              ? 'bg-white text-primary-600 ring-primary-200'
              : 'bg-white text-primary-500 ring-gray-200 group-hover:text-primary-600',
          )}
        >
          <Upload className={compact ? 'h-5 w-5' : 'h-6 w-6'} aria-hidden="true" />
        </span>

        <div className={cn('min-w-0', compact ? 'flex-1 text-left' : 'max-w-md')}>
          <p
            className={cn(
              'font-semibold text-gray-900',
              compact ? 'truncate text-[13px]' : 'text-balance text-[15px]',
            )}
          >
            {heading}
          </p>
          <p className={cn('mt-1 text-gray-500', compact ? 'text-[11px] leading-4' : 'text-[12px] leading-5')}>
            {helperText}
          </p>
        </div>

        {!compact && (
          <p className="numeric text-[11px] text-gray-400">
            Até {maxFiles} arquivos · {formatFileSize(maxFileSize)} por arquivo
          </p>
        )}

        {compact && (
          <span className="hidden shrink-0 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 sm:inline-flex">
            Adicionar
          </span>
        )}
      </div>

      {rejectedFiles.length > 0 && (
        <Alert variant="error" title="Arquivos não aceitos">
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {rejectedFiles.map(({ file, reason }, index) => (
              <li key={index} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span className="truncate font-medium">{file.name}</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </Alert>
      )}
    </div>
  )
}

interface FileListProps {
  files: FileItem[]
  onRemove: (id: string) => void
  onRetry?: (id: string) => void
  uploading?: boolean
}

function FileIcon({ extension }: { extension: string }) {
  const Icon = FILE_TYPE_ICONS[extension.toLowerCase()] || FileText
  return <Icon className="h-5 w-5" aria-hidden="true" />
}

export function FileList({ files, onRemove, onRetry, uploading }: FileListProps) {
  if (files.length === 0) return null

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <ul className="divide-y divide-gray-100">
        {files.map((fileItem) => {
          const busy = fileItem.status === 'uploading' || fileItem.status === 'converting'

          // O envio termina em 100%: a partir daí o arquivo não está mais "Enviando".
          const uploadDone = fileItem.progress >= 100 && fileItem.status !== 'error'
          const displayStatus = uploadDone ? 'uploaded' : fileItem.status
          const showProgress = fileItem.progress > 0 || busy

          return (
            <li
              key={fileItem.id}
              className="px-4 py-3.5 transition-colors duration-150 hover:bg-gray-50/70"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-gray-200 bg-gray-50 text-gray-400">
                  <FileIcon extension={fileItem.extension} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-[13px] font-medium text-gray-900" title={fileItem.name}>
                      {fileItem.name}
                    </p>
                    <Badge variant={statusVariant(displayStatus)} className="shrink-0">
                      {STATUS_LABEL[displayStatus]}
                    </Badge>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-4 text-gray-500">
                    <span className="numeric font-semibold uppercase text-gray-400">{fileItem.extension}</span>
                    <span className="numeric">{formatFileSize(fileItem.size)}</span>
                    {fileItem.error && <span className="text-red-600">{fileItem.error}</span>}
                  </div>

                  {showProgress && (
                    <div className="mt-2 flex items-center gap-2.5">
                      <Progress
                        value={fileItem.progress}
                        size="sm"
                        tone={uploadDone ? 'success' : 'accent'}
                        className="max-w-[220px]"
                      />
                      <span className="numeric w-9 shrink-0 text-right text-[11px] text-gray-500">
                        {Math.round(fileItem.progress)}%
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {fileItem.status === 'error' && onRetry && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRetry(fileItem.id)}
                      disabled={uploading}
                      aria-label="Tentar novamente"
                      title="Tentar novamente"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(fileItem.id)}
                    disabled={uploading || fileItem.status === 'converting'}
                    aria-label={`Remover ${fileItem.name}`}
                    title="Remover arquivo"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
