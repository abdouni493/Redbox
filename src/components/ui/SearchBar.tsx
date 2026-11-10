import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
}

export function SearchBar({ value, onChange, placeholder = 'Rechercher...', className, onFocus }: SearchBarProps) {
  return (
    <div className={cn('relative w-full', className)}>
      <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={onFocus}
        className="w-full h-11 rounded-xl border border-gold/25 bg-white/80 pl-11 pr-10 text-sm text-text-primary placeholder:text-text-muted/70 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/50 transition-all"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-rose-deep transition-colors"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
