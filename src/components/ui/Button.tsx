import { forwardRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
  {
    variants: {
      variant: {
        primary: 'bg-gradient-button text-white shadow-gold hover:brightness-105',
        gold: 'bg-gradient-button text-white shadow-gold hover:brightness-105',
        rose: 'bg-gradient-rose text-white shadow-card hover:brightness-105',
        lavender: 'bg-gradient-lavender text-white shadow-card hover:brightness-105',
        mint: 'bg-gradient-mint text-white shadow-card hover:brightness-105',
        secondary: 'bg-white/70 text-text-secondary border border-gold/30 hover:bg-gold-light/40',
        danger: 'bg-gradient-to-r from-[#FF7AA0] to-[#E5446F] text-white shadow-card hover:brightness-105',
        ghost: 'bg-transparent text-text-secondary hover:bg-gold/10',
        outline: 'bg-transparent border border-gold/50 text-gold-dark hover:bg-gold/10',
      },
      size: {
        sm: 'text-xs px-3 py-1.5 h-8',
        md: 'text-sm px-4 py-2.5 h-10',
        lg: 'text-base px-6 py-3 h-12',
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
