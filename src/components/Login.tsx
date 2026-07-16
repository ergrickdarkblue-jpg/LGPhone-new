import { useState } from 'react';
import { Smartphone, Lock, Mail, Eye, EyeOff, Shield, Zap, Server, Globe } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useApp } from '../lib/app-context';

export default function Login() {
  const { signIn } = useAuth();
  const { lang, setLang, t } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await signIn(email, password);
    if (err) setError(err);
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full tech-grid-bg flex items-center justify-center p-4 relative overflow-hidden" style={{ background: '#060910' }}>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Language switcher - top right */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <Globe className="w-4 h-4 text-slate-500" />
        <button onClick={() => setLang('vi')} className={`text-xs px-2 py-1 rounded ${lang === 'vi' ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-500 hover:text-slate-300'}`}>VI</button>
        <button onClick={() => setLang('en')} className={`text-xs px-2 py-1 rounded ${lang === 'en' ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-500 hover:text-slate-300'}`}>EN</button>
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 glow-brand mb-4">
            <Smartphone className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            LG<span className="text-cyan-400">Phone</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Phone Farm Management System</p>
        </div>

        <div className="panel p-8 glow-brand" style={{ background: '#0c1220', borderColor: 'rgba(80,130,220,0.12)' }}>
          <div className="flex items-center gap-2 mb-6">
            <Shield className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">{t('loginTitle')}</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">{t('email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@lgphone.system" className="tech-input pl-10" style={{ background: 'rgba(255,255,255,0.03)', color: '#e8f0ff' }} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">{t('password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type={showPass ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="tech-input pl-10 pr-12" style={{ background: 'rgba(255,255,255,0.03)', color: '#e8f0ff' }} />
                <button type="button" onClick={() => setShowPass(!showPass)} className="pass-toggle-btn active" style={{ right: '0.5rem' }}>
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
            <button type="submit" disabled={loading} className="btn-3d btn-3d-primary w-full">
              {loading ? t('authenticating') : t('signIn')}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/5">
            <p className="text-xs text-slate-500 text-center">{t('loginNotice')}</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6 mt-6 text-xs text-slate-500">
          <div className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-cyan-400" /><span>Real-time Control</span></div>
          <div className="flex items-center gap-1.5"><Server className="w-3.5 h-3.5 text-green-400" /><span>Cloud Sync</span></div>
          <div className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-brand-400" /><span>Secure Access</span></div>
        </div>
      </div>
    </div>
  );
}
