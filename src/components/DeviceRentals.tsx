import { useEffect, useState, useCallback } from 'react';
import { CalendarClock, Plus, Trash2, X, Loader2, Monitor, ArrowLeftRight, AlertTriangle, CheckCircle2, History, Shield, Clock, User, ChevronRight } from 'lucide-react';
import { supabase, type Device, type Profile, type DeviceRental } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useApp } from '../lib/app-context';
import { getRentals, createRental, updateRentalStatus, deleteRental, getRentalStatusInfo, formatDateTime, getDuration, getTimeRemaining, toLocalInput } from '../lib/rentals';

type Tab = 'active' | 'history';

export default function DeviceRentals() {
  const { session, profile } = useAuth();
  const { t } = useApp();
  const [rentals, setRentals] = useState<DeviceRental[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('active');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ device_id: '', user_id: '', start_time: toLocalInput(new Date().toISOString()), end_time: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rentalsData, devsData, usersData] = await Promise.all([
        getRentals(),
        supabase.from('devices').select('*').order('name'),
        supabase.from('profiles').select('*').order('email'),
      ]);
      setRentals(rentalsData);
      if (devsData.data) setDevices(devsData.data as Device[]);
      if (usersData.data) setUsers(usersData.data as Profile[]);
    } catch (err) { console.error('Load error:', err); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const channel = supabase.channel('device_rentals_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'device_rentals' }, () => load()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.device_id || !form.user_id || !form.start_time) { setError(t('fillAllFields')); return; }
    const device = devices.find(d => d.id === form.device_id);
    if (device?.assigned_to) { setError(t('deviceAlreadyAssigned')); return; }
    setSubmitting(true);
    try {
      await createRental({
        device_id: form.device_id, user_id: form.user_id, assigned_by: session?.user.id,
        start_time: new Date(form.start_time).toISOString(),
        end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
        notes: form.notes,
      });
      setShowModal(false);
      setForm({ device_id: '', user_id: '', start_time: toLocalInput(new Date().toISOString()), end_time: '', notes: '' });
      load();
    } catch (err) { setError((err as Error).message); }
    setSubmitting(false);
  }

  async function handleReturn(id: string) { if (!confirm(t('confirmReturn'))) return; await updateRentalStatus(id, 'returned'); load(); }
  async function handleCancel(id: string) { if (!confirm(t('confirmCancelRental'))) return; await updateRentalStatus(id, 'cancelled'); load(); }
  async function handleDelete(id: string) { if (!confirm(t('confirmDeleteRental'))) return; await deleteRental(id); load(); }

  const activeRentals = rentals.filter(r => r.status === 'active');
  const historyRentals = rentals.filter(r => r.status !== 'active');
  const displayRentals = tab === 'active' ? activeRentals : historyRentals;
  const stats = { total: rentals.length, active: activeRentals.length, expired: rentals.filter(r => r.status === 'expired').length, returned: rentals.filter(r => r.status === 'returned').length };

  return (
    <div className="p-6 animate-fade-in-up space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-cyan-400" /> {t('manageRentals')}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-amber-400" /> {t('rentalsDesc')}
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-3d btn-3d-cyan">
          <Plus className="w-4 h-4" /> {t('addRental')}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: t('totalRentals'), value: stats.total, icon: History, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
          { label: t('activeRentals'), value: stats.active, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: t('expiredRentals'), value: stats.expired, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
          { label: t('returnedRentals'), value: stats.returned, icon: ArrowLeftRight, color: 'text-slate-400', bg: 'bg-slate-500/10' },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="panel p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">{s.label}</p>
                  <p className="text-xl font-bold text-[var(--text-primary)] mt-1">{s.value}</p>
                </div>
                <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${s.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-1 p-1 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg w-fit">
        <button onClick={() => setTab('active')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === 'active' ? 'bg-cyan-500/15 text-cyan-400' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
          {t('rentalActiveTab')} ({activeRentals.length})
        </button>
        <button onClick={() => setTab('history')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === 'history' ? 'bg-cyan-500/15 text-cyan-400' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
          {t('rentalHistory')} ({historyRentals.length})
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
      ) : displayRentals.length === 0 ? (
        <div className="panel p-12 text-center">
          <CalendarClock className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-30" />
          <p className="text-[var(--text-muted)]">{tab === 'active' ? t('noActiveRentals') : t('noRentalHistory')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayRentals.map(rental => {
            const statusInfo = getRentalStatusInfo(rental.status);
            const device = rental.device;
            const user = rental.user;
            const assigner = rental.assigner;
            return (
              <div key={rental.id} className="panel p-4 hover:border-[var(--border-active)] transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center flex-shrink-0">
                      <Monitor className="w-5 h-5 text-[var(--text-secondary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{device?.name || 'Unknown'}</p>
                        <span className={`tech-badge ${statusInfo.bg} ${statusInfo.color}`}>{statusInfo.label}</span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{device?.model} · {device?.serial}</p>

                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs font-bold text-cyan-400">
                          {(user?.full_name || user?.email || '?')[0].toUpperCase()}
                        </div>
                        <span className="text-xs text-slate-300">{user?.full_name || user?.email}</span>
                        {assigner && <span className="text-xs text-[var(--text-muted)]">· {t('assignedBy')}: {assigner.full_name || assigner.email}</span>}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-xs">
                        <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                          <Clock className="w-3 h-3" />
                          <span>{t('startTime')}: {formatDateTime(rental.start_time)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                          <Clock className="w-3 h-3" />
                          <span>{t('endTime')}: {formatDateTime(rental.end_time)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                          <History className="w-3 h-3" />
                          <span>{t('duration')}: {getDuration(rental.start_time, rental.end_time)}</span>
                        </div>
                      </div>

                      {rental.status === 'active' && (
                        <div className="mt-2">
                          <span className="text-xs font-medium text-cyan-400">{t('timeRemaining')}: {getTimeRemaining(rental.end_time)}</span>
                        </div>
                      )}

                      {rental.notes && (
                        <p className="text-xs text-[var(--text-muted)] mt-2 italic">"{rental.notes}"</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {rental.status === 'active' && (
                      <>
                        <button onClick={() => handleReturn(rental.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all">
                          {t('returnDevice')}
                        </button>
                        <button onClick={() => handleCancel(rental.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all">
                          {t('cancelRental')}
                        </button>
                      </>
                    )}
                    {tab === 'history' && (
                      <button onClick={() => handleDelete(rental.id)} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in-up" onClick={() => setShowModal(false)}>
          <div className="panel max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-cyan-400" /> {t('assignDevice')}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('selectDeviceToAssign')}</label>
                <select className="tech-input" value={form.device_id} onChange={e => setForm({ ...form, device_id: e.target.value })} required>
                  <option value="">— {t('selectDeviceToAssign')} —</option>
                  {devices.filter(d => !d.assigned_to).map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.model})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('selectUser')}</label>
                <select className="tech-input" value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })} required>
                  <option value="">— {t('selectUser')} —</option>
                  {users.filter(u => u.id !== profile?.id).map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('startTime')}</label>
                  <input type="datetime-local" className="tech-input" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('endTimeOptional')}</label>
                  <input type="datetime-local" className="tech-input" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('rentalNotes')}</label>
                <textarea className="tech-input min-h-[60px]" placeholder={t('rentalNotesPlaceholder')} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={submitting} className="btn-3d btn-3d-cyan flex-1">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t('addRental')}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-3d btn-3d-ghost flex-1">
                  {t('cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
