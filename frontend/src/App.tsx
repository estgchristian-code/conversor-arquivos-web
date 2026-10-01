import { useState } from 'react'
import { Header } from './components/layout/Header'
import { Container } from './components/layout/Container'
import { BatchManager } from './components/upload/BatchManager'
import {
  useConversions,
  useHealthCheck,
  useCancelConversion,
  useDownloadFile,
} from './hooks/useConversions'
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/Card'
import { Badge } from './components/ui/Badge'
import { Progress } from './components/ui/Progress'
import { Button } from './components/ui/Button'
import { formatFileSize } from './utils/helpers'
import { Loader2, Clock, Download, X, AlertCircle, RotateCcw } from 'lucide-react'
import type { ConversionJob } from './types'

const HISTORY_PAGE_SIZE = 20

function getErrorStatus(error: unknown): number | undefined {
  return (error as { status?: number } | null | undefined)?.status
}

function UploadPage() {
  return (
    <div className="py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Conversão em Lote</h2>
      <BatchManager />
    </div>
  )
}

function HistoryPage() {
  const [page, setPage] = useState(1)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const { data: conversions, isLoading, isFetching, isError, error, refetch } = useConversions(page, HISTORY_PAGE_SIZE)
  const { mutate: cancelConversion, isPending: isCancelling } = useCancelConversion()
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

  const handleCancel = (jobId: string) => {
    setActionMessage(null)
    cancelConversion(jobId, {
      onSuccess: () => {
        setActionMessage({ type: 'success', text: `Conversão ${jobId.slice(0, 8)} cancelada.` })
        void refetch()
      },
      onError: (cancelError) => {
        setActionMessage({
          type: 'error',
          text:
            getErrorStatus(cancelError) === 501
              ? 'O cancelamento ainda não está disponível (501 Not Implemented). Nada foi cancelado.'
              : `Falha ao cancelar: ${cancelError.message}`,
        })
      },
    })
  }

  if (isLoading) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary-600" />
        <p className="mt-2 text-gray-500">Carregando histórico...</p>
      </div>
    )
  }

  if (isError) {
    const notImplemented = getErrorStatus(error) === 501
    return (
      <div className="py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Histórico de Conversões</h2>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="h-16 w-16 mx-auto rounded-full bg-amber-50 flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Histórico indisponível</h3>
            <p className="mt-1 text-gray-500 max-w-lg mx-auto">
              {notImplemented
                ? 'A rota de histórico ainda não foi implementada no servidor (501 Not Implemented). Nenhuma conversão está sendo registrada até lá.'
                : `Não foi possível carregar o histórico: ${(error as Error).message}`}
            </p>
            <Button variant="outline" className="mt-6" onClick={() => refetch()} disabled={isFetching}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Histórico de Conversões</h2>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4 mr-2" />
          )}
          Atualizar
        </Button>
      </div>

      {actionMessage && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-lg border p-3 text-sm ${
            actionMessage.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{actionMessage.text}</span>
        </div>
      )}

      {conversions?.data.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="h-16 w-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Clock className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">Nenhuma conversão ainda</h3>
            <p className="mt-1 text-gray-500">Suas conversões aparecerão aqui</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Arquivos</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Formato</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progresso</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Criado em</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {conversions?.data.map((job: ConversionJob) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {job.inputFiles.length} arquivo(s)
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatFileSize(job.inputFiles.reduce((acc, f) => acc + f.size, 0))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {job.outputFormat.toUpperCase()}
                    </td>
                    <td className="px-6 py-4">
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
                    <td className="px-6 py-4">
                      <Progress value={job.progress} size="sm" className="w-32" />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(job.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-right">
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
                        {(job.status === 'queued' || job.status === 'processing') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCancel(job.id)}
                            disabled={isCancelling}
                            aria-label="Cancelar conversão"
                            title="Cancelar conversão"
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {conversions && conversions.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">
                Página {conversions.page} de {conversions.totalPages} • Total: {conversions.total}
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
    <div className="py-8 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Configurações</h2>
      
      <Card>
        <CardHeader>
          <CardTitle>Configurações Gerais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tema</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="theme" defaultChecked className="h-4 w-4 text-primary-600" />
                <span className="text-gray-900">Claro</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="theme" className="h-4 w-4 text-primary-600" />
                <span className="text-gray-900">Escuro</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="theme" className="h-4 w-4 text-primary-600" />
                <span className="text-gray-900">Sistema</span>
              </label>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notificações</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 rounded" />
              <span className="text-gray-900">Notificar ao concluir conversão</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Qualidade padrão de imagem</label>
            <select className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2">
              <option>Alta (90%)</option>
              <option selected>Média (75%)</option>
              <option>Baixa (50%)</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Sobre</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-500">
          <p>Conversor de Arquivos v0.0.1</p>
          <p>Desenvolvido com React, Fastify, TypeScript e Tailwind CSS</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<'upload' | 'history' | 'settings'>('upload')
  const { data: health, isLoading: isHealthLoading, isError: isHealthError } = useHealthCheck()

  const apiOnline = !isHealthLoading && !isHealthError && health?.status === 'ok'

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1">
        <Container>
          {currentPage === 'upload' && <UploadPage />}
          {currentPage === 'history' && <HistoryPage />}
          {currentPage === 'settings' && <SettingsPage />}
        </Container>
      </main>
      <footer className="border-t border-gray-200 bg-white">
        <Container>
          <p className="py-4 text-center text-sm text-gray-500">
            Status da API:{' '}
            {isHealthLoading ? (
              <span className="text-gray-400">verificando...</span>
            ) : apiOnline ? (
              <span className="text-green-600 font-medium">Online</span>
            ) : (
              <span className="text-red-600 font-medium">Offline</span>
            )}
          </p>
        </Container>
      </footer>
    </div>
  )
}