import { useCallback, useState } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import {
  Upload,
  X,
  FileText,
  FileSpreadsheet,
  FileImage,
  Music,
  Video,
  Archive,
  AlertCircle,
  RotateCcw,
} from 'lucide-react'
import { cn, formatFileSize, getFileExtension } from '../../utils/helpers'
import { Button } from '../ui/Button'
import { Progress } from '../ui/Progress'
import { Badge } from '../ui/Badge'
import type { FileItem } from '../../types'

interface FileDropzoneProps {
  onFilesAdd: (files: FileItem[]) => void
  acceptedFiles?: Record<string, string[]>
  inputFormat?: string
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
  png: FileImage,
  webp: FileImage,
  avif: FileImage,
  gif: FileImage,
  svg: FileImage,
  tiff: FileImage,
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
  acceptedFiles,
  inputFormat = '',
  maxFiles = 50,
  maxFileSize = 500 * 1024 * 1024,
  disabled = false,
  compact = false,
}: FileDropzoneProps) {
  const [rejectedFiles, setRejectedFiles] = useState<{ file: File; reason: string }[]>([])

  const formatLabel = inputFormat ? inputFormat.toUpperCase() : ''

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
            ? `Formato incompatível com .${formatLabel || '…'}.`
            : errors.map((error) => error.message).join(', '),
        })),
      )
    },
    [onFilesAdd, formatLabel],
  )

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: acceptedFiles,
    maxFiles,
    maxSize: maxFileSize,
    disabled,
    noClick: false,
    noKeyboard: false,
  })

  const dropMessage = isDragActive
    ? formatLabel
      ? `Solte os arquivos ${formatLabel} aqui`
      : 'Solte os arquivos aqui'
    : formatLabel
    ? `Arraste arquivos ${formatLabel} aqui ou clique para selecionar`
    : 'Arraste os arquivos até aqui ou clique para selecionar'

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'relative flex items-center rounded-xl border-2 border-dashed transition-colors duration-150 ease-out',
          compact
            ? 'min-h-[72px] gap-3 px-4 py-3'
            : 'min-h-[280px] flex-col justify-center gap-3 px-6 py-12 text-center',
          !disabled && 'cursor-pointer',
          isDragActive
            ? 'border-primary-600 bg-primary-50'
            : isDragReject
            ? 'border-red-400 bg-red-50'
            : 'border-gray-300 bg-white hover:border-primary-400 hover:bg-primary-50/40',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <input {...getInputProps()} />

        <Upload className={cn('shrink-0 text-gray-400', compact ? 'h-5 w-5' : 'h-6 w-6')} />

        {compact ? (
          <p className="min-w-0 flex-1 truncate text-sm text-gray-500">
            {formatLabel
              ? `Arraste mais arquivos ${formatLabel} aqui ou clique para adicionar`
              : 'Arraste mais arquivos aqui ou clique para adicionar'}
          </p>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-900">{dropMessage}</p>
            <p className="text-[13px] leading-[18px] text-gray-500">
              {formatLabel
                ? `Somente arquivos .${formatLabel} serão aceitos`
                : 'Selecione o formato dos arquivos para habilitar o envio'}
            </p>
            <p className="numeric text-xs text-gray-500">
              Até {maxFiles} arquivos · {formatFileSize(maxFileSize)} por arquivo
            </p>
          </>
        )}
      </div>

      {rejectedFiles.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            Arquivos não aceitos
          </div>
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {rejectedFiles.map(({ file, reason }, index) => (
              <li key={index} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-xs">
                <span className="truncate font-medium text-red-700">{file.name}</span>
                <span className="text-red-600">{reason}</span>
              </li>
            ))}
          </ul>
        </div>
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
  return <Icon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
}

export function FileList({ files, onRemove, onRetry, uploading }: FileListProps) {
  if (files.length === 0) return null

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="divide-y divide-gray-200">
        {files.map((fileItem) => {
          const busy = fileItem.status === 'uploading' || fileItem.status === 'converting'

          // O envio termina em 100%: a partir daí o arquivo não está mais "Enviando".
          const uploadDone = fileItem.progress >= 100 && fileItem.status !== 'error'
          const displayStatus = uploadDone ? 'uploaded' : fileItem.status
          const showProgress = fileItem.progress > 0 || busy

          return (
            <div key={fileItem.id} className="px-4 py-3 transition-colors duration-150 hover:bg-gray-50">
              {/* Linha principal: nome + status + ações */}
              <div className="flex items-center gap-3">
                <FileIcon extension={fileItem.extension} />

                <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900" title={fileItem.name}>
                  {fileItem.name}
                </p>

                <Badge variant={statusVariant(displayStatus)} className="shrink-0">
                  {STATUS_LABEL[displayStatus]}
                </Badge>

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

              {/* Linha secundária: metadados, erro e progresso */}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2 pl-7 text-xs text-gray-500">
                <span className="numeric font-medium uppercase text-gray-500">{fileItem.extension}</span>
                <span className="numeric">{formatFileSize(fileItem.size)}</span>

                {fileItem.error && <span className="text-red-600">{fileItem.error}</span>}

                {showProgress && (
                  <div className="flex min-w-[120px] flex-1 items-center gap-2 sm:max-w-[220px]">
                    <Progress
                      value={fileItem.progress}
                      size="sm"
                      tone={uploadDone ? 'success' : 'accent'}
                    />
                    <span className="numeric w-9 shrink-0 text-right">{Math.round(fileItem.progress)}%</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}