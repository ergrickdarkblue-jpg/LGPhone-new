import { useEffect, useState } from 'react';
import { UserPlus, Trash2, Shield, Gamepad2, Power, Upload, Mail, X, Check, User as UserIcon, Loader2, Eye, Edit3 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useApp } from '../lib/app-context';
import { supabase, type Profile, type Role } from '../lib/supabase';

type ManagedUser = Profile;

export default function Users() {
  const { profile } = useAuth();
  const { t } = useApp();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);

  const fetchUsers = async () => {
    const { data: session } = await supabase.auth.getSession();
    const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lgphone-admin?action=list_users`;
    const res = await fetch(fnUrl, { headers: { Authorization: `Bearer ${session.session?.access_token || ''}`, 'Content-Type': 'application/json' } });
    const json = await res.json();
    setUsers(json.users || []);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  if (profile?.role !== 'admin') {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="w-12 h-12 text-red-400/50 mx-auto mb-3" />
          <p className="text-[var(--text-secondary)]">{t('noAccess')}</p>
        </div>
      </div>
    );
  }

  const roleBadge = (role: Role) => {
    const cls = role === 'admin' ? 'bg-cyan-500/10 text-cyan-400' : role === 'manager' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-500/10 text-slate-400';
    const label = role === 'admin' ? t('admin') : role === 'manager' ? t('manager') : t('operator');
    return <span className={`tech-badge ${cls}`}>{label}</span>;
  };

  return (
    <div className="p-6 animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('manageUsers')}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{t('createAccount')}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-3d btn-3d-primary">
          <UserPlus className="w-4 h-4" /> {t('createAccount')}
        </button>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-[var(--text-muted)]"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <div className="panel overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-xs text-[var(--text-muted)] uppercase tracking-wider">
                <th className="text-left p-4 font-medium">{t('users')}</th>
                <th className="text-left p-4 font-medium">{t('role_')}</th>
                <th className="text-center p-4 font-medium">{t('canControl')}</th>
                <th className="text-center p-4 font-medium">{t('canPower')}</th>
                <th className="text-center p-4 font-medium">{t('canUpload')}</th>
                <th className="text-center p-4 font-medium">{t('canView')}</th>
                <th className="text-center p-4 font-medium">{t('canEdit')}</th>
                <th className="text-center p-4 font-medium">{t('status')}</th>
                <th className="text-right p-4 font-medium">{t('save')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-brand-600 flex items-center justify-center text-white text-xs font-bold">{u.email[0]?.toUpperCase()}</div>
                      <div>
                        <div className="text-sm font-medium text-[var(--text-primary)]">{u.full_name || u.email}</div>
                        <div className="text-xs text-[var(--text-muted)]">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">{roleBadge(u.role)}</td>
                  <td className="p-4 text-center">{u.can_control ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-[var(--text-muted)] mx-auto" />}</td>
                  <td className="p-4 text-center">{u.can_power ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-[var(--text-muted)] mx-auto" />}</td>
                  <td className="p-4 text-center">{u.can_upload ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-[var(--text-muted)] mx-auto" />}</td>
                  <td className="p-4 text-center">{u.can_view ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-[var(--text-muted)] mx-auto" />}</td>
                  <td className="p-4 text-center">{u.can_edit ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-[var(--text-muted)] mx-auto" />}</td>
                  <td className="p-4 text-center"><span className={`status-dot ${u.is_active ? 'online' : 'offline'}`} /></td>
                  <td className="p-4 text-right">
                    {u.role !== 'admin' && (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setEditingUser(u)} className="btn-3d btn-3d-ghost text-xs px-3 py-1.5">{t('grantPerms')}</button>
                        <DeleteUserButton userId={u.id} onDeleted={fetchUsers} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={fetchUsers} />}
      {editingUser && <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onUpdated={fetchUsers} />}
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('operator');
  const [canControl, setCanControl] = useState(false);
  const [canPower, setCanPower] = useState(false);
  const [canUpload, setCanUpload] = useState(false);
  const [canView, setCanView] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [showPass, setShowPass] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setLoading(true); setError('');
    const { data: session } = await supabase.auth.getSession();
    const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lgphone-admin?action=create_user`;
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.session?.access_token || ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName, role, can_control: canControl, can_power: canPower, can_upload: canUpload, can_view: canView, can_edit: canEdit }),
    });
    const json = await res.json();
    if (json.error) setError(json.error);
    else { onCreated(); onClose(); }
    setLoading(false);
  };

  return (
    <Modal onClose={onClose} title={t('createUser')} icon={UserPlus}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('fullName')}</label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nguyễn Văn A" className="tech-input pl-10" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('email')}</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@lgphone.system" className="tech-input pl-10" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('password')}</label>
          <div className="relative">
            <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="tech-input pr-12" />
            <button type="button" onClick={() => setShowPass(!showPass)} className="pass-toggle-btn active" style={{ right: '0.5rem' }}>
              {showPass ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('role_')}</label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="tech-input">
            <option value="operator">{t('operator')}</option>
            <option value="manager">{t('manager')}</option>
          </select>
        </div>

        <div className="space-y-2 pt-2">
          <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">{t('grantPerms')}</div>
          <PermissionToggle label={t('canControl')} desc={t('canControlDesc')} icon={Gamepad2} checked={canControl} onChange={setCanControl} />
          <PermissionToggle label={t('canPower')} desc={t('canPowerDesc')} icon={Power} checked={canPower} onChange={setCanPower} />
          <PermissionToggle label={t('canUpload')} desc={t('canUploadDesc')} icon={Upload} checked={canUpload} onChange={setCanUpload} />
          <PermissionToggle label={t('canView')} desc={t('canViewDesc')} icon={Eye} checked={canView} onChange={setCanView} />
          <PermissionToggle label={t('canEdit')} desc={t('canEditDesc')} icon={Edit3} checked={canEdit} onChange={setCanEdit} />
        </div>

        {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-3d btn-3d-ghost flex-1">{t('cancel')}</button>
          <button onClick={handleCreate} disabled={loading || !email || !password} className="btn-3d btn-3d-primary flex-1">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} {t('createAccount')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditUserModal({ user, onClose, onUpdated }: { user: ManagedUser; onClose: () => void; onUpdated: () => void }) {
  const { t } = useApp();
  const [role, setRole] = useState<Role>(user.role);
  const [canControl, setCanControl] = useState(user.can_control);
  const [canPower, setCanPower] = useState(user.can_power);
  const [canUpload, setCanUpload] = useState(user.can_upload);
  const [canView, setCanView] = useState(user.can_view);
  const [canEdit, setCanEdit] = useState(user.can_edit);
  const [isActive, setIsActive] = useState(user.is_active);
  const [fullName, setFullName] = useState(user.full_name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUpdate = async () => {
    setLoading(true); setError('');
    const { data: session } = await supabase.auth.getSession();
    const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lgphone-admin?action=update_user`;
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.session?.access_token || ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, full_name: fullName, role, can_control: canControl, can_power: canPower, can_upload: canUpload, can_view: canView, can_edit: canEdit, is_active: isActive }),
    });
    const json = await res.json();
    if (json.error) setError(json.error);
    else { onUpdated(); onClose(); }
    setLoading(false);
  };

  return (
    <Modal onClose={onClose} title={`${t('grantPerms')}: ${user.email}`} icon={Shield}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('fullName')}</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="tech-input" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('role_')}</label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="tech-input">
            <option value="operator">{t('operator')}</option>
            <option value="manager">{t('manager')}</option>
          </select>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">{t('grantPerms')}</div>
          <PermissionToggle label={t('canControl')} desc={t('canControlDesc')} icon={Gamepad2} checked={canControl} onChange={setCanControl} />
          <PermissionToggle label={t('canPower')} desc={t('canPowerDesc')} icon={Power} checked={canPower} onChange={setCanPower} />
          <PermissionToggle label={t('canUpload')} desc={t('canUploadDesc')} icon={Upload} checked={canUpload} onChange={setCanUpload} />
          <PermissionToggle label={t('canView')} desc={t('canViewDesc')} icon={Eye} checked={canView} onChange={setCanView} />
          <PermissionToggle label={t('canEdit')} desc={t('canEditDesc')} icon={Edit3} checked={canEdit} onChange={setCanEdit} />
          <PermissionToggle label={t('activateAccount')} desc={t('activateDesc')} icon={Check} checked={isActive} onChange={setIsActive} />
        </div>
        {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-3d btn-3d-ghost flex-1">{t('cancel')}</button>
          <button onClick={handleUpdate} disabled={loading} className="btn-3d btn-3d-primary flex-1">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t('saveChanges')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteUserButton({ userId, onDeleted }: { userId: string; onDeleted: () => void }) {
  const { t } = useApp();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    const { data: session } = await supabase.auth.getSession();
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lgphone-admin?action=delete_user`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.session?.access_token || ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    setLoading(false); setConfirming(false); onDeleted();
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button onClick={handleDelete} disabled={loading} className="btn-3d btn-3d-red text-xs px-2 py-1.5">{loading ? <Loader2 className="w-3 h-3 animate-spin" /> : t('delete')}</button>
        <button onClick={() => setConfirming(false)} className="btn-3d btn-3d-ghost text-xs px-2 py-1.5">{t('cancel')}</button>
      </div>
    );
  }
  return <button onClick={() => setConfirming(true)} className="text-[var(--text-muted)] hover:text-red-400 transition p-1.5 rounded-lg hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>;
}

function PermissionToggle({ label, desc, icon: Icon, checked, onChange }: { label: string; desc: string; icon: typeof Gamepad2; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 panel-inner p-3">
      <Icon className={`w-5 h-5 ${checked ? 'text-cyan-400' : 'text-[var(--text-muted)]'}`} />
      <div className="flex-1">
        <div className="text-sm text-[var(--text-primary)]">{label}</div>
        <div className="text-xs text-[var(--text-muted)]">{desc}</div>
      </div>
      <div className={`toggle-switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}><div className="knob" /></div>
    </div>
  );
}

function Modal({ children, title, icon: Icon, onClose }: { children: React.ReactNode; title: string; icon: typeof UserPlus; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in-up">
      <div className="panel max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] sticky top-0 bg-[var(--bg-panel)] z-10">
          <div className="flex items-center gap-2"><Icon className="w-5 h-5 text-cyan-400" /><h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2></div>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
