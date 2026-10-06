import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Header } from './components/layout/Header'
import { Container } from './components/layout/Container'
import { BatchManager } from './components/upload/BatchManager'
import { useConversions, useHealthCheck, useDownloadFile } from './hooks/useConversions'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './components/ui/Card'
import { Badge } from './components/ui/Badge'
import { Progress } from './components/ui/Progress'
import { Button } from './components/ui/Button'
import { formatFileSize } from './utils/helpers'
import { Loader2, Clock, Download, AlertCircle, RotateCcw, CheckCircle2 } from 'lucide-react'
import type { ConversionJob } from './types'

const HISTORY_PAGE_SIZE = 20

type ApiStatus = 'checking' | 'online' | 'offline'

function getErrorStatus(error: unknown): number | undefined {
  return (error as { status?: number } | null | undefined)?.status
}

function PageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-gray-900">{title}</h1>
        <p className="max-w-2xl text-[15px] leading-[22px] text-gray-500">{description}</p>
      </div>
      {action}
    </div>
  )
}

function UploadPage({ onStartConversion }: { onStartConversion?: () => void }) {
  return (
    <div className="py-10">
      <PageHeader
        title="Conversão em Lote"
        description="Envie vários arquivos de uma vez, escolha o formato de entrada e o de saída, e converta tudo em uma única execução."
      />
      <BatchManager onStartConversion={onStartConversion} />
    </div>
  )
}

function HistoryPage() {
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
            text:
              getErrorStatus(downloadError) === 501
                ? `O download de "${fileName}" ainda não está disponível (501 Not Implemented).`
                : `Falha ao baixar "${fileName}": ${downloadError.message}`,
          })
        },
      },
    )
  }

  if (isLoading) {
    return (
      <div className="py-10">
        <PageHeader title="Histórico de Conversões" description="Acompanhamento e download das conversões realizadas." />
        <Card>
          <CardContent className="py-20 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary-600" aria-hidden="true" />
            <p className="mt-4 text-[15px] text-gray-500">Carregando histórico...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isError) {
    const notImplemented = getErrorStatus(error) === 501
    return (
      <div className="py-10">
        <PageHeader title="Histórico de Conversões" description="Acompanhamento e download das conversões realizadas." />
        <Card>
          <CardContent className="py-20 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
              <AlertCircle className="h-6 w-6 text-amber-600" aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-[17px] font-semibold text-gray-900">Histórico indisponível</h2>
            <p className="mx-auto mt-2 max-w-md text-[15px] leading-[22px] text-gray-500">
              {notImplemented
                ? 'A rota de histórico ainda não foi implementada no servidor (501 Not Implemented). Nenhuma conversão está sendo registrada até lá.'
                : `Não foi possível carregar o histórico: ${(error as Error).message}`}
            </p>
            <Button variant="outline" className="mt-6" onClick={() => refetch()} disabled={isFetching}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="py-10">
      <PageHeader
        title="Histórico de Conversões"
        description="Acompanhamento e download das conversões realizadas."
        action={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            )}
            Atualizar
          </Button>
        }
      />

      {actionMessage && (
        <div
          className={`mb-5 flex items-start gap-2.5 rounded-lg border px-5 py-4 text-[14px] leading-5 ${
            actionMessage.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="mt-px h-5 w-5 shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle className="mt-px h-5 w-5 shrink-0" aria-hidden="true" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {conversions?.data.length === 0 ? (
        <Card>
          <CardContent className="py-20 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <Clock className="h-6 w-6 text-gray-400" aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-[17px] font-semibold text-gray-900">Nenhuma conversão ainda</h2>
            <p className="mt-2 text-[15px] text-gray-500">Suas conversões aparecerão aqui.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th scope="col" className="px-5 py-3 text-left text-[13px] font-semibold uppercase tracking-[0.04em] text-gray-500">
                    Arquivos
                  </th>
                  <th scope="col" className="px-5 py-3 text-left text-[13px] font-semibold uppercase tracking-[0.04em] text-gray-500">
                    Formato
                  </th>
                  <th scope="col" className="px-5 py-3 text-left text-[13px] font-semibold uppercase tracking-[0.04em] text-gray-500">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3 text-left text-[13px] font-semibold uppercase tracking-[0.04em] text-gray-500">
                    Progresso
                  </th>
                  <th scope="col" className="px-5 py-3 text-left text-[13px] font-semibold uppercase tracking-[0.04em] text-gray-500">
                    Criado em
                  </th>
                  <th scope="col" className="px-5 py-3 text-right text-[13px] font-semibold uppercase tracking-[0.04em] text-gray-500">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {conversions?.data.map((job: ConversionJob) => (
                  <tr key={job.id} className="transition-colors duration-150 hover:bg-gray-50">
                    <td className="px-5 py-4">
                      <div className="text-[15px] font-medium text-gray-900">
                        {job.inputFiles.length} arquivo(s)
                      </div>
                      <div className="numeric text-[13px] text-gray-500">
                        {formatFileSize(job.inputFiles.reduce((acc, f) => acc + f.size, 0))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[15px] font-medium uppercase text-gray-900">{job.outputFormat}</td>
                    <td className="px-5 py-4">
                      <Badge
                        variant={
                          job.status === 'completed'
                            ? 'success'
                            : job.status === 'failed'
                            ? 'error'
                            : job.status === 'processing'
                            ? 'info'
                            : 'secondary'
                        }
                      >
                        {job.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Progress value={job.progress} size="sm" className="w-32" />
                    </td>
                    <td className="numeric px-5 py-4 text-[13px] text-gray-500">
                      {new Date(job.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {job.status === 'completed' &&
                          (job.results?.length ? (
                            job.results.map((result) => (
                              <Button
                                key={result.fileId}
                                variant="ghost"
                                size="icon"
                                disabled={isDownloading}
                                onClick={() => handleDownload(job.id, result.fileId, result.outputName)}
                                aria-label={`Baixar ${result.outputName}`}
                                title={`Baixar ${result.outputName}`}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            ))
                          ) : null)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {conversions && conversions.totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-5 py-4">
              <p className="numeric text-[13px] text-gray-500">
                Página {conversions.page} de {conversions.totalPages} · {conversions.total} conversão(ões)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={conversions.page === 1 || isFetching}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Anterior
                </Button>
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
        </Card>
      )}
    </div>
  )
}

function SettingsPage() {
  return (
    <div className="py-10">
      <PageHeader title="Configurações" description="Preferências da conversão e informações do sistema." />

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Geral</CardTitle>
            <CardDescription>
              Estas preferências ainda não são aplicadas: não há persistência de configuração no servidor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-[15px] leading-[22px] text-gray-500">
              <li>• Tema da interface: claro (fixo)</li>
              <li>• Notificações ao concluir uma conversão: indisponíveis</li>
              <li>• Qualidade padrão de imagem: indisponível</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sobre</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[15px] leading-[22px] text-gray-500">
            <p>Conversor de Arquivos v0.0.1</p>
            <p>Desenvolvido com React, Fastify, TypeScript e Tailwind CSS</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<'upload' | 'history' | 'settings'>('upload')
  const { data: health, isLoading: isHealthLoading, isError: isHealthError } = useHealthCheck()
  const queryClient = useQueryClient()

  const apiStatus: ApiStatus = isHealthLoading ? 'checking' : isHealthError || health?.status !== 'ok' ? 'offline' : 'online'

  const handleStartConversion = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['conversions'] })
  }, [queryClient])

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header currentPage={currentPage} onNavigate={setCurrentPage} apiStatus={apiStatus} />
      <main className="flex-1">
        <Container>
          {currentPage === 'upload' && <UploadPage onStartConversion={handleStartConversion} />}
          {currentPage === 'history' && <HistoryPage />}
          {currentPage === 'settings' && <SettingsPage />}
        </Container>
      </main>
      <footer className="border-t border-gray-200 bg-white">
        <Container>
          <p className="py-6 text-center text-[13px] text-gray-400">Conversor de Arquivos · CRCPR</p>
        </Container>
      </footer>
    </div>
  )
}