import { forwardRef, useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../utils/helpers'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: Array<{ value: string; label: string }>
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, options, id, placeholder, ...props }, ref) => {
    const generatedId = useId()
    const selectId = id ?? generatedId
    const messageId = error || hint ? `${selectId}-message` : undefined

    return (
      <div>
        {label && (
          <label htmlFor={selectId} className="mb-1.5 block text-[13px] font-medium text-gray-700">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? true : undefined}
            aria-describedby={messageId}
            className={cn(
              'flex h-10 w-full appearance-none rounded-lg border bg-white py-0 pl-3.5 pr-9 text-[14px] text-gray-900 shadow-sm',
              'transition-colors duration-150 hover:border-gray-300 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400 disabled:shadow-none',
              error ? 'border-red-400' : 'border-gray-200',
              className,
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
        </div>
        {error ? (
          <p id={messageId} className="mt-1.5 text-[12px] leading-4 text-red-600">
            {error}
          </p>
        ) : hint ? (
          <p id={messageId} className="mt-1.5 text-[12px] leading-4 text-gray-500">
            {hint}
          </p>
        ) : null}
      </div>
    )
  },
)

Select.displayName = 'Select'
