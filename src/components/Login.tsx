import { useState } from 'react';
import { Smartphone, Loader2 } from 'lucide-react';
import { useAuth, useApp } from '../lib/auth';

export default function Login() {
  const { signIn } = useAuth();
  const { t } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: err } = await signIn(email, password);
    if (err) setError(err);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-primary)]">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>
      <div className="relative panel p-8 w-full max-w-md animate-fade-in-up">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 flex items-center justify-center mb-4 border border-cyan-400/30">
            <Smartphone className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">LGPhone Control</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{t('login')}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-[var(--text-muted)] mb-1.5 block">{t('email')}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="tech-input w-full" placeholder="admin@example.com" />
          </div>
          <div>
            <label className="text-xs text-[var(--text-muted)] mb-1.5 block">{t('password')}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="tech-input w-full" placeholder="••••••••" />
          </div>
          {error && <div className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}
          <button type="submit" disabled={loading} className="btn-3d btn-3d-primary w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t('signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}
