import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cardVariants } from '@/lib/animations';
import { useCountUp } from '@/hooks/useCountUp';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number;
  icon: ReactNode;
  format?: 'currency' | 'number';
  accent?: 'gold' | 'rose' | 'pistachio' | 'caramel' | 'lavender';
  index?: number;
  suffix?: string;
  /** Optional % change vs previous period — renders a colored trend pill. */
  delta?: number | null;
  /** Optional small hint line under the value. */
  hint?: string;
  onClick?: () => void;
}

const accents = {
  gold: 'from-[#FFA76B] to-[#E24E0E]',
  rose: 'from-[#FF7A7A] to-[#C1121F]',
  pistachio: 'from-[#6EE7A8] to-[#16A34A]',
  caramel: 'from-[#FCD34D] to-[#F59E0B]',
  lavender: 'from-[#2DD4BF] to-[#0C7E7D]',
};

export function StatCard({
  label, value, icon, format = 'number', accent = 'gold', index = 0, suffix, delta, hint, onClick,
}: StatCardProps) {
  const animated = useCountUp(value, 1200);
  const display = format === 'currency' ? formatCurrency(animated) : formatNumber(Math.round(animated));
  const hasDelta = delta !== undefined && delta !== null && Number.isFinite(delta);
  const up = (delta ?? 0) >= 0;

  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      onClick={onClick}
      className={cn(
        'group rounded-2xl bg-gradient-card border border-black/[0.06] shadow-card p-5 relative overflow-hidden transition-all duration-200 hover:shadow-hover hover:border-gold/25',
        onClick && 'cursor-pointer'
      )}
    >
      {/* Decorative blurred accent blob */}
      <div className={cn('absolute -top-8 -right-8 h-24 w-24 rounded-full bg-gradient-to-br opacity-[0.12] blur-xl transition-opacity group-hover:opacity-20', accents[accent])} />

      <div className="flex items-start justify-between mb-3.5">
        <div className={cn('h-12 w-12 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shadow-md ring-4 ring-white/50', accents[accent])}>
          {icon}
        </div>
        {hasDelta && (
          <span className={cn(
            'inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full',
            up ? 'bg-pistachio/12 text-pistachio' : 'bg-rose-deep/12 text-rose-deep'
          )}>
            {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(delta as number).toFixed(0)}%
          </span>
        )}
      </div>

      <p className="text-[13px] font-medium text-text-muted mb-1">{label}</p>
      <p className="text-[26px] leading-tight font-bold text-text-primary tabular">
        {display}
        {suffix && <span className="text-base font-semibold text-text-muted ml-1">{suffix}</span>}
      </p>
      {hint && <p className="text-[11px] text-text-muted mt-1.5">{hint}</p>}
    </motion.div>
  );
}
