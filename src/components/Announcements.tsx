import { useEffect, useState } from 'react';
import { Megaphone, Plus, Trash2, Edit2, X, Loader2, Calendar } from 'lucide-react';
import { supabase, type Announcement } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useApp } from '../lib/app-context';

export default function Announcements() {
  const { profile } = useAuth();
  const { t } = useApp();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);

  const fetch = async () => {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    setAnnouncements((data as Announcement[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  if (profile?.role !== 'admin') {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-center">
          <Megaphone className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-[var(--text-secondary)]">{t('adminOnly')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('dailyAnnouncements')}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{t('postAnnouncement')}</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-3d btn-3d-primary"><Plus className="w-4 h-4" /> {t('createAnnouncement')}</button>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-[var(--text-muted)]"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : announcements.length === 0 ? (
        <div className="panel p-12 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3"><Megaphone className="w-12 h-12 opacity-30" /><p>{t('noAnnouncementsYet')}</p></div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <div key={a.id} className={`panel p-4 ${a.is_active ? 'glow-brand' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{a.title}</h3>
                    <span className={`tech-badge ${a.is_active ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-[var(--text-muted)]'}`}>{a.is_active ? t('shown') : t('hidden')}</span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{a.content}</p>
                  <div className="flex items-center gap-1.5 mt-3 text-xs text-[var(--text-muted)]"><Calendar className="w-3 h-3" />{new Date(a.created_at).toLocaleString('vi-VN')}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={async () => { await supabase.from('announcements').update({ is_active: !a.is_active }).eq('id', a.id); fetch(); }} className="btn-3d btn-3d-ghost text-xs px-3 py-1.5">{a.is_active ? t('hide') : t('show')}</button>
                  <button onClick={() => { setEditing(a); setShowForm(true); }} className="text-[var(--text-muted)] hover:text-cyan-400 p-1.5 rounded-lg hover:bg-cyan-500/10 transition"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={async () => { await supabase.from('announcements').delete().eq('id', a.id); fetch(); }} className="text-[var(--text-muted)] hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <AnnouncementForm editing={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetch(); }} />}
    </div>
  );
}

function AnnouncementForm({ editing, onClose, onSaved }: { editing: Announcement | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useApp();
  const [title, setTitle] = useState(editing?.title || '');
  const [content, setContent] = useState(editing?.content || '');
  const [isActive, setIsActive] = useState(editing?.is_active ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setLoading(true); setError('');
    const res = editing
      ? await supabase.from('announcements').update({ title, content, is_active: isActive }).eq('id', editing.id)
      : await supabase.from('announcements').insert({ title, content, is_active: isActive });
    if (res.error) setError(res.error.message);
    else onSaved();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in-up">
      <div className="panel max-w-lg w-full">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2"><Megaphone className="w-5 h-5 text-cyan-400" /><h2 className="text-sm font-semibold text-[var(--text-primary)]">{editing ? t('editAnnouncement') : t('createNew')}</h2></div>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div><label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('title')}</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="..." className="tech-input" /></div>
          <div><label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('content')}</label><textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="..." rows={5} className="tech-input resize-none" /></div>
          <div className="flex items-center gap-3 panel-inner p-3"><span className="text-sm text-[var(--text-primary)] flex-1">{t('showToUsers')}</span><div className={`toggle-switch ${isActive ? 'on' : ''}`} onClick={() => setIsActive(!isActive)}><div className="knob" /></div></div>
          {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-3d btn-3d-ghost flex-1">{t('cancel')}</button>
            <button onClick={handleSave} disabled={loading || !title || !content} className="btn-3d btn-3d-primary flex-1">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}{editing ? t('save') : t('createAnnouncement')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
