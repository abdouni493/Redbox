import { useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface ImageUploadProps {
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
  className?: string;
}

// Reusable image picker: reads a file as a base64 data URL and stores it
// directly on the entity (product / fiche technique). Matches the logo
// upload pattern used in Settings so images persist with the local data.
export function ImageUpload({ value, onChange, label = 'Image', className = '' }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-text-secondary mb-1.5">{label}</label>
      <div className="flex items-center gap-4">
        <div className="h-24 w-24 shrink-0 rounded-2xl bg-vanilla/60 border border-gold/20 flex items-center justify-center overflow-hidden relative group">
          {value ? (
            <>
              <img src={value} alt={label} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(null)}
                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-rose-deep/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Supprimer l'image"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <ImageIcon size={30} className="text-gold/40" />
          )}
        </div>
        <label className="cursor-pointer">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-vanilla border border-gold/30 text-sm text-text-secondary hover:bg-gold/10 transition-colors">
            <Upload size={16} /> {value ? 'Changer' : 'Choisir une image'}
          </span>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>
      </div>
    </div>
  );
}
