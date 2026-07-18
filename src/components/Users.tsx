import { useEffect, useState } from 'react';
import { UserPlus, Trash2, Shield, Gamepad2, Power, Upload, Mail, X, Check, User as UserIcon, Loader2, Eye, Edit3 } from 'lucide-react';
import { supabase, type Profile } from '../lib/supabase';
import { useAuth, useApp } from '../lib/auth';

function PermissionToggle({ label, desc, icon: Icon, checked, onChange }: { label: string; desc: string; icon: React.ComponentType<{ className?: string }>; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={`flex items-center gap-3 p-3 rounded-lg border transition-all w-full text-left ${checked ? 'bg-cyan-500/10 border-cyan-400/30' : 'bg-white/5 border-white/10'}`}>
      <Icon className={`w-4 h-4 ${checked ? 'text-cyan-400' : 'text-[var(--text-muted)]'}`} />
      <div className="flex-1 min-w-0"><div className={`text-xs font-medium ${checked ? 'text-cyan-400' : 'text-[var(--text-secondary)]'}`}>{label}</div><div className="text-[10px] text-[var(--text-muted)]">{desc}</div></div>
      <div className={`w-4 h-4 rounded border flex items-center justify-center ${checked ? 'bg-cyan-500 border-cyan-500' : 'border-white/20'}`}>{checked && <Check className="w-3 h-3 text-white" />}</div>
    </button>
  );
}

function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'manager' | 'operator'>('operator');
  const [canControl, setCanControl] = useState(false);
  const [canPower, setCanPower] = useState(false);
  const [canUpload, setCanUpload] = useState(false);
  const [canView, setCanView] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lgphone-control?action=create_user`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.session?.access_token || ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName, role, can_control: canControl, can_power: canPower, can_upload: canUpload, can_view: canView, can_edit: canEdit }),
    });
    const data = await res.json();
    if (data.error) setError(data.error);
    else { onCreated(); onClose(); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in-up">
      <div className="panel max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('addUser')}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-[var(--text-muted)] mb-1 block">{t('email')}</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="tech-input w-full" /></div>
            <div><label className="text-xs text-[var(--text-muted)] mb-1 block">{t('password')}</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="tech-input w-full" /></div>
          </div>
          <div><label className="text-xs text-[var(--text-muted)] mb-1 block">{t('fullName')}</label><input value={fullName} onChange={(e) => setFullName(e.target.value)} className="tech-input w-full" /></div>
          <div><label className="text-xs text-[var(--text-muted)] mb-1 block">{t('role')}</label><div className="grid grid-cols-3 gap-2">{(['admin', 'manager', 'operator'] as const).map(r => <button key={r} type="button" onClick={() => setRole(r)} className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${role === r ? 'bg-cyan-600/20 text-cyan-400 border-cyan-400/30' : 'text-[var(--text-secondary)] border-white/10 hover:bg-white/5'}`}>{t(r)}</button>)}</div></div>
          <div className="grid grid-cols-2 gap-2">
            <PermissionToggle label={t('canControl')} desc={t('canControlDesc')} icon={Gamepad2} checked={canControl} onChange={setCanControl} />
            <PermissionToggle label={t('canPower')} desc={t('canPowerDesc')} icon={Power} checked={canPower} onChange={setCanPower} />
            <PermissionToggle label={t('canUpload')} desc={t('canUploadDesc')} icon={Upload} checked={canUpload} onChange={setCanUpload} />
            <PermissionToggle label={t('canView')} desc={t('canViewDesc')} icon={Eye} checked={canView} onChange={setCanView} />
            <PermissionToggle label={t('canEdit')} desc={t('canEditDesc')} icon={Edit3} checked={canEdit} onChange={setCanEdit} />
          </div>
          {error && <div className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex gap-2 pt-2"><button type="button" onClick={onClose} className="btn-3d btn-3d-ghost flex-1">{t('cancel')}</button><button type="submit" disabled={loading} className="btn-3d btn-3d-primary flex-1">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} {t('create')}</button></div>
        </form>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, onSaved }: { user: Profile; onClose: () => void; onSaved: () => void }) {
  const { t } = useApp();
  const [fullName, setFullName] = useState(user.full_name);
  const [role, setRole] = useState(user.role);
  const [canControl, setCanControl] = useState(user.can_control);
  const [canPower, setCanPower] = useState(user.can_power);
  const [canUpload, setCanUpload] = useState(user.can_upload);
  const [canView, setCanView] = useState(user.can_view);
  const [canEdit, setCanEdit] = useState(user.can_edit);
  const [isActive, setIsActive] = useState(user.is_active);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lgphone-control?action=update_user`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.session?.access_token || ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, full_name: fullName, role, can_control: canControl, can_power: canPower, can_upload: canUpload, can_view: canView, can_edit: canEdit, is_active: isActive }),
    });
    const data = await res.json();
    if (data.error) setError(data.error);
    else { onSaved(); onClose(); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in-up">
      <div className="panel max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('edit')} - {user.email}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
        </div>
        <form onSubmit={handleSave} className="p-4 space-y-4">
          <div><label className="text-xs text-[var(--text-muted)] mb-1 block">{t('fullName')}</label><input value={fullName} onChange={(e) => setFullName(e.target.value)} className="tech-input w-full" /></div>
          <div><label className="text-xs text-[var(--text-muted)] mb-1 block">{t('role')}</label><div className="grid grid-cols-3 gap-2">{(['admin', 'manager', 'operator'] as const).map(r => <button key={r} type="button" onClick={() => setRole(r)} className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${role === r ? 'bg-cyan-600/20 text-cyan-400 border-cyan-400/30' : 'text-[var(--text-secondary)] border-white/10 hover:bg-white/5'}`}>{t(r)}</button>)}</div></div>
          <div className="grid grid-cols-2 gap-2">
            <PermissionToggle label={t('canControl')} desc={t('canControlDesc')} icon={Gamepad2} checked={canControl} onChange={setCanControl} />
            <PermissionToggle label={t('canPower')} desc={t('canPowerDesc')} icon={Power} checked={canPower} onChange={setCanPower} />
            <PermissionToggle label={t('canUpload')} desc={t('canUploadDesc')} icon={Upload} checked={canUpload} onChange={setCanUpload} />
            <PermissionToggle label={t('canView')} desc={t('canViewDesc')} icon={Eye} checked={canView} onChange={setCanView} />
            <PermissionToggle label={t('canEdit')} desc={t('canEditDesc')} icon={Edit3} checked={canEdit} onChange={setCanEdit} />
            <PermissionToggle label={t('isActive')} desc={t('isActive')} icon={Check} checked={isActive} onChange={setIsActive} />
          </div>
          {error && <div className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}
          <div className="flex gap-2 pt-2"><button type="button" onClick={onClose} className="btn-3d btn-3d-ghost flex-1">{t('cancel')}</button><button type="submit" disabled={loading} className="btn-3d btn-3d-primary flex-1">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t('save')}</button></div>
        </form>
      </div>
    </div>
  );
}

export default function Users() {
  const { t } = useApp();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<Profile | null>(null);

  const load = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers((data as Profile[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('users')}</h1>
        <button onClick={() => setShowAdd(true)} className="btn-3d btn-3d-primary"><UserPlus className="w-4 h-4" /> {t('addUser')}</button>
      </div>
      {loading ? (
        <div className="h-64 flex items-center justify-center text-[var(--text-muted)]"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-white/10">
              <th className="text-left p-4 text-xs font-medium text-[var(--text-muted)]">{t('fullName')}</th>
              <th className="text-left p-4 text-xs font-medium text-[var(--text-muted)]">{t('email')}</th>
              <th className="text-center p-4 text-xs font-medium text-[var(--text-muted)]">{t('role')}</th>
              <th className="text-center p-4 text-xs font-medium text-[var(--text-muted)]">{t('canControl')}</th>
              <th className="text-center p-4 text-xs font-medium text-[var(--text-muted)]">{t('canPower')}</th>
              <th className="text-center p-4 text-xs font-medium text-[var(--text-muted)]">{t('canUpload')}</th>
              <th className="text-center p-4 text-xs font-medium text-[var(--text-muted)]">{t('isActive')}</th>
              <th className="text-center p-4 text-xs font-medium text-[var(--text-muted)]"></th>
            </tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition">
                  <td className="p-4"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center"><UserIcon className="w-4 h-4 text-cyan-400" /></div><span className="text-sm text-[var(--text-primary)]">{u.full_name || '—'}</span></div></td>
                  <td className="p-4 text-sm text-[var(--text-secondary)]">{u.email}</td>
                  <td className="p-4 text-center"><span className={`tech-badge ${u.role === 'admin' ? 'bg-red-500/10 text-red-400' : u.role === 'manager' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-500/10 text-[var(--text-secondary)]'}`}>{t(u.role)}</span></td>
                  <td className="p-4 text-center">{u.can_control ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-[var(--text-muted)] mx-auto" />}</td>
                  <td className="p-4 text-center">{u.can_power ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-[var(--text-muted)] mx-auto" />}</td>
                  <td className="p-4 text-center">{u.can_upload ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-[var(--text-muted)] mx-auto" />}</td>
                  <td className="p-4 text-center">{u.is_active ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-[var(--text-muted)] mx-auto" />}</td>
                  <td className="p-4 text-center"><button onClick={() => setEditUser(u)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 mx-auto"><Edit3 className="w-3.5 h-3.5 text-[var(--text-secondary)]" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onCreated={load} />}
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSaved={load} />}
    </div>
  );
}
