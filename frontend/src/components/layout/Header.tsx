import { FileText, Settings, History } from 'lucide-react'
import { cn } from '../../utils/helpers'
import { Container } from './Container'
import { Button } from '../ui/Button'

interface HeaderProps {
  currentPage?: 'upload' | 'history' | 'settings'
  onNavigate?: (page: 'upload' | 'history' | 'settings') => void
}

export function Header({ currentPage = 'upload', onNavigate }: HeaderProps) {
  const navItems = [
    { id: 'upload', label: 'Converter', icon: FileText },
    { id: 'history', label: 'Histórico', icon: History },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ] as const

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/80 backdrop-blur-sm">
      <Container>
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-bold text-gray-900">Conversor de Arquivos</h1>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = currentPage === item.id
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => onNavigate?.(item.id as typeof currentPage)}
                    className={cn('gap-2', isActive && 'text-primary-600')}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                )
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" aria-label="Tema">
              <span className="h-5 w-5 rounded-lg bg-gray-100" />
            </Button>
          </div>
        </div>
      </Container>
    </header>
  )
}