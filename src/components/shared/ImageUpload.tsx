import { useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { processAndUploadImage } from '@/lib/images';
import { toast } from '@/components/ui/Toast';

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  className?: string;
  /** Folder inside the `product-images` bucket */
  folder?: string;
}

// Reusable image picker: the picture is optimised in the browser (resize +
// WebP compression, see Paramètres → Images) and uploaded to the Supabase
// storage bucket. Only the public URL is stored on the entity.
export function ImageUpload({ value, onChange, label = 'Image', className = '', folder = 'products' }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Fichier image requis'); return; }
    setBusy(true);
    setInfo(null);
    try {
      const url = await processAndUploadImage(file, folder);
      onChange(url);
      if (url.startsWith('data:')) toast.warning("Image gardée localement (envoi vers Supabase impossible)");
      else setInfo(`Optimisée (original ${(file.size / 1024).toFixed(0)} Ko)`);
    } catch (err) {
      console.error(err);
      toast.error("Impossible de traiter cette image");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-text-secondary mb-1.5">{label}</label>
      <div className="flex items-center gap-4">
        <div className="h-24 w-24 shrink-0 rounded-2xl bg-vanilla/60 border border-gold/20 flex items-center justify-center overflow-hidden relative group">
          {busy ? (
            <Loader2 size={26} className="text-gold animate-spin" />
          ) : value ? (
            <>
              <img src={value} alt={label} className="h-full w-full object-cover" loading="lazy" />
              <button
                type="button"
                onClick={() => { onChange(null); setInfo(null); }}
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
        <div className="space-y-1">
          <label className={busy ? 'pointer-events-none opacity-60' : 'cursor-pointer'}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-vanilla border border-gold/30 text-sm text-text-secondary hover:bg-gold/10 transition-colors">
              <Upload size={16} /> {busy ? 'Optimisation…' : value ? 'Changer' : 'Choisir une image'}
            </span>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={busy} />
          </label>
          {info && <p className="text-[11px] text-pistachio">{info}</p>}
        </div>
      </div>
    </div>
  );
}
