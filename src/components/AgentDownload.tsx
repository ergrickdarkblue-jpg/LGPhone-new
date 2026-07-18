import { useEffect, useState, useRef } from 'react';
import { Download, Upload, Trash2, Package, Loader2, ShieldAlert, CheckCircle2, FileArchive } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth, useApp } from '../lib/auth';

interface AgentFile {
  name: string;
  id: string;
  created_at: string;
  metadata: { size?: number };
}

export default function AgentDownload() {
  const { t } = useApp();
  const { profile } = useAuth();
  const [files, setFiles] = useState<AgentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<AgentFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = profile?.role === 'admin';

  const load = async () => {
    setLoading(true);
    const { data, error: err } = await supabase.storage.from('agent-zips').list('', { sortBy: { column: 'created_at', order: 'desc' } });
    if (err) { setError(err.message); setLoading(false); return; }
    setFiles((data as AgentFile[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); else setLoading(false); }, [isAdmin]);

  const handleDownload = async (file: AgentFile) => {
    const { data, error: err } = await supabase.storage.from('agent-zips').createSignedUrl(file.name, 3600);
    if (err) { setError(err.message); return; }
    window.open(data.signedUrl, '_blank');
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    const { error: err } = await supabase.storage.from('agent-zips').upload(file.name, file, { upsert: true });
    if (err) setError(err.message);
    else load();
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (file: AgentFile) => {
    setDeleting(true);
    const { error: err } = await supabase.storage.from('agent-zips').remove([file.name]);
    if (err) setError(err.message);
    else load();
    setDeleting(false);
    setConfirmDelete(null);
  };

  if (!isAdmin) {
    return (
      <div className="p-6 animate-fade-in-up">
        <div className="panel p-12 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3">
          <ShieldAlert className="w-12 h-12 opacity-30" />
          <p className="text-sm">{t('agentAdminOnly')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('agentDownloadTitle')}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{t('agentDownloadDesc')}</p>
        </div>
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-3d btn-3d-primary">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {t('uploadNewAgent')}
        </button>
        <input ref={fileInputRef} type="file" accept=".zip" onChange={handleUpload} className="hidden" />
      </div>

      {error && <div className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 mb-4">{error}</div>}

      {loading ? (
        <div className="h-64 flex items-center justify-center text-[var(--text-muted)]"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : files.length === 0 ? (
        <div className="panel p-12 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3">
          <Package className="w-12 h-12 opacity-30" />
          <p className="text-sm">{t('noAgentUploaded')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {files.map(f => (
            <div key={f.id} className="panel p-4 flex items-center justify-between hover:border-[var(--border-active)] transition">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <FileArchive className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--text-primary)]">{f.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {f.metadata?.size ? `${(f.metadata.size / 1024 / 1024).toFixed(2)} MB · ` : ''}
                    {new Date(f.created_at).toLocaleString('vi-VN')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleDownload(f)} className="btn-3d btn-3d-primary text-xs">
                  <Download className="w-3.5 h-3.5" /> {t('downloadAgent')}
                </button>
                <button onClick={() => setConfirmDelete(f)} disabled={deleting} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-red-500/10">
                  <Trash2 className="w-3.5 h-3.5 text-[var(--text-muted)] hover:text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in-up">
          <div className="panel max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center"><ShieldAlert className="w-6 h-6 text-red-400" /></div>
              <div><h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('delete')}</h2><p className="text-xs text-[var(--text-muted)]">{t('irreversible')}</p></div>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4">{t('aboutToDelete')} <span className="text-red-400 font-semibold">{confirmDelete.name}</span></p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="btn-3d btn-3d-ghost flex-1">{t('cancel')}</button>
              <button onClick={() => handleDelete(confirmDelete)} disabled={deleting} className="btn-3d btn-3d-red flex-1">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
