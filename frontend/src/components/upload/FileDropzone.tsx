import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDropzone, type DropEvent, type FileRejection } from 'react-dropzone'
import { RotateCcw, Upload, X } from 'lucide-react'
import { cn, formatFileSize, getFileExtension } from '../../utils/helpers'
import { Button } from '../ui/Button'
import { Alert } from '../ui/Alert'
import type { FileItem } from '../../types'

/**
 * Le os arquivos de um drop de forma sincrona: o `DataTransfer` so permanece
 * acessivel durante o handler do evento. Qualquer `await` antes da leitura faz
 * o Chromium invalidar os itens (react-dropzone#1427) e o drop chega vazio.
 */
function readDroppedFiles(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer) return []

  try {
    const files = Array.from(dataTransfer.files ?? [])
    if (files.length > 0) return files
  } catch {
    // Em alguns cenarios `files` pode estar inacessivel; tenta os itens abaixo.
  }

  try {
    return Array.from(dataTransfer.items ?? [])
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null)
  } catch {
    return []
  }
}

interface FileDropzoneProps {
  onFilesAdd: (files: FileItem[]) => void
  /** Extensoes suportadas; usado apenas na validacao por extensao. */
  accept?: Record<string, string[]>
  maxFileSize?: number
  disabled?: boolean
}

export function FileDropzone({
  onFilesAdd,
  accept,
  maxFileSize = 500 * 1024 * 1024,
  disabled = false,
}: FileDropzoneProps) {
  const [rejectedFiles, setRejectedFiles] = useState<{ file: File; reason: string }[]>([])

  const acceptedExtensions = useMemo(
    () =>
      new Set(
        (accept ? Object.values(accept).flat() : []).map((extension) =>
          // `getFileExtension` devolve a extensao sem o ponto (`png`), entao a
          // allowlist e normalizada da mesma forma antes da comparacao.
          extension.replace(/^\./, '').toLowerCase(),
        ),
      ),
    [accept],
  )

  const clearRejectedFiles = useCallback(() => setRejectedFiles([]), [])

  /**
   * A allowlist do backend e por extensao. A validacao fica fora do
   * react-dropzone para nao depender do MIME informado pelo Windows nem de
   * conflitos entre `accept`, `validator` e o input nativo.
   */
  const isSupportedFile = useCallback(
    (file: File) => {
      if (!file.name) return false

      const extension = getFileExtension(file.name)
      return acceptedExtensions.size === 0 || acceptedExtensions.has(extension)
    },
    [acceptedExtensions],
  )

  /**
   * Valida e encaminha um unico arquivo. Compartilhada entre o seletor nativo
   * (via `onDrop` do react-dropzone) e o listener nativo de `drop`.
   * Uma selecao com mais de um arquivo e rejeitada por inteiro.
   */
  const processFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return

      if (files.length > 1) {
        setRejectedFiles(
          files.map((file) => ({
            file,
            reason: 'Envie apenas 1 arquivo por vez. Nenhum arquivo foi adicionado.',
          })),
        )
        return
      }

      const [file] = files

      if (file.size > maxFileSize) {
        setRejectedFiles([
          {
            file,
            reason: `Arquivo maior que o limite de ${formatFileSize(maxFileSize)}.`,
          },
        ])
        return
      }

      if (!isSupportedFile(file)) {
        setRejectedFiles([{ file, reason: 'Formato não suportado.' }])
        return
      }

      setRejectedFiles([])
      onFilesAdd([
        {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          extension: getFileExtension(file.name),
          status: 'pending',
          progress: 0,
        },
      ])
    },
    [isSupportedFile, maxFileSize, onFilesAdd],
  )

  /**
   * Indica que o drop ja foi tratado pelo listener nativo. O `onDrop` do
   * react-dropzone roda no mesmo ciclo do evento; o flag e liberado no proximo
   * macrotask para nao bloquear um drop seguinte.
   */
  const dropHandledRef = useRef(false)

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      // Evita adicionar o mesmo drop duas vezes.
      if (dropHandledRef.current) return

      // Recombina aceitos e rejeitados pelo react-dropzone para validar a
      // selecao original como um todo. Assim, soltar 2 arquivos nunca deixa
      // um deles ser adicionado sozinho.
      processFiles([...accepted, ...rejected.map(({ file }) => file)])
    },
    [processFiles],
  )

  /**
   * O `file-selector` 2.1.2 (dependencia do `react-dropzone` 14.4.1) aguarda
   * `getAsFileSystemHandle()` antes de ler `getAsFile()`. No Chromium/Windows
   * esse await "neutraliza" o DataTransferItem e o drop se perde antes de
   * chegar ao `onDrop` (react-dropzone#1435). Lendo os arquivos de forma
   * sincrona, o `onDrop` sempre recebe o que foi solto. O input nativo
   * continua sem `accept` para o seletor do sistema mostrar todos os arquivos.
   */
  const getFilesFromEvent = useCallback(
    (event: DropEvent): Promise<Array<File | DataTransferItem>> => {
      if (Array.isArray(event)) {
        return Promise.all(event.map((handle) => handle.getFile()))
      }

      const target = event.target as HTMLInputElement | null
      if (target?.files?.length) {
        return Promise.resolve(Array.from(target.files))
      }

      const dataTransfer = (event as DragEvent).dataTransfer
      if (!dataTransfer) return Promise.resolve([])

      // Em drops, `files` ja traz os arquivos e pode ser lido antes de qualquer
      // await; e o caminho que evita a regressao do file-selector.
      if (dataTransfer.files?.length) {
        return Promise.resolve(Array.from(dataTransfer.files))
      }

      const items = Array.from(dataTransfer.items ?? []).filter((item) => item.kind === 'file')

      // Durante o arrasto o browser expoe DataTransferItem (nao File); devolve
      // os itens para o react-dropzone calcular isDragAccept/isDragReject.
      if ((event as DragEvent).type !== 'drop') {
        return Promise.resolve(items)
      }

      // Fallback sincrono para drops sem `dataTransfer.files`.
      return Promise.resolve(
        items.map((item) => item.getAsFile()).filter((file): file is File => file !== null),
      )
    },
    [],
  )

  const { getRootProps, getInputProps, isDragActive, isDragReject, rootRef } = useDropzone({
    onDrop,
    onDragEnter: clearRejectedFiles,
    getFilesFromEvent,
    // O react-dropzone nao recebe accept nem validator. O filtro nativo e o
    // validador customizado foram removidos para evitar que o dialogo/evento
    // de drop rejeite arquivos suportados. A allowlist e aplicada em
    // processFiles. O limite de 1 arquivo tambem e reforcado nessa funcao.
    multiple: false,
    maxFiles: 1,
    maxSize: maxFileSize,
    disabled,
    noClick: false,
    noKeyboard: false,
    // Usa o input nativo, sem accept, para o dialogo do sistema mostrar todos
    // os arquivos. A filtragem por extensao e feita no onDrop.
    useFsAccessApi: false,
  })

  // Mantem a referencia mais recente sem reagendar os listeners a cada render.
  const processFilesRef = useRef(processFiles)
  useEffect(() => {
    processFilesRef.current = processFiles
  }, [processFiles])

  /**
   * O `onDrop` do react-dropzone so processa o evento quando `isEvtWithFiles`
   * encontra "Files" em `dataTransfer.types`. No Chromium/Windows esse `types`
   * pode chegar vazio ou sem "Files" durante o arrasto (react-dropzone#1409),
   * e o drop nunca chega a biblioteca.
   *
   * Pior: nesse mesmo navegador o `dragover` precisa ser cancelado de forma
   * incondicional. Se o `default` nao for prevenido, o proprio Chromium suprime
   * o evento `drop` (comportamento estrito no Windows; o macOS e permissivo).
   * Por isso o drop e lido nativamente no elemento, com `preventDefault` sem
   * condicionais e leitura sincrona de `dataTransfer.files`.
   */
  useEffect(() => {
    const node = rootRef.current
    if (!node || disabled) return

    const handleDragEvent = (event: DragEvent) => {
      // Nao filtra por `dataTransfer.types`: para arquivos ele pode vir
      // incompleto no Windows. Sempre cancelar e o que garante o `drop`.
      event.preventDefault()

      if (event.dataTransfer) {
        try {
          event.dataTransfer.dropEffect = 'copy'
        } catch {
          // Alguns navegadores bloqueiam a escrita do dropEffect.
        }
      }
    }

    const handleDrop = (event: DragEvent) => {
      // Cancela o comportamento padrao antes de qualquer leitura: se o
      // navegador abrir o arquivo, o drop ja se perdeu.
      event.preventDefault()

      const files = readDroppedFiles(event.dataTransfer)
      if (files.length === 0) return

      dropHandledRef.current = true
      processFilesRef.current(files)
      setTimeout(() => {
        dropHandledRef.current = false
      }, 0)
    }

    node.addEventListener('dragenter', handleDragEvent)
    node.addEventListener('dragover', handleDragEvent)
    node.addEventListener('drop', handleDrop)

    return () => {
      node.removeEventListener('dragenter', handleDragEvent)
      node.removeEventListener('dragover', handleDragEvent)
      node.removeEventListener('drop', handleDrop)
    }
  }, [rootRef, disabled])

  /**
   * O input nativo fica sem accept. O filtro de extensoes do Windows/Edge
   * escondia arquivos suportados; a validacao continua no onDrop acima.
   */
  const inputProps = getInputProps()

  const heading = disabled
    ? 'Adição indisponível no momento'
    : isDragActive
      ? 'Solte o arquivo aqui'
      : 'Arraste ou clique para adicionar um arquivo'

  const helperText = disabled
    ? 'Aguarde a operação atual.'
    : `1 arquivo por vez · ${formatFileSize(maxFileSize)}`

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          'group relative flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center transition-colors',
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

        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-gray-900">{heading}</p>
          <p className="mt-0.5 text-[11px] leading-4 text-gray-500">{helperText}</p>
        </div>
      </div>

      {rejectedFiles.length > 0 && (
        <Alert variant="error" title="Seleção não aceita">
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
