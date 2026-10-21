import type { ReactNode } from 'react'
import { cn } from '../../utils/helpers'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-7 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-600">{eyebrow}</p>
        )}
        <h1 className="text-balance text-[26px] font-semibold leading-[32px] tracking-[-0.025em] text-gray-900 sm:text-[30px] sm:leading-[36px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-[14px] leading-[22px] text-gray-500 sm:text-[15px]">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
