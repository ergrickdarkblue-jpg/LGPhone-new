import { useEffect, useState, useRef } from 'react';
import { Smartphone, Search, Filter, Power, PowerOff, Monitor, Home, ArrowLeft, RotateCw, Volume2, Menu, X, Loader2, Plus, Upload, CheckCircle2, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { supabase, type Device } from '../lib/supabase';
import { useAuth, useApp } from '../lib/auth';

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

  useEffect(() => {
    refreshScreen();
    pollTimerRef.current = setInterval(() => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/screenshots/${device.serial}.png?t=${Date.now()}`;
      setScreenUrl(url);
      setScreenLoading(false);
    }, 2000);
    screenTimerRef.current = setInterval(() => setScreenTime(new Date()), 1000);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (screenTimerRef.current) clearInterval(screenTimerRef.current);
    };
  }, []);

  const sendCommandAndRefresh = async (command_type: string, command_data: Record<string, unknown> = {}) => {
    await sendCommand(command_type, command_data);
    setTimeout(() => refreshScreen(), 1500);
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
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lgphone-control?action=register_app`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionData.session?.access_token || ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, file_path: fileName, file_size: file.size, is_system: false }),
      });
      await sendCommand('install_app', { apk_path: fileName });
      setUploadStatus({ type: 'success', msg: t('installSuccess') });
    } catch { setUploadStatus({ type: 'error', msg: t('installFailed') }); }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setTimeout(() => setUploadStatus({ type: null, msg: '' }), 4000);
  };

  const handleScreenTap = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!canControl || !screenUrl) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / rect.width * 1080);
    const y = Math.round((e.clientY - rect.top) / rect.height * 1920);
    sendCommandAndRefresh('tap', { x, y });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in-up">
      <div className="panel max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col lg:flex-row">
        <div className="flex-1 p-6 flex items-center justify-center bg-gradient-to-br from-slate-900 to-black min-h-[400px] relative">
          <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition"><X className="w-4 h-4 text-white" /></button>
          <div className="relative w-[280px] h-[560px] rounded-[2.5rem] border-4 border-slate-700 overflow-hidden bg-black shadow-2xl">
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
                </div>
                <div className="scanline" />
              </>
            ) : (
              <div className="w-full h-full bg-black flex items-center justify-center"><PowerOff className="w-8 h-8 text-slate-700" /></div>
            )}
          </div>
        </div>

        <div className="w-full lg:w-80 p-6 border-t lg:border-t-0 lg:border-l border-white/10 overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">{device.name}</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{device.model} · {device.serial}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`tech-badge ${device.status === 'online' ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'}`}>
                {device.status === 'online' ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
                {device.status}
              </span>
            </div>
          </div>

          <div className="space-y-3">
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

            {canUpload && canControl && (
              <div className="space-y-1.5 pt-2 border-t border-white/5">
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

            <button disabled={!canControl} onClick={() => sendCommandAndRefresh('reboot')} className="btn-3d btn-3d-red w-full text-xs"><RotateCw className="w-3.5 h-3.5" /> {t('reboot')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Devices() {
  const { t } = useApp();
  const { profile } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [controlDevice, setControlDevice] = useState<Device | null>(null);

  const isAdmin = profile?.role === 'admin';
  const canControl = profile?.can_control || isAdmin;

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('devices').select('*').order('created_at', { ascending: false });
      setDevices(data as Device[] || []);
      setLoading(false);
    };
    load();
    const sub = supabase.channel('devices').on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, () => load()).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const filtered = devices.filter(d => {
    if (statusFilter === 'online' && d.status !== 'online') return false;
    if (statusFilter === 'offline' && d.status !== 'offline') return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !d.serial.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('devices')}</h1>
      </div>
      <div className="panel p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} className="tech-input w-full pl-10" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--text-muted)]" />
            {(['all', 'online', 'offline'] as const).map(f => (
              <button key={f} onClick={() => setStatusFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === f ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-400/30' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:bg-white/5'}`}>
                {f === 'all' ? t('all') : f === 'online' ? t('online') : t('offline')}
              </button>
            ))}
          </div>
        </div>
      </div>
      {loading ? (
        <div className="h-64 flex items-center justify-center text-[var(--text-muted)]"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="panel p-12 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3"><Smartphone className="w-12 h-12 opacity-30" /><p>{t('noDevices')}</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(d => (
            <div key={d.id} className="panel p-4 hover:border-[var(--border-active)] transition">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${d.status === 'online' ? 'bg-green-500/10' : 'bg-slate-500/10'}`}>
                    <Smartphone className={`w-5 h-5 ${d.status === 'online' ? 'text-green-400' : 'text-slate-500'}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--text-primary)] truncate">{d.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{d.model}</div>
                  </div>
                </div>
                <span className={`tech-badge ${d.status === 'online' ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'}`}>{d.status}</span>
              </div>
              <div className="space-y-1 text-xs mb-3">
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">{t('serial')}</span><span className="text-[var(--text-secondary)] font-mono">{d.serial}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">{t('android')}</span><span className="text-[var(--text-secondary)]">{d.android_version || '—'}</span></div>
              </div>
              <button onClick={() => setControlDevice(d)} disabled={!canControl || d.status !== 'online'} className="btn-3d btn-3d-primary w-full text-xs"><Monitor className="w-3.5 h-3.5" /> {t('control')}</button>
            </div>
          ))}
        </div>
      )}
      {controlDevice && <ControlPanel device={controlDevice} onClose={() => setControlDevice(null)} canControl={canControl} />}
    </div>
  );
}
