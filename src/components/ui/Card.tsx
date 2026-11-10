import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cardVariants } from '@/lib/animations';
import { cn } from '@/lib/utils';

type Accent = 'gold' | 'rose' | 'pistachio' | 'caramel' | 'lavender' | 'none';

interface CardProps {
  children: ReactNode;
  className?: string;
  index?: number;
  hoverable?: boolean;
  onClick?: () => void;
  /** Thin gradient strip along the top edge for a premium, color-coded feel. */
  accent?: Accent;
}

const accentStrip: Record<Exclude<Accent, 'none'>, string> = {
  gold: 'from-[#FFA76B] to-[#E24E0E]',
  rose: 'from-[#FF7A7A] to-[#C1121F]',
  pistachio: 'from-[#6EE7A8] to-[#16A34A]',
  caramel: 'from-[#FCD34D] to-[#F59E0B]',
  lavender: 'from-[#2DD4BF] to-[#0C7E7D]',
};

export function Card({ children, className, index = 0, hoverable = false, onClick, accent = 'none' }: CardProps) {
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover={hoverable ? 'hover' : undefined}
      onClick={onClick}
      className={cn(
        'group relative rounded-2xl bg-gradient-card border border-black/[0.06] shadow-card p-5 overflow-hidden',
        'transition-all duration-200 hover:shadow-hover hover:border-gold/25',
        hoverable && 'cursor-pointer',
        className
      )}
    >
      {accent !== 'none' && (
        <span
          aria-hidden
          className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', accentStrip[accent])}
        />
      )}
      {children}
    </motion.div>
  );
}
