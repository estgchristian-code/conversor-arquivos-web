import { cn } from '../../utils/helpers'

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  tone?: 'accent' | 'success' | 'error'
}

export const Progress = ({
  className,
  value,
  max = 100,
  showLabel = false,
  size = 'md',
  tone = 'accent',
  ...props
}: ProgressProps) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  const sizes = {
    sm: 'h-1',
    md: 'h-1.5',
    lg: 'h-2',
  }

  const tones = {
    accent: 'bg-primary-600',
    success: 'bg-green-600',
    error: 'bg-red-500',
  }

  return (
    <div className={cn('w-full', className)} {...props}>
      <div className={cn('relative w-full overflow-hidden rounded-full bg-gray-100', sizes[size])}>
        <div
          className={cn('h-full rounded-full transition-[width] duration-200 ease-out', tones[tone])}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
      {showLabel && (
        <div className="mt-1 flex justify-between text-xs text-gray-500">
          <span>Progresso</span>
          <span className="numeric">{Math.round(percentage)}%</span>
        </div>
      )}
    </div>
  )
}