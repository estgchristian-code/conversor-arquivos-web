import { useState } from 'react'
import { Header } from './components/layout/Header'
import { Container } from './components/layout/Container'
import { BatchManager } from './components/upload/BatchManager'
import { useStartConversion, useConversions, useHealthCheck } from './hooks/useConversions'
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/Card'
import { Badge } from './components/ui/Badge'
import { Progress } from './components/ui/Progress'
import { Button } from './components/ui/Button'
import { formatFileSize, formatDuration } from './utils/helpers'
import { Loader2, CheckCircle, AlertCircle, Clock, Download, X } from 'lucide-react'
import type { ConversionJob } from './types'

function UploadPage({ onStartConversion }: { onStartConversion: (files: any[], format: string) => void }) {
  return (
    <div className="py-8">
      <BatchManager onStartConversion={onStartConversion} />
    </div>
  )
}

function HistoryPage() {
  const { data: conversions, isLoading, refetch } = useConversions()
  const { mutate: cancelConversion } = useStartConversion()

  if (isLoading) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary-600" />
        <p className="mt-2 text-gray-500">Carregando histórico...</p>
      </div>
    )
  }

  return (
    <div className="py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Histórico de Conversões</h2>
        <Button variant="outline" onClick={() => refetch()}>
          Atualizar
        </Button>
      </div>

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
            <table className="w-full">
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
                        {job.status === 'completed' && (
                          <Button variant="ghost" size="icon" aria-label="Baixar">
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        {(job.status === 'queued' || job.status === 'processing') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => cancelConversion(job.id)}
                            aria-label="Cancelar"
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
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Página {conversions.page} de {conversions.totalPages} • Total: {conversions.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={conversions.page === 1}
                  onClick={() => {}}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={conversions.page === conversions.totalPages}
                  onClick={() => {}}
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
              <option defaultValue>Média (75%)</option>
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
  const { data: health } = useHealthCheck()

  const handleStartConversion = async (files: any[], format: string) => {
    // This will be connected to the actual API
    console.log('Start conversion:', files.length, format)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1">
        <Container>
          {currentPage === 'upload' && <UploadPage onStartConversion={handleStartConversion} />}
          {currentPage === 'history' && <HistoryPage />}
          {currentPage === 'settings' && <SettingsPage />}
        </Container>
      </main>
      <footer className="border-t border-gray-200 bg-white">
        <Container>
          <p className="py-4 text-center text-sm text-gray-500">
            Status da API: {health?.status === 'ok' ? (
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