import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from './ui/Button'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  message?: string
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : undefined,
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Erro de renderização capturado pelo ErrorBoundary:', error, info.componentStack)
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="app-canvas flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-panel">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-inset ring-red-100">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-[19px] font-semibold tracking-[-0.01em] text-gray-900">Algo deu errado</h1>
          <p className="mt-2 text-[14px] leading-[22px] text-gray-500">
            Ocorreu um erro inesperado ao exibir esta página. Recarregue a página para continuar.
          </p>
          {import.meta.env.DEV && this.state.message && (
            <pre className="mt-4 max-h-40 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-left text-[12px] leading-5 text-gray-600">
              {this.state.message}
            </pre>
          )}
          <Button className="mt-6" onClick={this.handleReload}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Recarregar página
          </Button>
        </div>
      </div>
    )
  }
}
