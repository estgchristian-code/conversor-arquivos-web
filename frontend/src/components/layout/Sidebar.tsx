import { useEffect, useRef } from 'react'
import { FileImage, FileText, History, Server, Settings, X } from 'lucide-react'
import { cn } from '../../utils/helpers'
import { Badge } from '../ui/Badge'

export type AppPage = 'upload' | 'history' | 'settings'
export type ApiStatus = 'checking' | 'online' | 'offline'

interface NavigationProps {
  currentPage: AppPage
  onNavigate: (page: AppPage) => void
  apiStatus: ApiStatus
}

interface SidebarContentProps extends NavigationProps {
  onClose?: () => void
  closeButtonRef?: React.RefObject<HTMLButtonElement>
}

const NAV_ITEMS: Array<{
  id: AppPage
  label: string
  description: string
  icon: typeof FileText
}> = [
  { id: 'upload', label: 'Conversão', description: 'Envie e converta arquivos', icon: FileText },
  { id: 'history', label: 'Histórico', description: 'Resultados anteriores', icon: History },
  { id: 'settings', label: 'Configurações', description: 'Preferências do sistema', icon: Settings },
]

const STATUS_META: Record<
  ApiStatus,
  { label: string; hint: string; variant: 'secondary' | 'success' | 'error' }
> = {
  checking: {
    label: 'Verificando',
    hint: 'Checando a conexão com a API.',
    variant: 'secondary',
  },
  online: {
    label: 'Online',
    hint: 'API respondendo normalmente.',
    variant: 'success',
  },
  offline: {
    label: 'Offline',
    hint: 'Sem conexão com a API.',
    variant: 'error',
  },
}

function SidebarContent({ currentPage, onNavigate, apiStatus, onClose, closeButtonRef }: SidebarContentProps) {
  const status = STATUS_META[apiStatus]

  const handleNavigate = (page: AppPage) => {
    onNavigate(page)
    onClose?.()
  }

  return (
    <>
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary-600 to-accent-500 text-white shadow-sm"
          >
            <FileImage className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold leading-5 tracking-[-0.01em] text-gray-900">
              Conversor de Arquivos
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">CRCPR</p>
          </div>
        </div>
        {onClose && (
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            aria-label="Fechar menu de navegação"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">Menu</p>
        <nav aria-label="Navegação principal" className="mt-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.id

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-150',
                  isActive
                    ? 'bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-100'
                    : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900',
                )}
              >
                <span
                  className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-md border transition-colors',
                    isActive
                      ? 'border-primary-100 bg-white text-primary-600'
                      : 'border-gray-200 bg-white text-gray-400 group-hover:text-gray-600',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium leading-5">{item.label}</span>
                  <span
                    className={cn(
                      'block truncate text-[11px] leading-4',
                      isActive ? 'text-primary-600/70' : 'text-gray-400',
                    )}
                  >
                    {item.description}
                  </span>
                </span>
                {isActive && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" aria-hidden="true" />}
              </button>
            )
          })}
        </nav>

        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50/80 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">
              <Server className="h-3.5 w-3.5" aria-hidden="true" />
              API
            </span>
            <Badge variant={status.variant} dot>
              {status.label}
            </Badge>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-gray-500">{status.hint}</p>
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-100 px-4 py-4">
        <p className="text-center text-[11px] text-gray-400">Conversor de Arquivos · v0.0.1</p>
      </div>
    </>
  )
}

export function Sidebar(props: NavigationProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col border-r border-gray-200 bg-white lg:flex">
      <SidebarContent {...props} />
    </aside>
  )
}

interface MobileSidebarProps extends NavigationProps {
  open: boolean
  onClose: () => void
}

export function MobileSidebar({ open, onClose, ...props }: MobileSidebarProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }

      if (event.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null)

      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="lg:hidden">
      <div
        className="fixed inset-0 z-40 animate-fade-in bg-gray-900/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        id="mobile-navigation"
        role="dialog"
        aria-modal="true"
        aria-label="Navegação principal"
        className="fixed inset-y-0 left-0 z-50 flex w-[288px] max-w-[85vw] animate-slide-in flex-col bg-white shadow-2xl"
      >
        <SidebarContent {...props} onClose={onClose} closeButtonRef={closeButtonRef} />
      </div>
    </div>
  )
}
