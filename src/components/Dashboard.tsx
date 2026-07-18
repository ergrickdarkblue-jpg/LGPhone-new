import { useEffect, useState } from 'react';
import { Smartphone, Wifi, WifiOff, Users, FileText, Loader2, Activity } from 'lucide-react';
import { supabase, type Device, type AppFile } from '../lib/supabase';
import { useApp } from '../lib/auth';

export default function Dashboard() {
  const { t } = useApp();
  const [devices, setDevices] = useState<Device[]>([]);
  const [files, setFiles] = useState<AppFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [d, f] = await Promise.all([
        supabase.from('devices').select('*').order('created_at', { ascending: false }),
        supabase.from('app_files').select('*').order('created_at', { ascending: false }),
      ]);
      setDevices(d.data as Device[] || []);
      setFiles(f.data as AppFile[] || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="h-64 flex items-center justify-center text-[var(--text-muted)]"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const online = devices.filter(d => d.status === 'online').length;
  const offline = devices.filter(d => d.status === 'offline').length;
  const assigned = devices.filter(d => d.assigned_to).length;
  const userApps = files.filter(f => !f.is_system).length;
  const systemApps = files.filter(f => f.is_system).length;

  const stats = [
    { label: t('total') + ' ' + t('devices'), value: devices.length, icon: Smartphone, color: 'cyan' },
    { label: t('online'), value: online, icon: Wifi, color: 'green' },
    { label: t('offline'), value: offline, icon: WifiOff, color: 'slate' },
    { label: t('assigned'), value: assigned, icon: Users, color: 'blue' },
    { label: t('userApps'), value: userApps, icon: FileText, color: 'cyan' },
    { label: t('systemApps'), value: systemApps, icon: Activity, color: 'slate' },
  ];

  return (
    <div className="p-6 animate-fade-in-up">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{t('dashboard')}</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {stats.map((s, i) => (
          <div key={i} className="panel p-4 hover:border-[var(--border-active)] transition">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-${s.color}-500/10`}>
              <s.icon className={`w-5 h-5 text-${s.color}-400`} />
            </div>
            <div className="text-2xl font-bold text-[var(--text-primary)]">{s.value}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="panel p-6">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">{t('devices')}</h2>
        {devices.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">{t('noDevices')}</p>
        ) : (
          <div className="space-y-2">
            {devices.slice(0, 10).map(d => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${d.status === 'online' ? 'bg-green-400' : 'bg-slate-600'}`} />
                  <span className="text-sm text-[var(--text-primary)]">{d.name}</span>
                  <span className="text-xs text-[var(--text-muted)]">{d.model}</span>
                </div>
                <span className="text-xs text-[var(--text-muted)]">{d.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
