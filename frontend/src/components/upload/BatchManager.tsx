import { useState } from 'react'
import { Plus, Minus, ArrowUp, ArrowDown, Trash2, Play, Loader2 } from 'lucide-react'
import { cn, formatFileSize } from '../../utils/helpers'
import { Button } from '../ui/Button'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Select } from '../ui/Select'
import { Progress } from '../ui/Progress'
import { FileDropzone, FileList } from './FileDropzone'
import type { FileItem } from '../../types'

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

export function BatchManager({ onStartConversion }: { onStartConversion: (files: FileItem[], outputFormat: string) => void }) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [globalFormat, setGlobalFormat] = useState<string>('')
  const [isConverting, setIsConverting] = useState(false)

  const handleFilesAdd = (newFiles: FileItem[]) => {
    setFiles((prev) => [...prev, ...newFiles])
  }

  const handleRemove = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleFormatChange = (id: string, format: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, outputFormat: format } : f)))
  }

  const handleGlobalFormatChange = (format: string) => {
    setGlobalFormat(format)
    setFiles((prev) => prev.map((f) => ({ ...f, outputFormat: format })))
  }

  const handleStart = () => {
    const validFiles = files.filter((f) => f.outputFormat && f.status !== 'error')
    if (validFiles.length === 0) return
    setIsConverting(true)
    onStartConversion(validFiles, globalFormat)
  }

  const canConvert = files.some((f) => f.outputFormat && f.status !== 'error' && f.status !== 'converting')

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
            disabled={isConverting}
            acceptedFiles={Object.fromEntries(
              Object.entries(SUPPORTED_FORMATS).map(([ext, formats]) => [`.${ext}`, formats])
            )}
          />

          <FileList
            files={files}
            onRemove={handleRemove}
            onFormatChange={handleFormatChange}
            availableFormats={SUPPORTED_FORMATS}
            uploading={isConverting}
          />

          {files.length > 0 && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{files.length} arquivo(s)</span>
                  <span>{formatFileSize(totalSize)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={globalFormat}
                    onChange={(e) => handleGlobalFormatChange(e.target.value)}
                    options={getCommonFormats(files)}
                    placeholder="Aplicar a todos..."
                    disabled={isConverting}
                    className="w-48"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <Button variant="outline" onClick={() => setFiles([])} disabled={isConverting || files.length === 0}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar tudo
                </Button>
                <Button
                  onClick={handleStart}
                  disabled={isConverting || !canConvert}
                  className="group"
                >
                  {isConverting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Convertendo...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Iniciar Conversão
                    </>
                  )}
                </Button>
              </div>
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