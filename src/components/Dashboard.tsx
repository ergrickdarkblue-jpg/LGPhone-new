import { useEffect, useState } from 'react';
import { Smartphone, Wifi, WifiOff, Users, Activity, Server, Cpu, Monitor, ChevronRight } from 'lucide-react';
import { supabase, type Device, type Announcement } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useApp } from '../lib/app-context';
import type { ViewName } from './Sidebar';

export default function Dashboard({ onNavigate }: { onNavigate: (v: ViewName) => void }) {
  const { profile } = useAuth();
  const { t } = useApp();
  const [devices, setDevices] = useState<Device[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('devices').select('*').order('created_at', { ascending: true }),
      supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(5),
    ]).then(([devRes, annRes]) => {
      setDevices((devRes.data as Device[]) || []);
      setAnnouncements((annRes.data as Announcement[]) || []);
      setLoading(false);
    });

    const devChannel = supabase.channel('dashboard-devices')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new) setDevices(prev => [...prev, payload.new as Device]);
        else if (payload.eventType === 'UPDATE' && payload.new) setDevices(prev => prev.map(d => d.id === (payload.new as Device).id ? payload.new as Device : d));
        else if (payload.eventType === 'DELETE' && payload.old) setDevices(prev => prev.filter(d => d.id !== (payload.old as Device).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(devChannel); };
  }, []);

  const onlineCount = devices.filter(d => d.status === 'online').length;
  const offlineCount = devices.filter(d => d.status === 'offline').length;
  const assignedCount = devices.filter(d => d.assigned_to !== null).length;
  const availableCount = devices.length - assignedCount;

  const roleLabel = profile?.role === 'admin' ? t('admin') : profile?.role === 'manager' ? t('manager') : t('operator');

  const stats = [
    { label: t('totalDevices'), value: devices.length, icon: Smartphone, color: 'text-brand-400', bg: 'bg-brand-500/10' },
    { label: t('online'), value: onlineCount, icon: Wifi, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: t('offline'), value: offlineCount, icon: WifiOff, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: t('inUse'), value: assignedCount, icon: Users, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: t('available'), value: availableCount, icon: Activity, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('systemOverview')}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{t('hello')}, {profile?.full_name || profile?.email} — {t('role')}: {roleLabel}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"><Server className="w-4 h-4 text-green-400" /><span>{t('systemActive')}</span></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="panel p-4 hover:border-[var(--border-active)] transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}><Icon className={`w-5 h-5 ${stat.color}`} /></div>
              </div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">{loading ? '—' : stat.value}</div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">{stat.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><Monitor className="w-4 h-4 text-cyan-400" />{t('deviceStatus')}</h2>
            <button onClick={() => onNavigate('devices')} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">{t('viewAll')} <ChevronRight className="w-3 h-3" /></button>
          </div>
          {loading ? (
            <div className="h-40 flex items-center justify-center text-[var(--text-muted)] text-sm">{t('loading')}</div>
          ) : devices.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-[var(--text-muted)] text-sm gap-2"><Smartphone className="w-8 h-8 opacity-40" />{t('noDevices')}</div>
          ) : (
            <>
              <div className="flex h-3 rounded-full overflow-hidden bg-white/5 mb-4">
                <div className="bg-green-500/80 transition-all" style={{ width: `${(onlineCount / devices.length) * 100}%` }} />
                <div className="bg-red-500/60 transition-all" style={{ width: `${(offlineCount / devices.length) * 100}%` }} />
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5"><span className="status-dot online" /> {t('online')} ({onlineCount})</div>
                <div className="flex items-center gap-1.5"><span className="status-dot offline" /> {t('offline')} ({offlineCount})</div>
                <div className="flex items-center gap-1.5 text-[var(--text-secondary)]"><Cpu className="w-3.5 h-3.5" /> {t('assigned')}: {assignedCount} / {t('available')}: {availableCount}</div>
              </div>
              <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                {devices.slice(0, 8).map(d => (
                  <div key={d.id} className="flex items-center justify-between panel-inner px-3 py-2">
                    <div className="flex items-center gap-2.5"><span className={`status-dot ${d.status}`} /><span className="text-sm text-[var(--text-primary)] font-medium">{d.name}</span><span className="text-xs text-[var(--text-muted)]">{d.model || d.serial}</span></div>
                    <span className={`tech-badge ${d.assigned_to ? 'bg-cyan-500/10 text-cyan-400' : 'bg-slate-500/10 text-[var(--text-muted)]'}`}>{d.assigned_to ? t('inUse') : t('available')}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><Activity className="w-4 h-4 text-amber-400" />{t('latestAnnouncements')}</h2>
          </div>
          {announcements.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-[var(--text-muted)] text-sm">{t('noAnnouncements')}</div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {announcements.map(a => (
                <div key={a.id} className="panel-inner p-3">
                  <div className="text-sm font-medium text-[var(--text-primary)]">{a.title}</div>
                  <div className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{a.content}</div>
                  <div className="text-[10px] text-[var(--text-muted)] mt-2">{new Date(a.created_at).toLocaleString('vi-VN')}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
