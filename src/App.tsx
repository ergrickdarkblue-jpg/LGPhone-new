import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { AppProvider, useApp } from './lib/app-context';
import { supabase } from './lib/supabase';
import Login from './components/Login';
import Sidebar, { type ViewName } from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Devices from './components/Devices';
import Users from './components/Users';
import Announcements from './components/Announcements';
import Files from './components/Files';
import Settings from './components/Settings';
import AI from './components/AI';
import { Smartphone, Menu, Shield, Loader2, Mail, Lock, User as UserIcon, CheckCircle2, Eye, EyeOff } from 'lucide-react';

function MainApp() {
  const { session, profile, loading } = useAuth();
  const { t } = useApp();
  const [view, setView] = useState<ViewName>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [needsAdminSetup, setNeedsAdminSetup] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin')
      .then(({ count }) => { setNeedsAdminSetup(count === 0); });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center tech-grid-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center glow-brand animate-pulse">
            <Smartphone className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
          <p className="text-xs text-[var(--text-muted)]">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (needsAdminSetup && !session) return <AdminSetup onDone={() => setNeedsAdminSetup(false)} />;
  if (!session || !profile) return <Login />;

  if (!profile.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center tech-grid-bg p-4">
        <div className="panel p-8 max-w-md text-center">
          <Shield className="w-12 h-12 text-red-400/50 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{t('accountLocked')}</h2>
          <p className="text-sm text-[var(--text-secondary)]">{t('contactAdmin')}</p>
        </div>
      </div>
    );
  }

  // Block operators from accessing settings
  const canAccessSettings = profile.role === 'admin' || profile.role === 'manager';
  const effectiveView = (view === 'settings' && !canAccessSettings) ? 'dashboard' : view;

  return (
    <div className="flex h-screen overflow-hidden tech-grid-bg">
      <Sidebar
        current={effectiveView}
        onNavigate={setView}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="md:hidden h-14 flex items-center gap-3 px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]">
          <button onClick={() => setMobileOpen(true)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><Menu className="w-5 h-5" /></button>
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-cyan-400" />
            <span className="font-bold text-[var(--text-primary)]">LG<span className="text-cyan-400">Phone</span></span>
          </div>
        </div>
        <main className="flex-1 overflow-y-auto">
          {effectiveView === 'dashboard' && <Dashboard onNavigate={setView} />}
          {effectiveView === 'devices' && <Devices />}
          {effectiveView === 'ai' && <AI />}
          {effectiveView === 'users' && <Users />}
          {effectiveView === 'announcements' && <Announcements />}
          {effectiveView === 'files' && <Files />}
          {effectiveView === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  );
}

function AdminSetup({ onDone }: { onDone: () => void }) {
  const { t } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPass, setShowPass] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSetup = async () => {
    setLoading(true); setError('');
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lgphone-admin?action=seed_admin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
    const json = await res.json();
    if (json.error) setError(json.error);
    else { setSuccess(true); setTimeout(onDone, 2000); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full tech-grid-bg flex items-center justify-center p-4 relative overflow-hidden" style={{ background: '#060910' }}>
      <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-brand-700 glow-cyan mb-4">
            <Shield className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-white">{t('initialSetup')}</h1>
          <p className="text-sm text-slate-400 mt-1">{t('setupDesc')}</p>
        </div>
        {success ? (
          <div className="panel p-8 text-center" style={{ background: '#0c1220' }}>
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-white">{t('adminCreated')}</h2>
            <p className="text-sm text-slate-400 mt-1">{t('adminCreatedDesc')}</p>
          </div>
        ) : (
          <div className="panel p-8 glow-cyan" style={{ background: '#0c1220', borderColor: 'rgba(80,130,220,0.12)' }}>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{t('fullName')}</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Administrator" className="tech-input pl-10" style={{ background: 'rgba(255,255,255,0.03)', color: '#e8f0ff' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{t('email')}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@lgphone.system" className="tech-input pl-10" style={{ background: 'rgba(255,255,255,0.03)', color: '#e8f0ff' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{t('password')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="tech-input pl-10 pr-12" style={{ background: 'rgba(255,255,255,0.03)', color: '#e8f0ff' }} />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="pass-toggle-btn active" style={{ right: '0.5rem' }}>
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
              <button onClick={handleSetup} disabled={loading || !email || !password} className="btn-3d btn-3d-cyan w-full">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />} {t('createAdmin')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </AppProvider>
  );
}
