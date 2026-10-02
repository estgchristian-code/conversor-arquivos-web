import { cn } from '../../utils/helpers'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = ({ className, children, ...props }: CardProps) => {
  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white', className)} {...props}>
      {children}
    </div>
  )
}

export const CardHeader = ({ className, children, ...props }: CardProps) => {
  return (
    <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props}>
      {children}
    </div>
  )
}

export const CardTitle = ({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
  return (
    <h3 className={cn('text-[15px] font-semibold leading-[22px] text-gray-900', className)} {...props}>
      {children}
    </h3>
  )
}

export const CardDescription = ({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => {
  return (
    <p className={cn('text-[13px] leading-[18px] text-gray-500', className)} {...props}>
      {children}
    </p>
  )
}

export const CardContent = ({ className, children, ...props }: CardProps) => {
  return (
    <div className={cn('p-6 pt-0', className)} {...props}>
      {children}
    </div>
  )
}

export const CardFooter = ({ className, children, ...props }: CardProps) => {
  return (
    <div className={cn('flex items-center p-6 pt-0', className)} {...props}>
      {children}
    </div>
  )
}