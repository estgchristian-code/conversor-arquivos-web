import { FileText, Settings, History } from 'lucide-react'
import { Container } from './Container'
import { Button } from '../ui/Button'
import { cn } from '../../utils/helpers'

type ApiStatus = 'checking' | 'online' | 'offline'

interface HeaderProps {
  currentPage?: 'upload' | 'history' | 'settings'
  onNavigate?: (page: 'upload' | 'history' | 'settings') => void
  apiStatus?: ApiStatus
}

const API_STATUS: Record<ApiStatus, { label: string; dot: string }> = {
  checking: { label: 'Verificando', dot: 'bg-gray-400' },
  online: { label: 'API ativa', dot: 'bg-green-600' },
  offline: { label: 'API indisponível', dot: 'bg-red-600' },
}

export function Header({ currentPage = 'upload', onNavigate, apiStatus = 'checking' }: HeaderProps) {
  const navItems = [
    { id: 'upload', label: 'Conversão', icon: FileText },
    { id: 'history', label: 'Histórico', icon: History },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ] as const

  const status = API_STATUS[apiStatus]

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white">
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-8">
            <div className="flex shrink-0 items-center gap-2">
              <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded bg-gray-900">
                <span className="h-2 w-2 rounded-[2px] bg-white" />
              </span>
              <span className="truncate text-[15px] font-semibold tracking-[-0.01em] text-gray-900">
                Conversor de Arquivos
              </span>
            </div>

            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = currentPage === item.id
                return (
                  <Button
                    key={item.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigate?.(item.id as typeof currentPage)}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'h-9 px-2.5',
                      isActive ? 'font-semibold text-gray-900' : 'font-medium text-gray-600',
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary-600' : 'text-gray-400')} />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Button>
                )
              })}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span
              className="hidden items-center gap-1.5 text-xs text-gray-500 sm:inline-flex"
              title="Status da API"
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} aria-hidden="true" />
              {status.label}
            </span>
            <span className="text-xs text-gray-400">{apiStatus === 'online' ? 'v0.0.1' : ''}</span>
          </div>
        </div>
      </Container>
    </header>
  )
}