import { useState } from 'react';
import { LayoutDashboard, Smartphone, FileText, Users, Megaphone, Package, LogOut, Menu, X, Globe } from 'lucide-react';
import { useAuth, useApp } from './lib/auth';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Devices from './components/Devices';
import Files from './components/Files';
import UsersView from './components/Users';
import Announcements from './components/Announcements';
import AgentDownload from './components/AgentDownload';

type View = 'dashboard' | 'devices' | 'files' | 'users' | 'announcements' | 'agent';

export default function App() {
  const { profile, loading, signOut } = useAuth();
  const { t, lang, setLang } = useApp();
  const [view, setView] = useState<View>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-cyan-400"><div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" /></div>;
  }

  if (!profile) {
    return <Login />;
  }

  const isAdmin = profile.role === 'admin';

  const navItems: { id: View; label: string; icon: React.ComponentType<{ className?: string }>; show: boolean }[] = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard, show: true },
    { id: 'devices', label: t('devices'), icon: Smartphone, show: profile.can_view || isAdmin },
    { id: 'files', label: t('files'), icon: FileText, show: profile.can_view || isAdmin },
    { id: 'users', label: t('users'), icon: Users, show: isAdmin },
    { id: 'announcements', label: t('announcements'), icon: Megaphone, show: true },
    { id: 'agent', label: t('agentDownload'), icon: Package, show: isAdmin },
  ];

  const renderView = () => {
    switch (view) {
      case 'dashboard': return <Dashboard />;
      case 'devices': return <Devices />;
      case 'files': return <Files />;
      case 'users': return <UsersView />;
      case 'announcements': return <Announcements />;
      case 'agent': return <AgentDownload />;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[var(--bg-secondary)] border-r border-white/10 flex flex-col transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 flex items-center gap-2.5 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-400/30">
            <Smartphone className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--text-primary)]">LGPhone</div>
            <div className="text-[10px] text-[var(--text-muted)]">Control Panel</div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.filter(n => n.show).map(item => (
            <button key={item.id} onClick={() => { setView(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${view === item.id ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-400/20' : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)] border border-transparent'}`}>
              <item.icon className="w-4 h-4" /> {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10 space-y-2">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center text-xs font-semibold text-cyan-400">{profile.full_name?.[0]?.toUpperCase() || 'U'}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[var(--text-primary)] truncate">{profile.full_name || profile.email}</div>
              <div className="text-[10px] text-[var(--text-muted)]">{t(profile.role)}</div>
            </div>
          </div>
          <button onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-white/5 transition">
            <Globe className="w-3.5 h-3.5" /> {lang === 'vi' ? 'English' : 'Tiếng Việt'}
          </button>
          <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition">
            <LogOut className="w-3.5 h-3.5" /> {t('signOut')}
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-y-auto">
        <header className="lg:hidden sticky top-0 z-20 bg-[var(--bg-secondary)]/80 backdrop-blur-sm border-b border-white/10 p-4 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)}><Menu className="w-5 h-5 text-[var(--text-secondary)]" /></button>
          <span className="text-sm font-semibold text-[var(--text-primary)]">{navItems.find(n => n.id === view)?.label}</span>
        </header>
        {renderView()}
      </main>
    </div>
  );
}
