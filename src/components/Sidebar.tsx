import { useState } from 'react';
import { LayoutDashboard, Smartphone, Users, Megaphone, FolderUp, Settings, LogOut, ChevronLeft, ChevronRight, X, Power, Sun, Moon, Globe, KeyRound, Download, Eye, EyeOff, Bot } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useApp } from '../lib/app-context';
import type { Profile } from '../lib/supabase';

export type ViewName = 'dashboard' | 'devices' | 'ai' | 'users' | 'announcements' | 'files' | 'settings';

type SidebarProps = {
  current: ViewName;
  onNavigate: (v: ViewName) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export default function Sidebar({ current, onNavigate, collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  const { profile, signOut } = useAuth() as { profile: Profile | null; signOut: () => void };
  const { theme, setTheme, lang, setLang, t } = useApp();
  const [showAccount, setShowAccount] = useState(false);

  const isAdmin = profile?.role === 'admin';
  const isManager = profile?.role === 'manager';
  const canAccessSettings = isAdmin || isManager;

  const navItems: { id: ViewName; label: string; icon: typeof LayoutDashboard; restricted?: boolean }[] = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'devices', label: t('devices'), icon: Smartphone },
    { id: 'ai', label: t('aiAutomation'), icon: Bot },
    { id: 'users', label: t('users'), icon: Users, restricted: true },
    { id: 'announcements', label: t('announcements'), icon: Megaphone, restricted: true },
    { id: 'files', label: t('files'), icon: FolderUp },
    { id: 'settings', label: t('settings'), icon: Settings, restricted: true },
  ];

  const visibleItems = navItems.filter(item => !item.restricted || canAccessSettings);

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={onCloseMobile} />}
      <aside className={`fixed md:relative z-50 h-full ${collapsed ? 'w-[68px]' : 'w-64'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} transition-all duration-300 ease-in-out bg-[var(--bg-panel)] border-r border-[var(--border-subtle)] flex flex-col`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--border-subtle)]">
          {!collapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center glow-brand">
                <Smartphone className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <div className="font-bold text-[var(--text-primary)] leading-none">LG<span className="text-cyan-400">Phone</span></div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Phone Farm v2.0</div>
              </div>
            </div>
          ) : (
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center glow-brand mx-auto">
              <Smartphone className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
          )}
          <button onClick={onCloseMobile} className="md:hidden text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1"><X className="w-5 h-5" /></button>
        </div>

        {/* Theme + Language quick bar */}
        {!collapsed && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-subtle)]">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2 py-1 rounded-lg hover:bg-white/5 transition">
              {theme === 'dark' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              <span>{theme === 'dark' ? t('darkTheme') : t('lightTheme')}</span>
            </button>
            <div className="flex-1" />
            <Globe className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <button onClick={() => setLang('vi')} className={`text-xs px-1.5 py-0.5 rounded ${lang === 'vi' ? 'text-cyan-400 bg-cyan-500/10' : 'text-[var(--text-muted)]'}`}>VI</button>
            <button onClick={() => setLang('en')} className={`text-xs px-1.5 py-0.5 rounded ${lang === 'en' ? 'text-cyan-400 bg-cyan-500/10' : 'text-[var(--text-muted)]'}`}>EN</button>
          </div>
        )}
        {collapsed && (
          <div className="flex flex-col items-center gap-2 py-2 border-b border-[var(--border-subtle)]">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-white/5">
              {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')} className="text-xs text-[var(--text-secondary)] hover:text-cyan-400">
              {lang === 'vi' ? 'VI' : 'EN'}
            </button>
          </div>
        )}

        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const active = current === item.id;
            return (
              <button key={item.id} onClick={() => { onNavigate(item.id); onCloseMobile(); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${active ? 'bg-brand-600/15 text-cyan-400' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'}`} title={collapsed ? item.label : undefined}>
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-cyan-400 rounded-r-full" />}
                <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-cyan-400' : ''}`} />
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Download agent button (admin only) */}
        {isAdmin && !collapsed && (
          <div className="px-3 pb-2">
            <a href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/agent-files/lgphone-agent.zip`} download className="btn-3d btn-3d-ghost w-full text-xs">
              <Download className="w-3.5 h-3.5" /> {t('downloadAgent')}
            </a>
          </div>
        )}

        <div className="p-2 border-t border-[var(--border-subtle)]">
          {!collapsed ? (
            <div className="panel-inner p-3">
              <div className="flex items-center gap-2.5 mb-2">
                <button onClick={() => setShowAccount(true)} className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-brand-600 flex items-center justify-center text-white text-xs font-bold hover:ring-2 hover:ring-cyan-400/30 transition">
                  {profile?.email?.[0]?.toUpperCase() || 'U'}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--text-primary)] truncate">{profile?.full_name || profile?.email}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    {isAdmin ? t('admin') : isManager ? t('manager') : t('operator')}
                  </div>
                </div>
              </div>
              <button onClick={signOut} className="btn-3d btn-3d-ghost w-full text-xs"><LogOut className="w-3.5 h-3.5" />{t('signOut')}</button>
            </div>
          ) : (
            <div className="space-y-1">
              <button onClick={() => setShowAccount(true)} className="w-full flex items-center justify-center p-2.5 rounded-lg text-[var(--text-secondary)] hover:text-cyan-400 hover:bg-cyan-500/10 transition" title={t('account')}>
                <KeyRound className="w-5 h-5" />
              </button>
              <button onClick={signOut} className="w-full flex items-center justify-center p-2.5 rounded-lg text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition" title={t('signOut')}><Power className="w-5 h-5" /></button>
            </div>
          )}
        </div>

        <button onClick={onToggleCollapse} className="hidden md:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-[var(--bg-panel-2)] border border-[var(--border-subtle)] items-center justify-center text-[var(--text-secondary)] hover:text-cyan-400 hover:border-cyan-400/30 transition z-10">
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {showAccount && <AccountModal onClose={() => setShowAccount(false)} />}
    </>
  );
}

function AccountModal({ onClose }: { onClose: () => void }) {
  const { profile, changePassword } = useAuth();
  const { t } = useApp();
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const handleChange = async () => {
    setError(''); setMsg('');
    if (newPass.length < 6) { setError(t('password') + ' >= 6'); return; }
    if (newPass !== confirmPass) { setError(t('passwordMismatch')); return; }
    setLoading(true);
    const { error: err } = await changePassword(newPass);
    if (err) setError(err);
    else { setMsg(t('passwordChanged')); setNewPass(''); setConfirmPass(''); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in-up">
      <div className="panel max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('account')}</h2>
          </div>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="panel-inner p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-brand-600 flex items-center justify-center text-white font-bold">
              {profile?.email?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">{profile?.full_name || profile?.email}</div>
              <div className="text-xs text-[var(--text-muted)]">{profile?.email}</div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('newPassword')}</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="••••••••" className="tech-input pr-12" />
              <button type="button" onClick={() => setShowPass(!showPass)} className="pass-toggle-btn active" style={{ right: '0.5rem' }}>
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('confirmPassword')}</label>
            <input type={showPass ? 'text' : 'password'} value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} placeholder="••••••••" className="tech-input" />
          </div>

          {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
          {msg && <div className="text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">{msg}</div>}

          <div className="flex gap-2">
            <button onClick={onClose} className="btn-3d btn-3d-ghost flex-1">{t('cancel')}</button>
            <button onClick={handleChange} disabled={loading || !newPass} className="btn-3d btn-3d-primary flex-1">
              {loading ? '...' : <KeyRound className="w-4 h-4" />} {t('changePassword')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
