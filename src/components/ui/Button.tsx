import { forwardRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-semibold font-display tracking-wide rounded-lg border border-transparent transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gold/60 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap active:translate-y-px',
  {
    variants: {
      variant: {
        primary: 'bg-gradient-button text-white shadow-gold hover:shadow-hover hover:brightness-[1.06]',
        gold: 'bg-gradient-button text-white shadow-gold hover:shadow-hover hover:brightness-[1.06]',
        rose: 'bg-gradient-rose text-white shadow-card hover:shadow-hover hover:brightness-[1.06]',
        lavender: 'bg-gradient-lavender text-white shadow-card hover:shadow-hover hover:brightness-[1.06]',
        mint: 'bg-gradient-mint text-white shadow-card hover:shadow-hover hover:brightness-[1.06]',
        secondary: 'bg-white text-text-primary border-black/10 shadow-sm hover:border-gold/40 hover:bg-vanilla',
        danger: 'bg-gradient-rose text-white shadow-card hover:shadow-hover hover:brightness-[1.06]',
        ghost: 'bg-transparent text-text-secondary hover:bg-gold/10 hover:text-gold-dark',
        outline: 'bg-transparent border-gold/50 text-gold-dark hover:bg-gold hover:text-white hover:border-gold',
      },
      size: {
        sm: 'text-xs px-3.5 py-1.5 h-8',
        md: 'text-sm px-5 py-2.5 h-10',
        lg: 'text-[15px] px-7 py-3 h-12',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export interface ButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'ref'>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, children, ...props }, ref) => (
    <motion.button
      ref={ref}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </motion.button>
  )
);
Button.displayName = 'Button';
