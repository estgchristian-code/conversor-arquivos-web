import { ChevronRight, Menu } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import type { ApiStatus, AppPage } from './Sidebar'

interface HeaderProps {
  currentPage: AppPage
  apiStatus: ApiStatus
  isMenuOpen: boolean
  onOpenMenu: () => void
}

const PAGE_LABELS: Record<AppPage, string> = {
  upload: 'Conversão',
  history: 'Histórico',
  settings: 'Configurações',
}

const STATUS_META: Record<
  ApiStatus,
  { label: string; shortLabel: string; variant: 'secondary' | 'success' | 'error' }
> = {
  checking: { label: 'Verificando API', shortLabel: 'Verificando', variant: 'secondary' },
  online: { label: 'API online', shortLabel: 'Online', variant: 'success' },
  offline: { label: 'API offline', shortLabel: 'Offline', variant: 'error' },
}

export function Header({ currentPage, apiStatus, isMenuOpen, onOpenMenu }: HeaderProps) {
  const status = STATUS_META[apiStatus]

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200/80 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onOpenMenu}
          aria-label="Abrir menu de navegação"
          aria-expanded={isMenuOpen}
          aria-haspopup="dialog"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>

        <nav aria-label="Trilha de navegação" className="min-w-0 flex-1">
          <ol className="flex min-w-0 items-center gap-1.5 text-[12px] leading-5">
            <li className="hidden text-gray-400 sm:block">Painel</li>
            <li className="hidden sm:block" aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
            </li>
            <li className="truncate font-medium text-gray-700" aria-current="page">
              {PAGE_LABELS[currentPage]}
            </li>
          </ol>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={status.variant} dot>
            <span className="hidden sm:inline">{status.label}</span>
            <span className="sm:hidden">{status.shortLabel}</span>
          </Badge>
          <span
            className="hidden h-7 items-center rounded-md border border-gray-200 bg-white px-2 text-[11px] font-medium text-gray-400 md:inline-flex"
            title="Versão da aplicação"
          >
            v0.0.1
          </span>
        </div>
      </div>
    </header>
  )
}
