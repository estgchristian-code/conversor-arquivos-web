'use client'

import { useCallback, useState, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, FileText, Image, Music, Video, Archive, AlertCircle, CheckCircle } from 'lucide-react'
import { cn, formatFileSize, getFileExtension } from '../../utils/helpers'
import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { Progress } from '../ui/Progress'
import { Badge } from '../ui/Badge'
import type { FileItem } from '../../types'

interface FileDropzoneProps {
  onFilesAdd: (files: FileItem[]) => void
  acceptedFiles?: Record<string, string[]>
  maxFiles?: number
  maxFileSize?: number
  disabled?: boolean
}

const FILE_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  xls: FileText,
  xlsx: FileText,
  ppt: FileText,
  pptx: FileText,
  txt: FileText,
  md: FileText,
  jpg: Image,
  jpeg: Image,
  png: Image,
  webp: Image,
  gif: Image,
  svg: Image,
  mp3: Music,
  wav: Music,
  flac: Music,
  ogg: Music,
  mp4: Video,
  webm: Video,
  mov: Video,
  avi: Video,
  mkv: Video,
  zip: Archive,
  tar: Archive,
  gz: Archive,
  rar: Archive,
  '7z': Archive,
}

export function FileDropzone({
  onFilesAdd,
  acceptedFiles,
  maxFiles = 50,
  maxFileSize = 500 * 1024 * 1024,
  disabled = false,
}: FileDropzoneProps) {
  const [rejectedFiles, setRejectedFiles] = useState<{ file: File; reason: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onDrop = useCallback(
    (accepted: File[], rejected: { file: File; errors: Array<{ code: string; message: string }> }[]) => {
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

      if (rejected.length > 0) {
        setRejectedFiles(
          rejected.map(({ file, errors }) => ({
            file,
            reason: errors.map((e) => e.message).join(', '),
          }))
        )
      }
    },
    [onFilesAdd]
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

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 text-center transition-all',
          'cursor-pointer',
          isDragActive
            ? 'border-primary-500 bg-primary-50'
            : isDragReject
            ? 'border-red-500 bg-red-50'
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label="Área de upload de arquivos"
      >
        <input {...getInputProps()} ref={fileInputRef} />
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-3 text-lg font-medium text-gray-900">
          {isDragActive ? 'Solte os arquivos aqui' : 'Arraste e solte arquivos ou clique para selecionar'}
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Suporta documentos, imagens, áudio, vídeo e arquivos compactados
        </p>
        <p className="mt-2 text-xs text-gray-400">
          Máximo {maxFiles} arquivos • Até {formatFileSize(maxFileSize)} cada
        </p>
      </div>

      {rejectedFiles.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-700 mb-2">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Arquivos rejeitados</span>
          </div>
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {rejectedFiles.map(({ file, reason }, index) => (
              <li key={index} className="flex items-center justify-between text-sm">
                <span className="text-red-600">{file.name}</span>
                <span className="text-red-500">{reason}</span>
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
  onFormatChange?: (id: string, format: string) => void
  availableFormats?: Record<string, string[]>
  uploading?: boolean
}

function FileIcon({ extension }: { extension: string }) {
  const Icon = FILE_TYPE_ICONS[extension.toLowerCase()] || FileText
  return <Icon className="h-5 w-5 text-gray-400" />
}

export function FileList({ files, onRemove, onRetry, onFormatChange, availableFormats, uploading }: FileListProps) {
  if (files.length === 0) return null

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y divide-gray-200">
          {files.map((fileItem) => (
            <div key={fileItem.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
              <FileIcon extension={fileItem.extension} />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-gray-900">{fileItem.name}</p>
                  <Badge
                    variant={
                      fileItem.status === 'completed'
                        ? 'success'
                        : fileItem.status === 'error'
                        ? 'error'
                        : fileItem.status === 'converting' || fileItem.status === 'uploading'
                        ? 'info'
                        : 'secondary'
                    }
                  >
                    {fileItem.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-gray-500">{formatFileSize(fileItem.size)}</span>
                  {(fileItem.status === 'uploading' || fileItem.status === 'converting') && (
                    <Progress value={fileItem.progress} size="sm" className="w-32" />
                  )}
                  {fileItem.error && (
                    <span className="text-sm text-red-600">{fileItem.error}</span>
                  )}
                </div>
              </div>

              {availableFormats && fileItem.status !== 'converting' && fileItem.status !== 'completed' && (
                <Select
                  value={fileItem.outputFormat || ''}
                  onChange={(e) => onFormatChange?.(fileItem.id, e.target.value)}
                  options={availableFormats[fileItem.extension]?.map((f) => ({ value: f, label: f })) || []}
                  placeholder="Formato de saída"
                  disabled={uploading}
                  className="w-40"
                />
              )}

              <div className="flex items-center gap-2">
                {fileItem.status === 'error' && onRetry && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRetry(fileItem.id)}
                    disabled={uploading}
                    aria-label="Tentar novamente"
                  >
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(fileItem.id)}
                  disabled={uploading || fileItem.status === 'converting'}
                  aria-label="Remover arquivo"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-red-600" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}