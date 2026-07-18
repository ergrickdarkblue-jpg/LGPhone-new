import { useEffect, useState } from 'react';
import { Megaphone, Plus, X, Trash2, Loader2, Check } from 'lucide-react';
import { supabase, type Announcement } from '../lib/supabase';
import { useAuth, useApp } from '../lib/auth';

export default function Announcements() {
  const { t } = useApp();
  const { profile } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = profile?.role === 'admin';

  const load = async () => {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    setItems((data as Announcement[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await supabase.from('announcements').insert({ title, content, created_by: profile?.id });
    setSaving(false); setShowForm(false); setTitle(''); setContent('');
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('announcements').delete().eq('id', id);
    load();
  };

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('announcements')}</h1>
        {isAdmin && <button onClick={() => setShowForm(true)} className="btn-3d btn-3d-primary"><Plus className="w-4 h-4" /> {t('createAnnouncement')}</button>}
      </div>
      {loading ? (
        <div className="h-64 flex items-center justify-center text-[var(--text-muted)]"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="panel p-12 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3"><Megaphone className="w-12 h-12 opacity-30" /><p>{t('noAnnouncements')}</p></div>
      ) : (
        <div className="space-y-4">
          {items.map(a => (
            <div key={a.id} className="panel p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2"><Megaphone className="w-4 h-4 text-cyan-400" /><h2 className="text-sm font-semibold text-[var(--text-primary)]">{a.title}</h2></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)]">{new Date(a.created_at).toLocaleDateString('vi-VN')}</span>
                  {isAdmin && <button onClick={() => handleDelete(a.id)} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5 text-[var(--text-muted)] hover:text-red-400" /></button>}
                </div>
              </div>
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{a.content}</p>
            </div>
          ))}
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in-up">
          <div className="panel max-w-lg w-full">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('createAnnouncement')}</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              <div><label className="text-xs text-[var(--text-muted)] mb-1 block">{t('title')}</label><input value={title} onChange={(e) => setTitle(e.target.value)} required className="tech-input w-full" /></div>
              <div><label className="text-xs text-[var(--text-muted)] mb-1 block">{t('content')}</label><textarea value={content} onChange={(e) => setContent(e.target.value)} required rows={5} className="tech-input w-full resize-none" /></div>
              <div className="flex gap-2"><button type="button" onClick={() => setShowForm(false)} className="btn-3d btn-3d-ghost flex-1">{t('cancel')}</button><button type="submit" disabled={saving} className="btn-3d btn-3d-primary flex-1">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t('create')}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
