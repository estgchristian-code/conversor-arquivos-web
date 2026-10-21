import { useCallback, useState } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { RotateCcw, Upload, X } from 'lucide-react'
import { cn, formatFileSize, getFileExtension } from '../../utils/helpers'
import { Button } from '../ui/Button'
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
    multiple: true,
    maxFiles,
    maxSize: maxFileSize,
    disabled,
    noClick: false,
    noKeyboard: false,
    // Usa o input nativo. O seletor de arquivos do sistema lida melhor com
    // extensoes do que com o mapa MIME usado internamente pelo react-dropzone.
    useFsAccessApi: false,
  })

  /**
   * No Windows, um accept com varios MIME types pode deixar o filtro nativo
   * sem os arquivos esperados (sobram apenas as pastas). Para o seletor do
   * sistema, envia somente as extensoes suportadas; o react-dropzone continua
   * validando o mapa MIME/extensoes nos drops e na selecao.
   */
  const nativeAccept = accept ? Object.values(accept).flat().join(',') : undefined
  const inputProps = getInputProps(nativeAccept ? { accept: nativeAccept } : undefined)

  const heading = disabled
    ? 'Adição indisponível no momento'
    : isDragActive
      ? 'Solte os arquivos aqui'
      : compact
        ? 'Adicionar mais arquivos'
        : 'Arraste ou clique para adicionar arquivos'

  const helperText = disabled
    ? 'Aguarde a operação atual.'
    : compact
      ? `${formatFileSize(maxFileSize)} por arquivo`
      : `Até ${maxFiles} arquivos · ${formatFileSize(maxFileSize)} cada`

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          'group relative flex rounded-xl border border-dashed transition-colors',
          compact
            ? 'min-h-[64px] items-center gap-3 px-4 py-3'
            : 'min-h-[180px] flex-col items-center justify-center gap-2 px-6 py-8 text-center',
          !disabled && 'cursor-pointer',
          isDragActive
            ? 'border-primary-400 bg-primary-50/80'
            : isDragReject
              ? 'border-red-300 bg-red-50/70'
              : 'border-gray-300 bg-gray-50/40 hover:border-primary-300 hover:bg-primary-50/30',
          disabled && 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-70',
        )}
      >
        <input {...inputProps} />

        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-600">
          <Upload className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className={cn('min-w-0', compact && 'flex-1 text-left')}>
          <p className="truncate text-[13px] font-semibold text-gray-900">{heading}</p>
          <p className="mt-0.5 text-[11px] leading-4 text-gray-500">{helperText}</p>
        </div>
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

export function FileList({ files, onRemove, onRetry, uploading }: FileListProps) {
  if (files.length === 0) return null

  return (
    <ul className="divide-y divide-gray-100">
      {files.map((fileItem) => {
        const statusText =
          fileItem.status === 'pending'
            ? 'Aguardando...'
            : fileItem.status === 'uploading'
              ? 'Enviando...'
              : fileItem.status === 'converting'
                ? 'Convertendo...'
                : null

        return (
          <li key={fileItem.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-gray-900" title={fileItem.name}>
                {fileItem.name}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-4 text-gray-500">
                <span className="numeric">{formatFileSize(fileItem.size)}</span>
                {statusText && <span>{statusText}</span>}
                {fileItem.error && <span className="text-red-600">{fileItem.error}</span>}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {fileItem.status === 'error' && onRetry && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
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
                className="h-8 w-8"
                onClick={() => onRemove(fileItem.id)}
                disabled={uploading || fileItem.status === 'converting'}
                aria-label={`Remover ${fileItem.name}`}
                title="Remover arquivo"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
