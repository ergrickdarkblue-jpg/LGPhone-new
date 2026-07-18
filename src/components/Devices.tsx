import { useEffect, useState, useRef, useCallback } from 'react';
import { Smartphone, Search, Filter, Power, PowerOff, Monitor, Home, ArrowLeft, RotateCw, Volume2, Menu, X, Play, Square, RefreshCw, CalendarClock, Loader2, Plus, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase, type Device, type Profile } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useApp } from '../lib/app-context';
import { createRental, toLocalInput } from '../lib/rentals';

type FilterStatus = 'all' | 'online' | 'offline' | 'assigned' | 'available';
type FilterGroup = 'all' | string;

export default function Devices() {
  const { profile, session } = useAuth();
  const { t } = useApp();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [groupFilter, setGroupFilter] = useState<FilterGroup>('all');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [rentalDevice, setRentalDevice] = useState<Device | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [rentalForm, setRentalForm] = useState({ user_id: '', start_time: toLocalInput(new Date().toISOString()), end_time: '', notes: '' });
  const [rentalSubmitting, setRentalSubmitting] = useState(false);
  const [rentalError, setRentalError] = useState<string | null>(null);

  const isAdmin = profile?.role === 'admin';

  const loadUsers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('email');
    if (data) setUsers(data as Profile[]);
  }, []);
  useEffect(() => { loadUsers(); }, [loadUsers]);

  function openRentalModal(device: Device) {
    setRentalDevice(device);
    setRentalForm({ user_id: '', start_time: toLocalInput(new Date().toISOString()), end_time: '', notes: '' });
    setRentalError(null);
    setShowRentalModal(true);
  }

  async function handleRentalSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRentalError(null);
    if (!rentalDevice || !rentalForm.user_id || !rentalForm.start_time) { setRentalError(t('fillAllFields')); return; }
    setRentalSubmitting(true);
    try {
      await createRental({
        device_id: rentalDevice.id, user_id: rentalForm.user_id, assigned_by: session?.user.id,
        start_time: new Date(rentalForm.start_time).toISOString(),
        end_time: rentalForm.end_time ? new Date(rentalForm.end_time).toISOString() : null,
        notes: rentalForm.notes,
      });
      setShowRentalModal(false); setRentalDevice(null);
    } catch (err) { setRentalError((err as Error).message); }
    setRentalSubmitting(false);
  }

  useEffect(() => {
    supabase.from('devices').select('*').order('name', { ascending: true }).then(({ data }) => {
      setDevices((data as Device[]) || []);
      setLoading(false);
    });

    const channel = supabase.channel('devices-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new) setDevices(prev => [...prev, payload.new as Device]);
        else if (payload.eventType === 'UPDATE' && payload.new) {
          const updated = payload.new as Device;
          setDevices(prev => prev.map(d => d.id === updated.id ? updated : d));
          setSelectedDevice(prev => prev?.id === updated.id ? updated : prev);
        }
        else if (payload.eventType === 'DELETE' && payload.old) setDevices(prev => prev.filter(d => d.id !== (payload.old as Device).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const groups = Array.from(new Set(devices.map(d => d.group_label).filter(Boolean)));

  const filtered = devices.filter(d => {
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.serial.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter === 'online' && d.status !== 'online') return false;
    if (statusFilter === 'offline' && d.status !== 'offline') return false;
    if (statusFilter === 'assigned' && d.assigned_to === null) return false;
    if (statusFilter === 'available' && d.assigned_to !== null) return false;
    if (groupFilter !== 'all' && d.group_label !== groupFilter) return false;
    return true;
  });

  const sendControl = async (action: string, body: Record<string, unknown>) => {
    const { data: session } = await supabase.auth.getSession();
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lgphone-control?action=${action}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.session?.access_token || ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  const handlePower = (device: Device, state: 'on' | 'off') => sendControl('power_device', { device_id: device.id, power_state: state });
  const handleAssign = async (device: Device) => { await sendControl('assign_device', { device_id: device.id }); setSelectedDevice(device); };
  const handleRelease = (device: Device) => sendControl('release_device', { device_id: device.id });

  const canControl = profile?.can_control || profile?.role === 'admin';
  const canPower = profile?.can_power || profile?.role === 'admin';

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('manageDevices')}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{devices.length} {t('devices').toLowerCase()} — {devices.filter(d => d.status === 'online').length} {t('online').toLowerCase()}, {devices.filter(d => d.assigned_to).length} {t('inUse').toLowerCase()}</p>
      </div>

      <div className="panel p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input type="text" placeholder={t('searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} className="tech-input pl-10" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--text-muted)]" />
            {(['all', 'online', 'offline', 'assigned', 'available'] as FilterStatus[]).map(f => (
              <button key={f} onClick={() => setStatusFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === f ? 'bg-brand-600/20 text-cyan-400 border border-cyan-400/30' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:bg-white/5'}`}>
                {f === 'all' ? t('all') : f === 'online' ? t('online') : f === 'offline' ? t('offline') : f === 'assigned' ? t('assignedFilter') : t('availableFilter')}
              </button>
            ))}
          </div>
          {groups.length > 0 && (
            <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="tech-input w-auto">
              <option value="all">{t('allGroups')}</option>
              {groups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-[var(--text-muted)]">{t('loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="panel p-12 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3">
          <Smartphone className="w-12 h-12 opacity-30" />
          <p>{t('noDevicesFound')}</p>
          <p className="text-xs">{t('addDeviceHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(device => (
            <div key={device.id} className={`panel p-4 transition-all duration-200 hover:border-[var(--border-active)] ${device.status === 'online' ? 'glow-green' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${device.status === 'online' ? 'bg-green-500/10' : 'bg-slate-500/10'}`}>
                    <Smartphone className={`w-5 h-5 ${device.status === 'online' ? 'text-green-400' : 'text-[var(--text-muted)]'}`} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{device.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{device.serial}</div>
                  </div>
                </div>
                <span className={`status-dot ${device.status}`} />
              </div>
              <div className="space-y-1.5 mb-3 text-xs">
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">{t('model')}</span><span className="text-[var(--text-secondary)]">{device.model || '—'}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">{t('android')}</span><span className="text-[var(--text-secondary)]">{device.android_version || '—'}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">{t('group')}</span><span className="text-[var(--text-secondary)]">{device.group_label || '—'}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">{t('vm')}</span><span className="text-[var(--text-secondary)]">{device.vm_id || t('real')}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">{t('status')}</span><span className={device.assigned_to ? 'text-cyan-400' : 'text-[var(--text-secondary)]'}>{device.assigned_to ? t('using') : t('notUsed')}</span></div>
              </div>
              <div className="flex gap-2 pt-3 border-t border-white/5 flex-wrap">
                {canControl && device.status === 'online' && !device.assigned_to && (
                  <button onClick={() => handleAssign(device)} className="btn-3d btn-3d-cyan flex-1 text-xs"><Play className="w-3.5 h-3.5" /> {t('use')}</button>
                )}
                {canControl && device.assigned_to === profile?.id && (
                  <>
                    <button onClick={() => setSelectedDevice(device)} className="btn-3d btn-3d-primary flex-1 text-xs"><Monitor className="w-3.5 h-3.5" /> {t('control')}</button>
                    <button onClick={() => handleRelease(device)} className="btn-3d btn-3d-ghost text-xs"><Square className="w-3.5 h-3.5" /></button>
                  </>
                )}
                {isAdmin && !device.assigned_to && (
                  <button onClick={() => openRentalModal(device)} className="btn-3d btn-3d-primary text-xs" title={t('addRental')}><CalendarClock className="w-3.5 h-3.5" /> {t('addRental')}</button>
                )}
                {canPower && (device.status === 'offline' ? (
                  <button onClick={() => handlePower(device, 'on')} className="btn-3d btn-3d-green flex-1 text-xs"><Power className="w-3.5 h-3.5" /> {t('turnOn')}</button>
                ) : (
                  <button onClick={() => handlePower(device, 'off')} className="btn-3d btn-3d-red flex-1 text-xs"><PowerOff className="w-3.5 h-3.5" /> {t('turnOff')}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedDevice && <ControlPanel device={selectedDevice} onClose={() => setSelectedDevice(null)} canControl={canControl || false} />}

      {showRentalModal && rentalDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in-up" onClick={() => setShowRentalModal(false)}>
          <div className="panel max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-cyan-400" /> {t('assignDevice')}
              </h2>
              <button onClick={() => setShowRentalModal(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X className="w-5 h-5" /></button>
            </div>
            <div className="mb-3 text-xs text-[var(--text-secondary)] bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg p-2.5">
              <span className="font-semibold">{rentalDevice.name}</span> · {rentalDevice.model} · {rentalDevice.serial}
            </div>
            <form onSubmit={handleRentalSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('selectUser')}</label>
                <select className="tech-input" value={rentalForm.user_id} onChange={e => setRentalForm({ ...rentalForm, user_id: e.target.value })} required>
                  <option value="">— {t('selectUser')} —</option>
                  {users.filter(u => u.id !== profile?.id).map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('startTime')}</label>
                  <input type="datetime-local" className="tech-input" value={rentalForm.start_time} onChange={e => setRentalForm({ ...rentalForm, start_time: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('endTimeOptional')}</label>
                  <input type="datetime-local" className="tech-input" value={rentalForm.end_time} onChange={e => setRentalForm({ ...rentalForm, end_time: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('rentalNotes')}</label>
                <textarea className="tech-input min-h-[60px]" placeholder={t('rentalNotesPlaceholder')} value={rentalForm.notes} onChange={e => setRentalForm({ ...rentalForm, notes: e.target.value })} />
              </div>
              {rentalError && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{rentalError}</div>}
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={rentalSubmitting} className="btn-3d btn-3d-cyan flex-1">
                  {rentalSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t('addRental')}
                </button>
                <button type="button" onClick={() => setShowRentalModal(false)} className="btn-3d btn-3d-ghost flex-1">{t('cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ControlPanel({ device, onClose, canControl }: { device: Device; onClose: () => void; canControl: boolean }) {
  const { t } = useApp();
  const { profile } = useAuth();
  const [screenOn, setScreenOn] = useState(device.status === 'online');
  const [screenTime, setScreenTime] = useState(new Date());
  const [screenUrl, setScreenUrl] = useState<string>('');
  const [screenLoading, setScreenLoading] = useState(true);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error' | null; msg: string }>({ type: null, msg: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = profile?.role === 'admin';
  const canUpload = profile?.can_upload || isAdmin;
  const screenTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendCommand = async (command_type: string, command_data: Record<string, unknown> = {}) => {
    await supabase.from('device_commands').insert({
      device_serial: device.serial, command_type, command_data,
      status: 'pending', priority: 5,
    });
  };

  const refreshScreen = async () => {
    await sendCommand('screenshot');
  };

  // Send initial screenshot command on open, then poll for the image
  useEffect(() => {
    refreshScreen();
    // Poll screenshot URL every 2s
    pollTimerRef.current = setInterval(() => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/screenshots/${device.serial}.png?t=${Date.now()}`;
      setScreenUrl(url);
      setScreenLoading(false);
    }, 2000);
    // Clock
    screenTimerRef.current = setInterval(() => setScreenTime(new Date()), 1000);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (screenTimerRef.current) clearInterval(screenTimerRef.current);
    };
  }, []);

  // After sending a command, request a new screenshot after a short delay
  const sendCommandAndRefresh = async (command_type: string, command_data: Record<string, unknown> = {}) => {
    await sendCommand(command_type, command_data);
    setTimeout(() => refreshScreen(), 1500);
  };

  const handleReset = async () => {
    setResetConfirm(false);
    await sendCommand('reset');
    const { data: session } = await supabase.auth.getSession();
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lgphone-control?action=reset_device`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.session?.access_token || ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_serial: device.serial }),
    });
  };

  const handleUploadApk = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadStatus({ type: null, msg: '' });
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage.from('app-files').upload(fileName, file);
      if (uploadErr || !uploadData) { setUploadStatus({ type: 'error', msg: t('installFailed') }); setUploading(false); return; }
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lgphone-control?action=register_app`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionData.session?.access_token || ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, file_path: fileName, file_size: file.size, is_system: false }),
      });
      const regData = await res.json();
      const appId = regData.app?.id;
      await supabase.from('device_commands').insert({
        device_serial: device.serial, command_type: 'install_app',
        command_data: { apk_path: fileName, app_file_id: appId },
        status: 'pending', priority: 5,
      });
      setUploadStatus({ type: 'success', msg: t('installSuccess') });
    } catch { setUploadStatus({ type: 'error', msg: t('installFailed') }); }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setTimeout(() => setUploadStatus({ type: null, msg: '' }), 4000);
  };

  // Tap on screen coordinates (for touch interaction)
  const handleScreenTap = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!canControl || !screenUrl) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / rect.width * 1080);
    const y = Math.round((e.clientY - rect.top) / rect.height * 1920);
    sendCommandAndRefresh('tap', { x, y });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in-up">
      <div className="panel max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center"><Smartphone className="w-5 h-5 text-green-400" /></div>
            <div><div className="text-sm font-semibold text-[var(--text-primary)]">{device.name}</div><div className="text-xs text-[var(--text-muted)]">{device.serial} • {device.model || 'Unknown'}</div></div>
          </div>
          <div className="flex items-center gap-2"><span className="status-dot online" /><span className="text-xs text-green-400">{t('live')}</span><button onClick={onClose} className="ml-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1"><X className="w-5 h-5" /></button></div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Live screen - real-time updating */}
          <div className="flex-1 p-6 flex items-center justify-center bg-black/30 min-h-64">
            <div className="phone-frame w-56 h-96 md:w-64 md:h-[420px] relative">
              {screenOn ? (
                <>
                  <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-center">
                    {screenUrl ? (
                      <img src={screenUrl} alt="Live Screen" className="w-full h-full object-cover cursor-pointer" onError={() => setScreenUrl('')} onClick={handleScreenTap} />
                    ) : screenLoading ? (
                      <div className="flex flex-col items-center gap-2"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /><span className="text-xs text-slate-400">{t('loading')}</span></div>
                    ) : (
                      <div className="text-center">
                        <div className="text-3xl font-bold text-white mb-2">{screenTime.toLocaleTimeString('vi-VN')}</div>
                        <div className="text-sm text-slate-400">{screenTime.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                      </div>
                    )}
                    <div className="absolute bottom-8 left-0 right-0 flex justify-around">
                      <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur" /><div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur" /><div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur" /><div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur" />
                    </div>
                  </div>
                  <div className="scanline" />
                </>
              ) : (
                <div className="w-full h-full bg-black flex items-center justify-center"><PowerOff className="w-8 h-8 text-slate-700" /></div>
              )}
            </div>
          </div>

          {/* Control panel */}
          <div className="md:w-72 border-t md:border-t-0 md:border-l border-[var(--border-subtle)] p-4 space-y-3 overflow-y-auto">
            <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t('controlPanel')}</div>
            <div className="grid grid-cols-3 gap-2">
              <button disabled={!canControl} onClick={() => sendCommandAndRefresh('key', { keycode: 26 })} className="btn-3d btn-3d-ghost aspect-square flex-col text-xs"><Power className="w-4 h-4" /><span className="text-[10px] mt-1">{t('power')}</span></button>
              <button disabled={!canControl} onClick={() => { setScreenOn(false); sendCommandAndRefresh('key', { keycode: 26 }); }} className="btn-3d btn-3d-ghost aspect-square flex-col text-xs"><PowerOff className="w-4 h-4" /><span className="text-[10px] mt-1">{t('lock')}</span></button>
              <button disabled={!canControl} onClick={() => sendCommandAndRefresh('key', { keycode: 24 })} className="btn-3d btn-3d-ghost aspect-square flex-col text-xs"><Volume2 className="w-4 h-4" /><span className="text-[10px] mt-1">{t('volUp')}</span></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button disabled={!canControl} onClick={() => sendCommandAndRefresh('key', { keycode: 3 })} className="btn-3d btn-3d-primary aspect-square flex-col text-xs"><Home className="w-4 h-4" /><span className="text-[10px] mt-1">{t('home')}</span></button>
              <button disabled={!canControl} onClick={() => sendCommandAndRefresh('key', { keycode: 4 })} className="btn-3d btn-3d-primary aspect-square flex-col text-xs"><ArrowLeft className="w-4 h-4" /><span className="text-[10px] mt-1">{t('back')}</span></button>
              <button disabled={!canControl} onClick={() => sendCommandAndRefresh('key', { keycode: 187 })} className="btn-3d btn-3d-primary aspect-square flex-col text-xs"><Menu className="w-4 h-4" /><span className="text-[10px] mt-1">{t('recent')}</span></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button disabled={!canControl} onClick={() => sendCommandAndRefresh('key', { keycode: 25 })} className="btn-3d btn-3d-ghost text-xs"><Volume2 className="w-3.5 h-3.5" /> {t('volDown')}</button>
              <button disabled={!canControl} onClick={() => refreshScreen()} className="btn-3d btn-3d-cyan text-xs"><Monitor className="w-3.5 h-3.5" /> {t('capture')}</button>
            </div>
            <button disabled={!canControl} onClick={() => sendCommandAndRefresh('reboot')} className="btn-3d btn-3d-red w-full text-xs"><RotateCw className="w-3.5 h-3.5" /> {t('reboot')}</button>

            {/* Upload APK to device */}
            {canUpload && canControl && (
              <div className="space-y-1.5">
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-3d btn-3d-primary w-full text-xs">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} {uploading ? t('installing') : t('uploadToDevice')}
                </button>
                <input ref={fileInputRef} type="file" accept=".apk" onChange={handleUploadApk} className="hidden" />
                <p className="text-[10px] text-[var(--text-muted)] text-center">{t('uploadApkHint')}</p>
                {uploadStatus.type && (
                  <div className={`flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 ${uploadStatus.type === 'success' ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
                    {uploadStatus.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {uploadStatus.msg}
                  </div>
                )}
              </div>
            )}

            {/* Admin-only: Reset device (wipe all user apps) */}
            {isAdmin && (
              <button onClick={() => setResetConfirm(true)} className="btn-3d btn-3d-ghost w-full text-xs border-amber-500/20 text-amber-400">
                <RefreshCw className="w-3.5 h-3.5" /> {t('resetDevice')}
              </button>
            )}

            <div className="panel-inner p-3 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">{t('serialAdb')}</span><span className="text-[var(--text-secondary)] font-mono">{device.serial}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">{t('android')}</span><span className="text-[var(--text-secondary)]">{device.android_version || '—'}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">{t('vm')}</span><span className="text-[var(--text-secondary)]">{device.vm_id || 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-[var(--text-muted)]">{t('screen')}</span><span className={screenOn ? 'text-green-400' : 'text-red-400'}>{screenOn ? t('on') : t('off')}</span></div>
            </div>
            {!canControl && <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-center">{t('noControlPerm')}</div>}
          </div>
        </div>
      </div>

      {/* Reset confirm modal */}
      {resetConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in-up">
          <div className="panel max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center"><RefreshCw className="w-6 h-6 text-amber-400" /></div>
              <div><h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('resetDevice')}</h2><p className="text-xs text-[var(--text-muted)]">{t('irreversible')}</p></div>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">{t('aboutToDelete')} {t('userAppsKeep')}</p>
            <div className="flex gap-2">
              <button onClick={() => setResetConfirm(false)} className="btn-3d btn-3d-ghost flex-1">{t('cancel')}</button>
              <button onClick={handleReset} className="btn-3d btn-3d-red flex-1"><RefreshCw className="w-4 h-4" /> {t('resetDevice')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
