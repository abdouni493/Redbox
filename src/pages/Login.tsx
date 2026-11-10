import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Pizza, Lock, User, Mail, ChevronDown, Eye, EyeOff, Sandwich } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/components/ui/Toast';
import { useSettingsStore } from '@/store/settingsStore';
import { LogoBadge } from '@/components/shared/LogoBadge';

const floatingIcons = Array.from({ length: 14 }).map((_, i) => ({
  id: i,
  left: `${(i * 7.5 + 3) % 95}%`,
  top: `${(i * 11 + 5) % 90}%`,
  size: 18 + (i % 5) * 10,
  delay: i * 0.35,
  duration: 7 + (i % 4),
  icon: i % 3 === 0 ? 'pizza' : 'sandwich',
}));

export default function Login() {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const login = useAuthStore((s) => s.login);
  const createAccount = useAuthStore((s) => s.createAccount);
  const hasAccounts = useAuthStore((s) => s.registeredAccounts.length > 0);
  const store = useSettingsStore((s) => s.settings);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [shake, setShake] = useState(false);

  // On first launch there is no admin account yet — open the creation form directly.
  const [showCreate, setShowCreate] = useState(!hasAccounts);
  const [reg, setReg] = useState({ name: '', username: '', email: '', password: '', confirm: '' });
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = login({ identifier, password });
    if (ok) {
      toast.success(t('welcome') + ' 👋');
      navigate('/dashboard');
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      toast.error(t('invalidCredentials'));
    }
  };

  const handleDemoLogin = () => {
    const ok = login({ identifier: 'admin', password: 'admin' });
    if (ok) {
      toast.success(t('welcome') + ' (Demo Admin) 👋');
      navigate('/dashboard');
    } else {
      toast.error('Erreur lors de la connexion démo');
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (reg.name.trim().length < 3) errs.name = 'Minimum 3 caractères';
    if (reg.username.trim().length < 3) errs.username = 'Minimum 3 caractères';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(reg.email)) errs.email = 'Email invalide';
    if (reg.password.length < 6) errs.password = 'Minimum 6 caractères';
    if (reg.password !== reg.confirm) errs.confirm = 'Les mots de passe ne correspondent pas';
    setRegErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const res = createAccount({ name: reg.name, username: reg.username, email: reg.email, password: reg.password });
    if (res.ok) {
      toast.success(t('accountCreated'));
      setShowCreate(false);
      setIdentifier(reg.username);
      setReg({ name: '', username: '', email: '', password: '', confirm: '' });
    } else {
      toast.error(res.error || 'Erreur');
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-hero flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle warm overlay pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `radial-gradient(circle at 20% 30%, rgba(200,137,46,0.3) 0%, transparent 50%), 
                          radial-gradient(circle at 80% 70%, rgba(212,133,106,0.2) 0%, transparent 50%)`
      }} />

      {/* Floating background icons — wheat and croissant */}
      {floatingIcons.map((f) => (
        <motion.div
          key={f.id}
          className="absolute text-amber-200/15 pointer-events-none"
          style={{ left: f.left, top: f.top }}
          animate={{ y: [0, -25, 0], rotate: [0, 12, 0], opacity: [0.08, 0.2, 0.08] }}
          transition={{ duration: f.duration, delay: f.delay, repeat: Infinity, ease: 'easeInOut' }}
        >
          {f.icon === 'pizza' ? <Pizza size={f.size} /> : <Sandwich size={f.size} />}
        </motion.div>
      ))}

      {/* Language selector */}
      <div className="absolute top-5 right-5 z-20 flex gap-2">
        <button
          onClick={() => setLanguage('fr')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            language === 'fr' ? 'bg-white text-chocolate shadow-lg' : 'bg-white/15 text-amber-100 hover:bg-white/25'
          }`}
        >
          🇫🇷 FR
        </button>
        <button
          onClick={() => setLanguage('ar')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            language === 'ar' ? 'bg-white text-chocolate shadow-lg' : 'bg-white/15 text-amber-100 hover:bg-white/25'
          }`}
        >
          🇩🇿 AR
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={shake ? { x: [0, -10, 10, -10, 10, -6, 6, 0] } : { opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass rounded-3xl shadow-2xl p-8 border-2 border-gold/25 bg-cream/95">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <motion.div
              initial={{ rotate: -20, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="mb-3"
            >
              <LogoBadge size={68} icon={36} />
            </motion.div>
            <h1 className="font-display text-2xl font-bold text-text-primary text-center">{store.name}</h1>
            <p className="text-sm text-text-muted">{store.description}</p>
          </div>

          {/* Login form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              icon={<User size={18} />}
              placeholder={t('emailOrUsername')}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
            <Input
              icon={<Lock size={18} />}
              type={showPwd ? 'text' : 'password'}
              placeholder={t('password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              suffix={
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="text-text-muted">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
            <Button type="submit" variant="gold" size="lg" className="w-full">
              {t('login')}
            </Button>
          </form>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gold/15"></div>
            <span className="flex-shrink mx-4 text-xs text-text-muted font-medium">OU</span>
            <div className="flex-grow border-t border-gold/15"></div>
          </div>

          <Button
            type="button"
            onClick={handleDemoLogin}
            variant="outline"
            size="lg"
            className="w-full flex items-center justify-center gap-2 border-gold/30 hover:border-gold hover:bg-gold/10 text-gold-dark font-semibold shadow-sm"
          >
            <Sandwich size={18} className="animate-pulse text-gold" />
            Accès Démo Admin (Rapide)
          </Button>

          {/* First-run hint: no admin account exists yet */}
          {!hasAccounts && (
            <p className="text-center text-xs text-text-muted mt-4">
              {t('firstRunHint')}
            </p>
          )}

          {/* Create account */}
          <div className="mt-4">
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center justify-center gap-1.5 w-full text-sm text-text-secondary hover:text-gold-dark transition-colors py-2"
            >
              {t('createAdmin')}
              <ChevronDown size={16} className={`transition-transform ${showCreate ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {showCreate && (
                <motion.form
                  onSubmit={handleCreate}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden space-y-3 pt-2"
                >
                  <Input icon={<User size={18} />} placeholder={t('fullName')} value={reg.name}
                    onChange={(e) => setReg({ ...reg, name: e.target.value })} error={regErrors.name} />
                  <Input icon={<User size={18} />} placeholder={t('username')} value={reg.username}
                    onChange={(e) => setReg({ ...reg, username: e.target.value })} error={regErrors.username} />
                  <Input icon={<Mail size={18} />} placeholder={t('email')} value={reg.email}
                    onChange={(e) => setReg({ ...reg, email: e.target.value })} error={regErrors.email} />
                  <Input icon={<Lock size={18} />} type="password" placeholder={t('password')} value={reg.password}
                    onChange={(e) => setReg({ ...reg, password: e.target.value })} error={regErrors.password} />
                  <Input icon={<Lock size={18} />} type="password" placeholder={t('confirmPassword')} value={reg.confirm}
                    onChange={(e) => setReg({ ...reg, confirm: e.target.value })} error={regErrors.confirm} />
                  <Button type="submit" variant="rose" className="w-full">
                    {t('create')}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
