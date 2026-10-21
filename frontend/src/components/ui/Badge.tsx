import { cn } from '../../utils/helpers'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'secondary'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  dot?: boolean
}

const dotStyles: Record<BadgeVariant, string> = {
  default: 'bg-primary-500',
  secondary: 'bg-gray-400',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-accent-500',
}

export const Badge = ({ className, variant = 'default', dot = false, children, ...props }: BadgeProps) => {
  const variants: Record<BadgeVariant, string> = {
    default: 'border-primary-200 bg-primary-50 text-primary-700',
    secondary: 'border-gray-200 bg-gray-100 text-gray-600',
    success: 'border-green-200 bg-green-50 text-green-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    error: 'border-red-200 bg-red-50 text-red-700',
    info: 'border-accent-300 bg-accent-50 text-accent-600',
  }

  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[12px] font-medium leading-none',
        variants[variant],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotStyles[variant])} aria-hidden="true" />}
      {children}
    </span>
  )
}
