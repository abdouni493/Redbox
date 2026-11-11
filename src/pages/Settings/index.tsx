import { useRef, useState } from 'react';
import { Settings as SettingsIcon, Store, UserCog, Database, Upload, Download, Save, AlertTriangle, Trash2, ImageDown, Loader2, Cloud } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { useLanguage } from '@/hooks/useLanguage';
import { downloadJSON } from '@/lib/utils';
import { toast } from '@/components/ui/Toast';
import { exportData, importData, resetBusinessData, flushSync } from '@/lib/cloudSync';
import { processAndUploadImage, IMAGE_DEFAULTS } from '@/lib/images';
import { optimizeExistingImages } from '@/lib/imageMigration';
import { STORE_ASSETS_BUCKET, SUPABASE_URL } from '@/lib/supabase';

export default function SettingsPage() {
  const { t } = useLanguage();
  const { settings, updateSettings } = useSettingsStore();
  const user = useAuthStore((s) => s.user);
  const updateMyAccount = useAuthStore((s) => s.updateMyAccount);
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState('store');
  const [form, setForm] = useState(settings);
  const [account, setAccount] = useState({ name: user?.name || '', username: user?.username || '', email: user?.email || '', oldPwd: '', newPwd: '', confirmPwd: '' });
  const [savingAccount, setSavingAccount] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [img, setImg] = useState({
    imageOptimize: settings.imageOptimize ?? IMAGE_DEFAULTS.imageOptimize,
    imageMaxSize: settings.imageMaxSize ?? IMAGE_DEFAULTS.imageMaxSize,
    imageQuality: settings.imageQuality ?? IMAGE_DEFAULTS.imageQuality,
  });
  const [migrating, setMigrating] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoBusy(true);
    try {
      const url = await processAndUploadImage(file, 'logo', STORE_ASSETS_BUCKET);
      set('logo', url);
    } catch {
      toast.error('Impossible de traiter le logo');
    } finally {
      setLogoBusy(false);
    }
  };

  const saveStore = () => { updateSettings(form); toast.success('Informations enregistrées'); };

  const saveImages = () => {
    const quality = Math.min(0.95, Math.max(0.3, Number(img.imageQuality) || IMAGE_DEFAULTS.imageQuality));
    const maxSize = Math.min(4000, Math.max(200, Math.round(Number(img.imageMaxSize) || IMAGE_DEFAULTS.imageMaxSize)));
    updateSettings({ imageOptimize: img.imageOptimize, imageMaxSize: maxSize, imageQuality: quality });
    setImg({ ...img, imageMaxSize: maxSize, imageQuality: quality });
    toast.success("Paramètres d'optimisation enregistrés");
  };

  const runMigration = async () => {
    setMigrating({ done: 0, total: 0 });
    try {
      const r = await optimizeExistingImages((done, total) => setMigrating({ done, total }));
      await flushSync();
      if (r.found === 0) toast.info('Aucune image à optimiser : toutes les images sont déjà dans les buckets Supabase');
      else toast.success(`${r.migrated}/${r.found} image(s) optimisée(s) — ${(r.savedBytes / 1024).toFixed(0)} Ko retirés de la base${r.failed ? ` · ${r.failed} échec(s)` : ''}`);
    } catch (e) {
      toast.error((e as Error).message || 'Erreur');
    } finally {
      setMigrating(null);
    }
  };

  const saveAccount = async () => {
    if (account.newPwd && account.newPwd.length < 6) { toast.error('Mot de passe : minimum 6 caractères'); return; }
    if (account.newPwd && account.newPwd !== account.confirmPwd) { toast.error('Les mots de passe ne correspondent pas'); return; }
    if (account.newPwd && !account.oldPwd) { toast.error("Saisissez l'ancien mot de passe"); return; }
    setSavingAccount(true);
    const res = await updateMyAccount({
      name: account.name, username: account.username, email: account.email,
      password: account.newPwd || undefined, oldPassword: account.oldPwd || undefined,
    });
    setSavingAccount(false);
    if (!res.ok) { toast.error(res.error || 'Erreur'); return; }
    toast.success('Compte mis à jour');
    setAccount({ ...account, oldPwd: '', newPwd: '', confirmPwd: '' });
  };

  const handleBackup = () => {
    downloadJSON(exportData(), `altech-backup-${new Date().toISOString().slice(0, 10)}.json`);
    toast.success('Sauvegarde téléchargée');
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!window.confirm('Remplacer les données actuelles de la base Supabase par celles de ce fichier ?')) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result as string);
        const n = importData(data);
        if (!n) { toast.error('Fichier de sauvegarde non reconnu'); return; }
        await flushSync();
        toast.success('Données restaurées dans Supabase');
      } catch {
        toast.error('Fichier invalide');
      }
    };
    reader.readAsText(file);
  };

  const handleReset = async () => {
    if (!window.confirm('Effacer toutes les données (stock, ventes, achats, clients, etc.) de la base Supabase ? Les comptes, employés et informations du magasin sont conservés. Cette action est irréversible.')) return;
    resetBusinessData();
    await flushSync();
    toast.success('Données effacées');
  };

  return (
    <div>
      <PageHeader title={t('settings')} icon={<SettingsIcon size={24} />} />
      <Tabs className="mb-6" active={tab} onChange={setTab}
        tabs={[
          { id: 'store', label: t('storeInfo') },
          { id: 'account', label: t('myAccount') },
          ...(isAdmin ? [{ id: 'images', label: 'Images' }, { id: 'database', label: t('database') }] : []),
        ]} />

      {tab === 'store' && (
        <Card index={0}>
          <div className="flex items-center gap-2 mb-4 text-gold-dark"><Store size={20} /><h3 className="font-display font-semibold text-text-primary">{t('storeInfo')}</h3></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="h-20 w-20 rounded-2xl bg-vanilla border border-gold/20 flex items-center justify-center overflow-hidden">
              {logoBusy ? <Loader2 size={28} className="text-gold animate-spin" /> : form.logo ? <img src={form.logo} alt="logo" className="h-full w-full object-cover" /> : <Store size={32} className="text-gold/40" />}
            </div>
            <label className={logoBusy ? 'pointer-events-none opacity-60' : 'cursor-pointer'}>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-vanilla border border-gold/30 text-sm text-text-secondary hover:bg-gold/10"><Upload size={16} /> Logo</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleLogo} disabled={logoBusy} />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={t('name')} value={form.name} onChange={(e) => set('name', e.target.value)} />
            <Input label={t('email')} value={form.email} onChange={(e) => set('email', e.target.value)} />
            <Input label={t('phone')} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            <Input label={t('socialMedia')} value={form.socialMedia || ''} onChange={(e) => set('socialMedia', e.target.value)} placeholder="@ma_boulengerie" />
            <Input label="NIF" value={form.nif} onChange={(e) => set('nif', e.target.value)} />
            <Input label="NIS" value={form.nis} onChange={(e) => set('nis', e.target.value)} />
            <Input label="Article" value={form.article} onChange={(e) => set('article', e.target.value)} />
            <Input label="RC" value={form.rc} onChange={(e) => set('rc', e.target.value)} />
          </div>
          <Textarea label={t('description')} value={form.description} onChange={(e) => set('description', e.target.value)} className="mt-4" />
          <Textarea label={t('address')} value={form.address} onChange={(e) => set('address', e.target.value)} className="mt-4" />
          <div className="flex justify-end mt-4"><Button variant="gold" onClick={saveStore}><Save size={16} /> {t('save')}</Button></div>
        </Card>
      )}

      {tab === 'account' && (
        <Card index={0}>
          <div className="flex items-center gap-2 mb-4 text-gold-dark"><UserCog size={20} /><h3 className="font-display font-semibold text-text-primary">{t('myAccount')}</h3></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={t('fullName')} value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} />
            <Input label={t('username')} value={account.username} onChange={(e) => setAccount({ ...account, username: e.target.value })} />
            <Input label={t('email')} value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} />
          </div>
          <div className="mt-6 pt-4 border-t border-gold/15">
            <h4 className="text-sm font-semibold text-text-secondary mb-3">{t('changePassword')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Ancien" type="password" value={account.oldPwd} onChange={(e) => setAccount({ ...account, oldPwd: e.target.value })} />
              <Input label="Nouveau" type="password" value={account.newPwd} onChange={(e) => setAccount({ ...account, newPwd: e.target.value })} />
              <Input label="Confirmer" type="password" value={account.confirmPwd} onChange={(e) => setAccount({ ...account, confirmPwd: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end mt-4"><Button variant="gold" onClick={saveAccount} disabled={savingAccount}><Save size={16} /> {savingAccount ? '…' : t('save')}</Button></div>
        </Card>
      )}

      {tab === 'images' && isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card index={0}>
            <div className="flex items-center gap-2 mb-3 text-gold-dark"><ImageDown size={20} /><h3 className="font-display font-semibold text-text-primary">Optimisation des images</h3></div>
            <p className="text-sm text-text-muted mb-4">
              Les images (produits, fiches techniques, logo) sont redimensionnées et compressées en WebP dans le navigateur
              avant d'être enregistrées dans les buckets Supabase — avec la taille la plus faible possible.
            </p>
            <div className="space-y-4">
              <Switch checked={img.imageOptimize} onChange={(v) => setImg({ ...img, imageOptimize: v })} label="Optimiser automatiquement les nouvelles images" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Taille max (px, côté le plus long)" type="number" min={200} max={4000} value={img.imageMaxSize}
                  onChange={(e) => setImg({ ...img, imageMaxSize: Number(e.target.value) })} disabled={!img.imageOptimize} />
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Qualité : {Math.round(Number(img.imageQuality) * 100)}%</label>
                  <input type="range" min={0.3} max={0.95} step={0.05} value={img.imageQuality} disabled={!img.imageOptimize}
                    onChange={(e) => setImg({ ...img, imageQuality: Number(e.target.value) })} className="w-full accent-[#C9A84C] mt-2" />
                  <p className="text-[11px] text-text-muted mt-1">Plus bas = fichiers plus légers. Conseillé : 70 %.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {[{ l: 'Ultra léger', s: 480, q: 0.6 }, { l: 'Équilibré', s: 800, q: 0.72 }, { l: 'Haute qualité', s: 1280, q: 0.85 }].map((p) => (
                  <button key={p.l} type="button" disabled={!img.imageOptimize}
                    onClick={() => setImg({ ...img, imageMaxSize: p.s, imageQuality: p.q })}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${img.imageMaxSize === p.s && img.imageQuality === p.q ? 'bg-gold/15 border-gold text-gold-dark' : 'border-gold/20 text-text-secondary hover:bg-gold/5'}`}>
                    {p.l} · {p.s}px · {Math.round(p.q * 100)}%
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end mt-4"><Button variant="gold" onClick={saveImages}><Save size={16} /> {t('save')}</Button></div>
          </Card>
          <Card index={1}>
            <div className="flex items-center gap-2 mb-3 text-pistachio"><Cloud size={20} /><h3 className="font-display font-semibold text-text-primary">Images existantes</h3></div>
            <p className="text-sm text-text-muted mb-4">
              Convertit les images encore enregistrées directement dans la base (format base64) en fichiers optimisés
              dans le bucket <span className="font-mono text-xs">product-images</span> / <span className="font-mono text-xs">store-assets</span>, pour alléger la base de données.
            </p>
            {migrating && (
              <div className="mb-4">
                <div className="h-2 rounded-full bg-vanilla overflow-hidden">
                  <div className="h-full bg-gradient-button transition-all" style={{ width: `${migrating.total ? (migrating.done / migrating.total) * 100 : 5}%` }} />
                </div>
                <p className="text-xs text-text-muted mt-1">{migrating.done} / {migrating.total}</p>
              </div>
            )}
            <Button variant="gold" onClick={runMigration} disabled={!!migrating}>
              {migrating ? <Loader2 size={16} className="animate-spin" /> : <ImageDown size={16} />} Optimiser les images existantes
            </Button>
          </Card>
        </div>
      )}

      {tab === 'database' && isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card index={0}>
            <div className="flex items-center gap-2 mb-3 text-pistachio"><Download size={20} /><h3 className="font-display font-semibold text-text-primary">{t('backup')}</h3></div>
            <p className="text-sm text-text-muted mb-1">Exporter toutes les données de la base Supabase en JSON</p>
            <p className="text-[11px] text-text-muted mb-4 font-mono truncate">{SUPABASE_URL}</p>
            <Button variant="gold" onClick={handleBackup}><Download size={16} /> {t('downloadBackup')}</Button>
          </Card>
          <Card index={1} className="border-rose-deep/20">
            <div className="flex items-center gap-2 mb-3 text-rose-deep"><Database size={20} /><h3 className="font-display font-semibold text-text-primary">{t('restore')}</h3></div>
            <p className="text-sm text-text-muted mb-2">Importer un fichier JSON de sauvegarde</p>
            <p className="text-xs text-rose-deep flex items-center gap-1 mb-4"><AlertTriangle size={14} /> Remplace toutes les données actuelles</p>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={handleRestore} />
            <Button variant="danger" onClick={() => fileRef.current?.click()}><Upload size={16} /> {t('selectFile')}</Button>
          </Card>
          <Card index={2} className="border-rose-deep/20">
            <div className="flex items-center gap-2 mb-3 text-rose-deep"><Trash2 size={20} /><h3 className="font-display font-semibold text-text-primary">Réinitialiser</h3></div>
            <p className="text-sm text-text-muted mb-2">Effacer toutes les données métier (stock, ventes, achats…)</p>
            <p className="text-xs text-rose-deep flex items-center gap-1 mb-4"><AlertTriangle size={14} /> Conserve les comptes, les employés et le magasin</p>
            <Button variant="danger" onClick={handleReset}><Trash2 size={16} /> Tout effacer</Button>
          </Card>
        </div>
      )}
    </div>
  );
}
