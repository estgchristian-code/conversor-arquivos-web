import { forwardRef } from 'react'
import { cn } from '../../utils/helpers'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const baseStyles =
  'inline-flex items-center justify-center font-medium rounded-md transition-colors duration-150 ease-out select-none disabled:cursor-not-allowed'

const variants = {
  primary:
    'bg-primary-600 text-white hover:bg-primary-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-gray-100',
  secondary:
    'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:text-gray-900 disabled:text-gray-400 disabled:bg-gray-50 disabled:hover:bg-gray-50',
  outline:
    'bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 disabled:text-gray-400 disabled:hover:bg-white',
  ghost:
    'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:text-gray-300 disabled:hover:bg-transparent',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-100 disabled:text-gray-400',
} satisfies Record<ButtonVariant, string>

const sizes = {
  sm: 'h-9 px-3 text-[13px] gap-1.5',
  md: 'h-11 px-4 text-[15px] gap-2',
  lg: 'h-12 px-6 text-[15px] gap-2',
  icon: 'h-10 w-10',
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