import { useEffect, useState, useRef } from 'react';
import { FolderUp, Trash2, File, Loader2, ShieldAlert, Filter } from 'lucide-react';
import { supabase, type AppFile, type Device } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useApp } from '../lib/app-context';

export default function Files() {
  const { profile } = useAuth();
  const { t } = useApp();
  const [files, setFiles] = useState<AppFile[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'user' | 'system'>('all');
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUpload = profile?.can_upload || profile?.role === 'admin';
  const isAdmin = profile?.role === 'admin';

  const fetchAll = async () => {
    const [filesRes, devRes] = await Promise.all([
      supabase.from('app_files').select('*').order('created_at', { ascending: false }),
      supabase.from('devices').select('*').order('name'),
    ]);
    setFiles((filesRes.data as AppFile[]) || []);
    setDevices((devRes.data as Device[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;
    setUploading(true);
    for (const file of selectedFiles) {
      const fileName = `${Date.now()}_${file.name}`;
      await supabase.storage.createBucket('app-files', { public: false }).catch(() => {});
      const { data: uploadData } = await supabase.storage.from('app-files').upload(fileName, file);
      if (uploadData) {
        const { data: session } = await supabase.auth.getSession();
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lgphone-control?action=register_app`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.session?.access_token || ''}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, file_path: fileName, file_size: file.size, is_system: false, device_id: selectedDevice === 'all' ? null : selectedDevice }),
        });
      }
    }
    setUploading(false); fetchAll();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteFile = async (file: AppFile) => {
    if (file.is_system) return;
    await supabase.storage.from('app-files').remove([file.file_path]);
    await supabase.from('app_files').delete().eq('id', file.id);
    fetchAll();
  };

  const handleDeleteAllUserApps = async () => {
    setConfirmDelete(false);
    const userFiles = files.filter(f => !f.is_system);
    for (const f of userFiles) {
      setDeleteProgress(`${t('delete')}: ${f.filename}`);
      await supabase.storage.from('app-files').remove([f.file_path]);
      await supabase.from('app_files').delete().eq('id', f.id);
    }
    setDeleteProgress(''); fetchAll();
  };

  const filtered = files.filter(f => {
    if (filter === 'user' && f.is_system) return false;
    if (filter === 'system' && !f.is_system) return false;
    if (selectedDevice !== 'all' && f.device_id !== selectedDevice) return false;
    return true;
  });

  const userAppCount = files.filter(f => !f.is_system).length;
  const systemAppCount = files.filter(f => f.is_system).length;

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('appFiles')}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{files.length} {t('filesCount')} — {userAppCount} {t('userApps')}, {systemAppCount} {t('systemApps')}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && userAppCount > 0 && <button onClick={() => setConfirmDelete(true)} className="btn-3d btn-3d-red"><Trash2 className="w-4 h-4" /> {t('deleteAllNew')}</button>}
          {canUpload && <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-3d btn-3d-primary">{uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderUp className="w-4 h-4" />} {t('uploadFile')}</button>}
          <input ref={fileInputRef} type="file" multiple accept=".apk,.aab,.zip" onChange={handleUpload} className="hidden" />
        </div>
      </div>

      <div className="panel p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--text-muted)]" />
            {(['all', 'user', 'system'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? 'bg-brand-600/20 text-cyan-400 border border-cyan-400/30' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:bg-white/5'}`}>
                {f === 'all' ? t('all') : f === 'user' ? t('userFiles') : t('systemFiles')}
              </button>
            ))}
          </div>
          <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)} className="tech-input w-auto">
            <option value="all">{t('all')} {t('devices').toLowerCase()}</option>
            {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {deleteProgress && <span className="text-xs text-amber-400 ml-auto">{deleteProgress}</span>}
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-[var(--text-muted)]"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="panel p-12 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3"><File className="w-12 h-12 opacity-30" /><p>{t('noFiles')}</p>{canUpload && <p className="text-xs">{t('uploadFile')}</p>}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(f => (
            <div key={f.id} className="panel p-4 hover:border-[var(--border-active)] transition">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${f.is_system ? 'bg-slate-500/10' : 'bg-cyan-500/10'}`}><File className={`w-5 h-5 ${f.is_system ? 'text-[var(--text-muted)]' : 'text-cyan-400'}`} /></div>
                  <div className="min-w-0"><div className="text-sm font-medium text-[var(--text-primary)] truncate">{f.filename}</div><div className="text-xs text-[var(--text-muted)]">{f.package_name || t('noPackage')}</div></div>
                </div>
                <span className={`tech-badge ${f.is_system ? 'bg-slate-500/10 text-[var(--text-muted)]' : 'bg-cyan-500/10 text-cyan-400'}`}>{f.is_system ? t('systemFiles') : t('userFiles')}</span>
              </div>
              <div className="space-y-1 text-xs mb-3">
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">{t('size')}</span><span className="text-[var(--text-secondary)]">{(f.file_size / 1024 / 1024).toFixed(2)} MB</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">{t('devices')}</span><span className="text-[var(--text-secondary)]">{devices.find(d => d.id === f.device_id)?.name || '—'}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-muted)]">{t('uploadDate')}</span><span className="text-[var(--text-secondary)]">{new Date(f.created_at).toLocaleDateString('vi-VN')}</span></div>
              </div>
              <div className="flex gap-2 pt-3 border-t border-white/5">
                {!f.is_system ? (
                  <button onClick={() => handleDeleteFile(f)} className="btn-3d btn-3d-ghost flex-1 text-xs"><Trash2 className="w-3.5 h-3.5" /> {t('delete')}</button>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 w-full text-xs text-[var(--text-muted)] py-2"><ShieldAlert className="w-3.5 h-3.5" /> {t('cannotDeleteSystem')}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in-up">
          <div className="panel max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center"><ShieldAlert className="w-6 h-6 text-red-400" /></div>
                <div><h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('confirmDeleteAll')}</h2><p className="text-xs text-[var(--text-muted)]">{t('irreversible')}</p></div>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mb-4">{t('aboutToDelete')} <span className="text-red-400 font-semibold">{userAppCount} {t('userApps')}</span>. {t('userAppsKeep')}</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="btn-3d btn-3d-ghost flex-1">{t('cancel')}</button>
                <button onClick={handleDeleteAllUserApps} className="btn-3d btn-3d-red flex-1"><Trash2 className="w-4 h-4" /> {t('deleteAll')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
