import { forwardRef } from 'react'
import { cn } from '../../utils/helpers'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const baseStyles =
  'inline-flex select-none items-center justify-center rounded-lg font-medium transition-colors duration-150 ease-out disabled:cursor-not-allowed'

const variants = {
  primary:
    'bg-primary-600 text-white shadow-sm hover:bg-primary-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none disabled:hover:bg-gray-100',
  secondary:
    'border border-gray-200 bg-white text-gray-700 shadow-sm hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400 disabled:shadow-none disabled:hover:bg-gray-50',
  outline:
    'border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-white',
  ghost:
    'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:text-gray-300 disabled:hover:bg-transparent',
  danger:
    'bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none',
} satisfies Record<ButtonVariant, string>

const sizes = {
  sm: 'h-8 gap-1.5 px-3 text-[13px]',
  md: 'h-10 gap-2 px-4 text-[14px]',
  lg: 'h-11 gap-2 px-5 text-[15px]',
  icon: 'h-9 w-9',
} satisfies Record<ButtonSize, string>

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
