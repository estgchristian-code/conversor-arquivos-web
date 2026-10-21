import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Download,
  FileImage,
  Files,
  History as HistoryIcon,
  Inbox,
  Palette,
  RefreshCw,
  RotateCcw,
  Server,
  SlidersHorizontal,
} from 'lucide-react'
import { Header } from './components/layout/Header'
import { Container } from './components/layout/Container'
import { MobileSidebar, Sidebar, type ApiStatus, type AppPage } from './components/layout/Sidebar'
import { BatchManager } from './components/upload/BatchManager'
import { useConversions, useHealthCheck, useDownloadFile } from './hooks/useConversions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './components/ui/Card'
import { Badge } from './components/ui/Badge'
import { Progress } from './components/ui/Progress'
import { Button } from './components/ui/Button'
import { Alert } from './components/ui/Alert'
import { PageHeader } from './components/ui/PageHeader'
import { cn, formatFileSize } from './utils/helpers'
import type { ConversionJob } from './types'

const HISTORY_PAGE_SIZE = 20

const STATUS_LABELS: Record<ConversionJob['status'], string> = {
  queued: 'Na fila',
  processing: 'Processando',
  completed: 'Concluído',
  partial: 'Parcial',
  failed: 'Falhou',
}

const STATUS_VARIANTS: Record<ConversionJob['status'], 'success' | 'error' | 'info' | 'warning' | 'secondary'> = {
  queued: 'secondary',
  processing: 'info',
  completed: 'success',
  partial: 'warning',
  failed: 'error',
}

const API_STATUS_UI: Record<ApiStatus, { label: string; hint: string; variant: 'secondary' | 'success' | 'error'; dot: string }> = {
  checking: {
    label: 'Verificando conexão',
    hint: 'A interface está consultando o endpoint de saúde da API.',
    variant: 'secondary',
    dot: 'bg-gray-400',
  },
  online: {
    label: 'Serviço operacional',
    hint: 'A API de conversão está respondendo normalmente.',
    variant: 'success',
    dot: 'bg-green-500',
  },
  offline: {
    label: 'Serviço indisponível',
    hint: 'Não foi possível contatar a API de conversão.',
    variant: 'error',
    dot: 'bg-red-500',
  },
}

function getJobFileCount(job: ConversionJob): number {
  if (job.inputFiles?.length) return job.inputFiles.length
  return job.fileIds?.length ?? 0
}

function getJobInputSize(job: ConversionJob): number | null {
  if (!job.inputFiles?.length) return null
  return job.inputFiles.reduce((total, file) => total + file.size, 0)
}

function canDownload(job: ConversionJob): boolean {
  return (job.status === 'completed' || job.status === 'partial') && Boolean(job.results?.length)
}

function UploadPage({ onStartConversion }: { onStartConversion?: () => void }) {
  return (
    <div>
      <PageHeader
        eyebrow="Conversão"
        title="Conversão em lote"
        description="Adicione os arquivos, escolha o formato de saída e converta."
      />
      <BatchManager onStartConversion={onStartConversion} />
    </div>
  )
}

interface StatCardProps {
  icon: typeof FileImage
  label: string
  value: number
  hint: string
  tone?: 'primary' | 'success' | 'error' | 'neutral'
}

function StatCard({ icon: Icon, label, value, hint, tone = 'primary' }: StatCardProps) {
  const tones = {
    primary: 'bg-primary-50 text-primary-600 ring-primary-100',
    success: 'bg-green-50 text-green-600 ring-green-100',
    error: 'bg-red-50 text-red-600 ring-red-100',
    neutral: 'bg-gray-100 text-gray-500 ring-gray-200',
  }

  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-gray-200/90 bg-white p-4 shadow-panel">
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg ring-1 ring-inset', tones[tone])}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[12px] font-medium text-gray-500">{label}</p>
        <p className="numeric text-[22px] font-semibold leading-7 text-gray-900">{value}</p>
        <p className="truncate text-[11px] text-gray-400">{hint}</p>
      </div>
    </div>
  )
}

function DownloadButtons({
  job,
  disabled,
  onDownload,
}: {
  job: ConversionJob
  disabled: boolean
  onDownload: (jobId: string, fileId: string, fileName: string) => void
}) {
  const results = job.results ?? []

  if (!canDownload(job) || results.length === 0) {
    return <span className="text-[12px] text-gray-300">—</span>
  }

  if (results.length === 1) {
    const result = results[0]
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onDownload(job.id, result.fileId, result.outputName)}
        aria-label={`Baixar ${result.outputName}`}
        title={`Baixar ${result.outputName}`}
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="max-w-[120px] truncate">{result.outputName}</span>
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {results.map((result) => (
        <Button
          key={result.fileId}
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={() => onDownload(job.id, result.fileId, result.outputName)}
          aria-label={`Baixar ${result.outputName}`}
          title={`Baixar ${result.outputName}`}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
        </Button>
      ))}
    </div>
  )
}

function HistoryPage({ onNavigateToUpload }: { onNavigateToUpload: () => void }) {
  const [page, setPage] = useState(1)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const { data: conversions, isLoading, isFetching, isError, error, refetch } = useConversions(page, HISTORY_PAGE_SIZE)
  const { mutate: downloadFile, isPending: isDownloading } = useDownloadFile()

  const handleDownload = (jobId: string, fileId: string, fileName: string) => {
    setActionMessage(null)
    downloadFile(
      { jobId, fileId },
      {
        onSuccess: (blob) => {
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = fileName
          document.body.appendChild(link)
          link.click()
          link.remove()
          URL.revokeObjectURL(url)
        },
        onError: (downloadError) => {
          setActionMessage({
            type: 'error',
            text: `Falha ao baixar "${fileName}": ${downloadError.message}`,
          })
        },
      },
    )
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader
          eyebrow="Histórico"
          title="Histórico de conversões"
          description="Acompanhamento e download das conversões realizadas."
        />
        <div className="grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-[86px] rounded-xl border border-gray-200 bg-white p-4 shadow-panel">
              <div className="h-3 w-24 rounded bg-gray-100" />
              <div className="mt-3 h-6 w-12 rounded bg-gray-100" />
              <div className="mt-2 h-2.5 w-20 rounded bg-gray-100" />
            </div>
          ))}
        </div>
        <Card className="mt-6">
          <CardContent className="p-5">
            <div className="animate-pulse space-y-3" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((item) => (
                <div key={item} className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-gray-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 rounded bg-gray-100" />
                    <div className="h-2.5 w-1/5 rounded bg-gray-100" />
                  </div>
                  <div className="h-6 w-20 rounded-full bg-gray-100" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <p className="sr-only" role="status">
          Carregando histórico de conversões...
        </p>
      </div>
    )
  }

  if (isError) {
    return (
      <div>
        <PageHeader
          eyebrow="Histórico"
          title="Histórico de conversões"
          description="Acompanhamento e download das conversões realizadas."
        />
        <Card>
          <CardContent className="p-6 sm:p-10">
            <div className="mx-auto max-w-lg text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100">
                <AlertCircle className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-[17px] font-semibold text-gray-900">Histórico indisponível</h2>
              <p className="mt-2 text-[14px] leading-5 text-gray-500">
                {`Não foi possível carregar o histórico: ${(error as Error).message}`}
              </p>
              <Button variant="outline" className="mt-5" onClick={() => refetch()} disabled={isFetching}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Tentar novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const jobs = conversions?.data ?? []
  const completedCount = jobs.filter((job) => job.status === 'completed').length
  const problemCount = jobs.filter((job) => job.status === 'failed' || job.status === 'partial').length

  return (
    <div>
      <PageHeader
        eyebrow="Histórico"
        title="Histórico de conversões"
        description="Acompanhe status, progresso e baixe os resultados das conversões realizadas."
        actions={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} aria-hidden="true" />
            Atualizar
          </Button>
        }
      />

      {actionMessage && (
        <Alert variant={actionMessage.type} className="mb-5">
          {actionMessage.text}
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={HistoryIcon}
          label="Total de conversões"
          value={conversions?.total ?? 0}
          hint="Em todo o histórico"
        />
        <StatCard
          icon={Files}
          label="Nesta página"
          value={jobs.length}
          hint={`Página ${conversions?.page ?? page} de ${conversions?.totalPages ?? 1}`}
          tone="neutral"
        />
        <StatCard
          icon={CheckCircle2}
          label="Concluídas"
          value={completedCount}
          hint="Resultados desta página"
          tone="success"
        />
        <StatCard
          icon={AlertCircle}
          label="Falhas e parciais"
          value={problemCount}
          hint="Resultados desta página"
          tone="error"
        />
      </div>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-gray-900">Conversões</h2>
            <p className="text-[12px] leading-4 text-gray-500">Status, progresso e arquivos disponíveis para download.</p>
          </div>
          <Badge variant="secondary">{conversions?.total ?? 0} no total</Badge>
        </div>

        {jobs.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-gray-200 bg-gray-50 text-gray-400">
              <Inbox className="h-6 w-6" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-[16px] font-semibold text-gray-900">Nenhuma conversão ainda</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-5 text-gray-500">
              Envie arquivos na tela de conversão para acompanhar o histórico por aqui.
            </p>
            <Button className="mt-5" onClick={onNavigateToUpload}>
              Ir para o conversor
            </Button>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[780px]">
                <caption className="sr-only">Histórico de conversões</caption>
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70">
                    <th scope="col" className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 sm:px-6">
                      Arquivos
                    </th>
                    <th scope="col" className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500">
                      Saída
                    </th>
                    <th scope="col" className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500">
                      Status
                    </th>
                    <th scope="col" className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500">
                      Progresso
                    </th>
                    <th scope="col" className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500">
                      Criado em
                    </th>
                    <th scope="col" className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 sm:px-6">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {jobs.map((job) => {
                    const inputSize = getJobInputSize(job)

                    return (
                      <tr key={job.id} className="transition-colors duration-150 hover:bg-gray-50/70">
                        <td className="px-5 py-4 sm:px-6">
                          <div className="whitespace-nowrap text-[13px] font-medium text-gray-900">
                            {getJobFileCount(job)} arquivo(s)
                          </div>
                          <div className="numeric mt-0.5 text-[12px] text-gray-500">
                            {inputSize === null ? 'Tamanho indisponível' : formatFileSize(inputSize)}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant="secondary" className="font-semibold uppercase">
                            {job.outputFormat}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant={STATUS_VARIANTS[job.status] ?? 'secondary'}>
                            {STATUS_LABELS[job.status] ?? job.status}
                          </Badge>
                          {job.error && (
                            <p
                              className="mt-1.5 line-clamp-2 max-w-xs break-words text-[11px] leading-4 text-red-600"
                              title={job.error}
                            >
                              {job.error}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Progress value={job.progress} size="sm" className="w-24" />
                            <span className="numeric w-9 text-right text-[11px] text-gray-500">
                              {Math.round(job.progress)}%
                            </span>
                          </div>
                        </td>
                        <td className="numeric whitespace-nowrap px-5 py-4 text-[12px] text-gray-500">
                          {new Date(job.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-5 py-4 text-right sm:px-6">
                          <DownloadButtons job={job} disabled={isDownloading} onDownload={handleDownload} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-gray-100 md:hidden">
              {jobs.map((job) => {
                const inputSize = getJobInputSize(job)

                return (
                  <li key={job.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-gray-900">{getJobFileCount(job)} arquivo(s)</p>
                        <p className="numeric mt-0.5 text-[12px] text-gray-500">
                          {inputSize === null ? 'Tamanho indisponível' : formatFileSize(inputSize)}
                        </p>
                      </div>
                      <Badge variant={STATUS_VARIANTS[job.status] ?? 'secondary'} className="shrink-0">
                        {STATUS_LABELS[job.status] ?? job.status}
                      </Badge>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">Saída</p>
                        <p className="mt-1 text-[13px] font-medium uppercase text-gray-900">{job.outputFormat}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">Progresso</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <Progress value={job.progress} size="sm" />
                          <span className="numeric text-[11px] text-gray-500">{Math.round(job.progress)}%</span>
                        </div>
                      </div>
                    </div>

                    {job.error && <p className="mt-2 text-[12px] leading-4 text-red-600">{job.error}</p>}

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="numeric text-[11px] text-gray-400">
                        {new Date(job.createdAt).toLocaleString('pt-BR')}
                      </p>
                      <DownloadButtons job={job} disabled={isDownloading} onDownload={handleDownload} />
                    </div>
                  </li>
                )
              })}
            </ul>

            {conversions && conversions.total > 0 && (
              <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p className="numeric text-[12px] text-gray-500">
                  Mostrando <span className="font-medium text-gray-700">{jobs.length}</span> de{' '}
                  <span className="font-medium text-gray-700">{conversions.total}</span> conversões
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={conversions.page === 1 || isFetching}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Anterior
                  </Button>
                  <span className="numeric px-1 text-[12px] text-gray-500">
                    {conversions.page} / {conversions.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={conversions.page === conversions.totalPages || isFetching}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}

function SettingsPage({ apiStatus }: { apiStatus: ApiStatus }) {
  const status = API_STATUS_UI[apiStatus]

  const preferences = [
    {
      icon: Palette,
      label: 'Tema da interface',
      description: 'O tema claro é fixo nesta versão.',
      value: 'Claro',
    },
    {
      icon: Bell,
      label: 'Notificações ao concluir',
      description: 'O envio de notificações ainda não está disponível.',
      value: 'Indisponível',
    },
    {
      icon: SlidersHorizontal,
      label: 'Qualidade padrão de imagem',
      description: 'A qualidade ainda não pode ser configurada pela interface.',
      value: 'Indisponível',
    },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Sistema"
        title="Configurações"
        description="Preferências da conversão e informações do sistema."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-200">
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <CardTitle>Preferências</CardTitle>
                <CardDescription>Opções disponíveis nesta versão.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-gray-100">
              {preferences.map(({ icon: Icon, label, description, value }) => (
                <li key={label} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-gray-900">{label}</p>
                    <p className="mt-0.5 text-[12px] leading-4 text-gray-500">{description}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {value}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-200">
                <Server className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <CardTitle>Status do serviço</CardTitle>
                <CardDescription>Conectividade com a API de conversão.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50/80 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', status.dot)} aria-hidden="true" />
                <p className="truncate text-[13px] font-medium text-gray-900">{status.label}</p>
              </div>
              <Badge variant={status.variant} dot>
                {apiStatus === 'online' ? 'Online' : apiStatus === 'offline' ? 'Offline' : 'Verificando'}
              </Badge>
            </div>
            <p className="mt-3 text-[12px] leading-5 text-gray-500">{status.hint}</p>
            <p className="mt-2 text-[12px] leading-5 text-gray-500">
              O status é obtido pela verificação de saúde da aplicação.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary-600 to-accent-500 text-white shadow-sm"
              >
                <FileImage className="h-4 w-4" />
              </span>
              <div>
                <CardTitle>Sobre</CardTitle>
                <CardDescription>Informações da aplicação e da stack utilizada.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-4 py-3">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">Versão</dt>
                <dd className="mt-1 text-[13px] font-medium text-gray-900">0.0.1</dd>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-4 py-3">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">Interface</dt>
                <dd className="mt-1 text-[13px] font-medium text-gray-900">React, TypeScript e Tailwind CSS</dd>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-4 py-3">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">Serviço</dt>
                <dd className="mt-1 text-[13px] font-medium text-gray-900">Fastify e TypeScript</dd>
              </div>
            </dl>
            <p className="mt-4 border-t border-gray-100 pt-4 text-[12px] text-gray-500">
              Conversor de Arquivos · CRCPR
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<AppPage>('upload')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { data: health, isLoading: isHealthLoading, isError: isHealthError } = useHealthCheck()
  const queryClient = useQueryClient()

  const apiStatus: ApiStatus = isHealthLoading ? 'checking' : isHealthError || health?.status !== 'ok' ? 'offline' : 'online'

  const handleStartConversion = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['conversions'] })
  }, [queryClient])

  const handleNavigate = useCallback((page: AppPage) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0 })
  }, [])

  const closeMenu = useCallback(() => setIsMenuOpen(false), [])

  const handleNavigateToUpload = useCallback(() => {
    setCurrentPage('upload')
    setIsMenuOpen(false)
    window.scrollTo({ top: 0 })
  }, [])

  return (
    <div className="app-canvas min-h-screen">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-[13px] focus:font-medium focus:text-gray-900 focus:shadow-lg"
      >
        Pular para o conteúdo
      </a>

      <Sidebar currentPage={currentPage} onNavigate={handleNavigate} apiStatus={apiStatus} />
      <MobileSidebar
        open={isMenuOpen}
        onClose={closeMenu}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        apiStatus={apiStatus}
      />

      <div className="flex min-h-screen flex-col lg:pl-[272px]">
        <Header
          currentPage={currentPage}
          apiStatus={apiStatus}
          isMenuOpen={isMenuOpen}
          onOpenMenu={() => setIsMenuOpen(true)}
        />

        <main id="conteudo" tabIndex={-1} className="flex-1 focus:outline-none focus-visible:ring-0">
          <Container size="2xl" className="py-8 lg:py-10">
            {currentPage === 'upload' && <UploadPage onStartConversion={handleStartConversion} />}
            {currentPage === 'history' && <HistoryPage onNavigateToUpload={handleNavigateToUpload} />}
            {currentPage === 'settings' && <SettingsPage apiStatus={apiStatus} />}
          </Container>
        </main>

        <footer className="border-t border-gray-200/70">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-1.5 px-5 py-5 text-[11px] text-gray-400 sm:flex-row sm:px-8">
            <p>Conversor de Arquivos · CRCPR</p>
            <p className="flex items-center gap-1.5">
              <FileImage className="h-3.5 w-3.5" aria-hidden="true" />
              Conversão de imagens em lote
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
