import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import { cn } from '../../utils/helpers'

type AlertVariant = 'success' | 'error' | 'warning' | 'info'

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant
  title?: string
}

const styles: Record<
  AlertVariant,
  { container: string; icon: string; title: string; body: string; Icon: typeof AlertCircle }
> = {
  success: {
    container: 'border-green-200 bg-green-50/80',
    icon: 'text-green-600',
    title: 'text-green-900',
    body: 'text-green-800',
    Icon: CheckCircle2,
  },
  error: {
    container: 'border-red-200 bg-red-50/80',
    icon: 'text-red-600',
    title: 'text-red-900',
    body: 'text-red-800',
    Icon: AlertCircle,
  },
  warning: {
    container: 'border-amber-200 bg-amber-50/80',
    icon: 'text-amber-600',
    title: 'text-amber-900',
    body: 'text-amber-800',
    Icon: TriangleAlert,
  },
  info: {
    container: 'border-primary-200 bg-primary-50/70',
    icon: 'text-primary-600',
    title: 'text-primary-900',
    body: 'text-primary-800',
    Icon: Info,
  },
}

export function Alert({ variant = 'info', title, className, children, ...props }: AlertProps) {
  const style = styles[variant]
  const Icon = style.Icon

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-xl border px-4 py-3.5', style.container, className)}
      {...props}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', style.icon)} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-[13px] leading-5">
        {title && <p className={cn('font-semibold', style.title)}>{title}</p>}
        <div className={cn(title && 'mt-0.5', style.body)}>{children}</div>
      </div>
    </div>
  )
}
