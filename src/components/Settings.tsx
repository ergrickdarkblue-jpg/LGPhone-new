import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Server, Plus, Trash2, Edit2, X, Loader2, Cpu, Wifi, Save, Smartphone, HardDrive, RefreshCw, Download, ShieldAlert } from 'lucide-react';
import { supabase, type Device, type SystemSetting } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useApp } from '../lib/app-context';

export default function Settings() {
  const { profile } = useAuth();
  const { t } = useApp();
  const isAdmin = profile?.role === 'admin';
  const isManager = profile?.role === 'manager';
  const canAccess = isAdmin || isManager;
  const [tab, setTab] = useState<'system' | 'devices' | 'vm' | 'agent'>('system');
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);

  const fetchAll = async () => {
    const [sRes, dRes] = await Promise.all([
      supabase.from('system_settings').select('*'),
      supabase.from('devices').select('*').order('name'),
    ]);
    setSettings((sRes.data as SystemSetting[]) || []);
    setDevices((dRes.data as Device[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  if (!canAccess) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-center">
          <ShieldAlert className="w-12 h-12 text-red-400/50 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">{t('settingsBlocked')}</h2>
          <p className="text-sm text-[var(--text-secondary)]">{t('settingsBlockedDesc')}</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'system' as const, label: t('system'), icon: SettingsIcon },
    { id: 'devices' as const, label: t('devices'), icon: Smartphone },
    { id: 'vm' as const, label: t('vmTab'), icon: Server },
    ...(isAdmin ? [{ id: 'agent' as const, label: 'Agent', icon: Download }] : []),
  ];

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('settingsTitle')}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{t('settingsDesc')}</p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t2 => {
          const Icon = t2.icon;
          return (
            <button key={t2.id} onClick={() => setTab(t2.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === t2.id ? 'bg-brand-600/20 text-cyan-400 border border-cyan-400/30' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:bg-white/5'}`}>
              <Icon className="w-4 h-4" /> {t2.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-[var(--text-muted)]"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : tab === 'system' ? (
        <SystemSettings settings={settings} isAdmin={isAdmin} onSaved={fetchAll} />
      ) : tab === 'devices' ? (
        <DeviceSettings devices={devices} isAdmin={isAdmin} onSaved={fetchAll} showAdd={() => setShowAddDevice(true)} onEdit={(d) => setEditingDevice(d)} />
      ) : tab === 'vm' ? (
        <VMSettings settings={settings} devices={devices} isAdmin={isAdmin} onSaved={fetchAll} />
      ) : (
        <AgentDownload />
      )}

      {showAddDevice && <DeviceModal onClose={() => setShowAddDevice(false)} onSaved={() => { setShowAddDevice(false); fetchAll(); }} />}
      {editingDevice && <DeviceModal device={editingDevice} onClose={() => setEditingDevice(null)} onSaved={() => { setEditingDevice(null); fetchAll(); }} />}
    </div>
  );
}

function AgentDownload() {
  const { t } = useApp();
  return (
    <div className="panel p-6 max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center">
          <Download className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('downloadAgent')}</h2>
          <p className="text-xs text-[var(--text-muted)]">{t('agentDownloadAdminOnly')}</p>
        </div>
      </div>
      <div className="panel-inner p-4 space-y-3">
        <p className="text-sm text-[var(--text-secondary)]">
          File ZIP chứa Node.js ADB Agent — bridge giữa web LGPhone và thiết bị Android. Giải nén, tạo file .env, và chạy <code className="text-cyan-400">start.bat</code>.
        </p>
        <a href="/lgphone-agent.zip" download className="btn-3d btn-3d-cyan">
          <Download className="w-4 h-4" /> {t('downloadAgent')}
        </a>
      </div>
    </div>
  );
}

function SystemSettings({ settings, isAdmin, onSaved }: { settings: SystemSetting[]; isAdmin: boolean; onSaved: () => void }) {
  const { t } = useApp();
  const [adbHost, setAdbHost] = useState(settings.find(s => s.key === 'adb_host')?.value || '127.0.0.1');
  const [adbPort, setAdbPort] = useState(settings.find(s => s.key === 'adb_port')?.value || '5037');
  const [screenQuality, setScreenQuality] = useState(settings.find(s => s.key === 'screen_quality')?.value || 'medium');
  const [autoConnect, setAutoConnect] = useState(settings.find(s => s.key === 'auto_connect')?.value === 'true');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const updates = [
      { key: 'adb_host', value: adbHost },
      { key: 'adb_port', value: adbPort },
      { key: 'screen_quality', value: screenQuality },
      { key: 'auto_connect', value: autoConnect ? 'true' : 'false' },
    ];
    for (const u of updates) {
      await supabase.from('system_settings').upsert({ ...u, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    }
    setSaving(false); onSaved();
  };

  return (
    <div className="panel p-6 max-w-2xl space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{t('adbConfig')}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('adbHost')}</label>
            <div className="relative">
              <Wifi className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input value={adbHost} onChange={(e) => setAdbHost(e.target.value)} disabled={!isAdmin} className="tech-input pl-10" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('adbPort')}</label>
            <input value={adbPort} onChange={(e) => setAdbPort(e.target.value)} disabled={!isAdmin} className="tech-input" />
          </div>
        </div>
      </div>
      <div className="pt-4 border-t border-white/5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{t('screenDisplay')}</h2>
        <p className="text-xs text-[var(--text-muted)] mb-4">{t('screenQuality')}</p>
        <div className="flex gap-2">
          {['low', 'medium', 'high'].map(q => (
            <button key={q} onClick={() => setScreenQuality(q)} disabled={!isAdmin} className={`px-4 py-2 rounded-lg text-xs font-medium transition ${screenQuality === q ? 'bg-brand-600/20 text-cyan-400 border border-cyan-400/30' : 'text-[var(--text-secondary)] border border-transparent hover:bg-white/5'}`}>
              {q === 'low' ? t('low') : q === 'medium' ? t('medium') : t('high')}
            </button>
          ))}
        </div>
      </div>
      <div className="pt-4 border-t border-white/5">
        <div className="flex items-center gap-3 panel-inner p-3">
          <RefreshCw className="w-5 h-5 text-cyan-400" />
          <div className="flex-1">
            <div className="text-sm text-[var(--text-primary)]">{t('autoConnect')}</div>
            <div className="text-xs text-[var(--text-muted)]">{t('autoConnectDesc')}</div>
          </div>
          <div className={`toggle-switch ${autoConnect ? 'on' : ''}`} onClick={() => isAdmin && setAutoConnect(!autoConnect)}><div className="knob" /></div>
        </div>
      </div>
      {isAdmin && <button onClick={save} disabled={saving} className="btn-3d btn-3d-primary">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t('saveSettings')}</button>}
    </div>
  );
}

function DeviceSettings({ devices, isAdmin, onSaved, showAdd, onEdit }: { devices: Device[]; isAdmin: boolean; onSaved: () => void; showAdd: () => void; onEdit: (d: Device) => void }) {
  const { t } = useApp();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">{devices.length} {t('devicesRegistered')}</p>
        {isAdmin && <button onClick={showAdd} className="btn-3d btn-3d-primary"><Plus className="w-4 h-4" /> {t('addDevice')}</button>}
      </div>
      {devices.length === 0 ? (
        <div className="panel p-12 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3">
          <Smartphone className="w-12 h-12 opacity-30" />
          <p>{t('noDevices')}</p>
          {isAdmin && <p className="text-xs">{t('addDeviceHint')}</p>}
        </div>
      ) : (
        <div className="panel overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-xs text-[var(--text-muted)] uppercase tracking-wider">
                <th className="text-left p-4 font-medium">{t('devices')}</th>
                <th className="text-left p-4 font-medium">{t('serialAdb')}</th>
                <th className="text-left p-4 font-medium">{t('model')}</th>
                <th className="text-left p-4 font-medium">{t('group')}</th>
                <th className="text-center p-4 font-medium">{t('vm')}</th>
                <th className="text-center p-4 font-medium">{t('status')}</th>
                {isAdmin && <th className="text-right p-4 font-medium">{t('save')}</th>}
              </tr>
            </thead>
            <tbody>
              {devices.map(d => (
                <tr key={d.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="p-4 text-sm text-[var(--text-primary)] font-medium">{d.name}</td>
                  <td className="p-4 text-xs text-[var(--text-secondary)] font-mono">{d.serial}</td>
                  <td className="p-4 text-sm text-[var(--text-secondary)]">{d.model || '—'}</td>
                  <td className="p-4 text-sm text-[var(--text-secondary)]">{d.group_label || '—'}</td>
                  <td className="p-4 text-center">{d.vm_id ? <span className="tech-badge bg-cyan-500/10 text-cyan-400">{d.vm_id}</span> : <span className="text-xs text-[var(--text-muted)]">{t('real')}</span>}</td>
                  <td className="p-4 text-center"><span className={`status-dot ${d.status}`} /></td>
                  {isAdmin && (
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => onEdit(d)} className="text-[var(--text-muted)] hover:text-cyan-400 p-1.5 rounded-lg hover:bg-cyan-500/10 transition"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={async () => { await supabase.from('devices').delete().eq('id', d.id); onSaved(); }} className="text-[var(--text-muted)] hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VMSettings({ settings, devices, isAdmin, onSaved }: { settings: SystemSetting[]; devices: Device[]; isAdmin: boolean; onSaved: () => void }) {
  const { t } = useApp();
  const [vmEnabled, setVmEnabled] = useState(settings.find(s => s.key === 'vm_enabled')?.value === 'true');
  const [vmSelected, setVmSelected] = useState(settings.find(s => s.key === 'vm_selected')?.value || '');
  const [saving, setSaving] = useState(false);
  const vmDevices = devices.filter(d => d.vm_id);

  const save = async () => {
    setSaving(true);
    for (const u of [{ key: 'vm_enabled', value: vmEnabled ? 'true' : 'false' }, { key: 'vm_selected', value: vmSelected }]) {
      await supabase.from('system_settings').upsert({ ...u, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    }
    setSaving(false); onSaved();
  };

  return (
    <div className="panel p-6 max-w-2xl space-y-5">
      <div className="flex items-center gap-3 panel-inner p-3">
        <Server className="w-5 h-5 text-cyan-400" />
        <div className="flex-1">
          <div className="text-sm text-[var(--text-primary)]">{t('vmSupport')}</div>
          <div className="text-xs text-[var(--text-muted)]">{t('vmSupportDesc')}</div>
        </div>
        <div className={`toggle-switch ${vmEnabled ? 'on' : ''}`} onClick={() => isAdmin && setVmEnabled(!vmEnabled)}><div className="knob" /></div>
      </div>
      {vmEnabled && (
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('selectVm')}</label>
          <select value={vmSelected} onChange={(e) => setVmSelected(e.target.value)} disabled={!isAdmin} className="tech-input">
            <option value="">{t('selectVmOpt')}</option>
            {vmDevices.map(d => <option key={d.id} value={d.vm_id!}>{d.name} ({d.vm_id})</option>)}
          </select>
          {vmDevices.length === 0 && <p className="text-xs text-[var(--text-muted)] mt-2">{t('noVm')}</p>}
        </div>
      )}
      <div className="pt-4 border-t border-white/5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2"><Cpu className="w-4 h-4 text-cyan-400" /> {t('vmInfo')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="panel-inner p-3"><div className="text-xs text-[var(--text-muted)]">{t('totalVm')}</div><div className="text-lg font-bold text-[var(--text-primary)]">{vmDevices.length}</div></div>
          <div className="panel-inner p-3"><div className="text-xs text-[var(--text-muted)]">{t('vmOnline')}</div><div className="text-lg font-bold text-green-400">{vmDevices.filter(d => d.status === 'online').length}</div></div>
        </div>
      </div>
      {isAdmin && <button onClick={save} disabled={saving} className="btn-3d btn-3d-primary">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t('saveVmSettings')}</button>}
    </div>
  );
}

function DeviceModal({ device, onClose, onSaved }: { device?: Device; onClose: () => void; onSaved: () => void }) {
  const { t } = useApp();
  const [name, setName] = useState(device?.name || '');
  const [serial, setSerial] = useState(device?.serial || '');
  const [model, setModel] = useState(device?.model || '');
  const [androidVersion, setAndroidVersion] = useState(device?.android_version || '');
  const [groupLabel, setGroupLabel] = useState(device?.group_label || '');
  const [vmId, setVmId] = useState(device?.vm_id || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setLoading(true); setError('');
    const data = { name, serial, model, android_version: androidVersion, group_label: groupLabel, vm_id: vmId || null };
    const res = device ? await supabase.from('devices').update(data).eq('id', device.id) : await supabase.from('devices').insert(data);
    if (res.error) setError(res.error.message);
    else { onSaved(); onClose(); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in-up">
      <div className="panel max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] sticky top-0 bg-[var(--bg-panel)] z-10">
          <div className="flex items-center gap-2"><Smartphone className="w-5 h-5 text-cyan-400" /><h2 className="text-sm font-semibold text-[var(--text-primary)]">{device ? t('editDevice') : t('addDevice')}</h2></div>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div><label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('deviceName')} *</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Phone-01" className="tech-input" /></div>
          <div><label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('serialAdb')} *</label><input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="emulator-5554" className="tech-input font-mono" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('model')}</label><input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Pixel 7" className="tech-input" /></div>
            <div><label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('android')}</label><input value={androidVersion} onChange={(e) => setAndroidVersion(e.target.value)} placeholder="14" className="tech-input" /></div>
          </div>
          <div><label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('group')}</label><input value={groupLabel} onChange={(e) => setGroupLabel(e.target.value)} placeholder="Group A" className="tech-input" /></div>
          <div><label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('vmId')}</label><div className="relative"><HardDrive className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" /><input value={vmId} onChange={(e) => setVmId(e.target.value)} placeholder="emulator-5554" className="tech-input pl-10 font-mono" /></div></div>
          {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-3d btn-3d-ghost flex-1">{t('cancel')}</button>
            <button onClick={handleSave} disabled={loading || !name || !serial} className="btn-3d btn-3d-primary flex-1">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t('save')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
