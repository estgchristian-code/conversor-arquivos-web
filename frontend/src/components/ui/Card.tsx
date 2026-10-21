import { cn } from '../../utils/helpers'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = ({ className, children, ...props }: CardProps) => {
  return (
    <div className={cn('rounded-xl border border-gray-200/90 bg-white shadow-panel', className)} {...props}>
      {children}
    </div>
  )
}

export const CardHeader = ({ className, children, ...props }: CardProps) => {
  return (
    <div className={cn('flex flex-col gap-1.5 px-5 py-5 sm:px-6', className)} {...props}>
      {children}
    </div>
  )
}

export const CardTitle = ({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
  return (
    <h2 className={cn('text-[16px] font-semibold leading-6 tracking-[-0.01em] text-gray-900', className)} {...props}>
      {children}
    </h2>
  )
}

export const CardDescription = ({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => {
  return (
    <p className={cn('text-[13px] leading-5 text-gray-500', className)} {...props}>
      {children}
    </p>
  )
}

export const CardContent = ({ className, children, ...props }: CardProps) => {
  return (
    <div className={cn('px-5 pb-5 sm:px-6 sm:pb-6', className)} {...props}>
      {children}
    </div>
  )
}

export const CardFooter = ({ className, children, ...props }: CardProps) => {
  return (
    <div className={cn('flex items-center px-5 pb-5 sm:px-6 sm:pb-6', className)} {...props}>
      {children}
    </div>
  )
}
