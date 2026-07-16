import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Bot, Play, Square, Trash2, Plus, Zap, Clock, CheckCircle2, XCircle,
  Loader2, Smartphone, Layers, Activity, ChevronRight, X, Save,
  Gamepad2, Heart, Gift, MousePointerClick, Cpu, AlertCircle,
} from 'lucide-react';
import { supabase, type Device, type AITemplate, type AITask, type AITaskStatus } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useApp } from '../lib/app-context';

const ICON_MAP: Record<string, typeof Bot> = {
  Gamepad2, Smartphone, Heart, Play, Gift, MousePointerClick, Bot, Cpu,
};

const STATUS_CONFIG: Record<AITaskStatus, { color: string; bg: string; icon: typeof Clock }> = {
  pending: { color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Clock },
  running: { color: 'text-cyan-400', bg: 'bg-cyan-500/10', icon: Loader2 },
  completed: { color: 'text-green-400', bg: 'bg-green-500/10', icon: CheckCircle2 },
  error: { color: 'text-red-400', bg: 'bg-red-500/10', icon: XCircle },
  stopped: { color: 'text-slate-400', bg: 'bg-slate-500/10', icon: Square },
};

type Tab = 'templates' | 'batch' | 'history';

export default function AI() {
  const { profile } = useAuth();
  const { t } = useApp();
  const isAdmin = profile?.role === 'admin';
  const canControl = profile?.can_control || isAdmin;
  const [tab, setTab] = useState<Tab>('templates');
  const [templates, setTemplates] = useState<AITemplate[]>([]);
  const [tasks, setTasks] = useState<AITask[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);

  const fetchData = useCallback(async () => {
    const [tplRes, taskRes, devRes] = await Promise.all([
      supabase.from('ai_templates').select('*').order('is_system', { ascending: false }).order('name'),
      supabase.from('ai_tasks').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('devices').select('*').order('name'),
    ]);
    setTemplates((tplRes.data as AITemplate[]) || []);
    setTasks((taskRes.data as AITask[]) || []);
    setDevices((devRes.data as Device[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('ai-automation')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_tasks' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_templates' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const runningTasks = useMemo(() => tasks.filter(t => t.status === 'running' || t.status === 'pending'), [tasks]);
  const completedTasks = useMemo(() => tasks.filter(t => t.status === 'completed'), [tasks]);
  const errorTasks = useMemo(() => tasks.filter(t => t.status === 'error'), [tasks]);

  const stats = [
    { label: t('aiTotalTasks'), value: tasks.length, icon: Layers, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: t('aiRunningCount'), value: runningTasks.length, icon: Activity, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: t('aiCompletedTasks'), value: completedTasks.length, icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: t('aiErrorTasks'), value: errorTasks.length, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  ];

  const tabs: { id: Tab; label: string; icon: typeof Bot }[] = [
    { id: 'templates', label: t('aiTemplates'), icon: Bot },
    { id: 'batch', label: t('aiBatchRun'), icon: Layers },
    { id: 'history', label: t('aiTaskHistory'), icon: Clock },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Bot className="w-7 h-7 text-cyan-400" />
            {t('aiAutomation')}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{t('aiAutomationDesc')}</p>
        </div>
        {canControl && (
          <button onClick={() => setShowCreate(true)} className="btn-3d btn-3d-cyan">
            <Plus className="w-4 h-4" /> {t('aiNew')}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="panel p-4 hover:border-[var(--border-active)] transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <Icon className={`w-4.5 h-4.5 ${s.color}`} />
                </div>
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)]">{loading ? '—' : s.value}</div>
              <div className="text-xs text-[var(--text-secondary)]">{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Live running tasks bar */}
      {runningTasks.length > 0 && (
        <div className="panel p-4 border-cyan-400/20">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('aiLiveMonitor')}</h2>
            <span className="tech-badge bg-cyan-500/10 text-cyan-400">{runningTasks.length}</span>
          </div>
          <div className="space-y-2">
            {runningTasks.map(task => <RunningTaskRow key={task.id} task={task} onUpdate={fetchData} />)}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tb => {
          const Icon = tb.icon;
          return (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === tb.id ? 'bg-brand-600/20 text-cyan-400 border border-cyan-400/30' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:bg-white/5'}`}>
              <Icon className="w-4 h-4" /> {tb.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-[var(--text-muted)]"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : tab === 'templates' ? (
        <TemplateGrid templates={templates} devices={devices} canControl={canControl} onRun={() => fetchData()} />
      ) : tab === 'batch' ? (
        <BatchRunPanel templates={templates} devices={devices} canControl={canControl} onDone={() => fetchData()} />
      ) : (
        <HistoryPanel tasks={tasks} onUpdate={fetchData} />
      )}

      {showCreate && <CreateTaskModal templates={templates} devices={devices} onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); fetchData(); }} />}
      {showTemplateBuilder && <TemplateBuilderModal onClose={() => setShowTemplateBuilder(false)} onDone={() => { setShowTemplateBuilder(false); fetchData(); }} />}
      {showTemplateBuilder && null}
    </div>
  );
}

// ── Template Grid ─────────────────────────────────────────────────────────────
function TemplateGrid({ templates, devices, canControl, onRun }: {
  templates: AITemplate[]; devices: Device[]; canControl: boolean; onRun: () => void;
}) {
  const { t } = useApp();
  const [selectedTpl, setSelectedTpl] = useState<AITemplate | null>(null);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(tpl => {
          const Icon = ICON_MAP[tpl.icon] || Bot;
          return (
            <div key={tpl.id} className="panel p-5 hover:border-[var(--border-active)] transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/15 to-brand-600/15 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-cyan-400" />
                </div>
                {tpl.is_system && <span className="tech-badge bg-cyan-500/10 text-cyan-400 text-[10px]">SYSTEM</span>}
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{tpl.name}</h3>
              <p className="text-xs text-[var(--text-secondary)] mb-3 line-clamp-2">{tpl.description}</p>
              <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mb-4">
                <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> {(tpl.default_config as any)?.loop || '?'}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {(tpl.default_config as any)?.delay || '?'}s</span>
              </div>
              {canControl && (
                <button onClick={() => setSelectedTpl(tpl)} className="btn-3d btn-3d-cyan w-full text-xs">
                  <Play className="w-3.5 h-3.5" /> {t('aiStart')}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {templates.length === 0 && (
        <div className="panel p-12 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3">
          <Bot className="w-12 h-12 opacity-30" />
          <p>{t('aiNoTemplates')}</p>
        </div>
      )}
      {selectedTpl && (
        <QuickRunModal template={selectedTpl} devices={devices} onClose={() => setSelectedTpl(null)} onDone={() => { setSelectedTpl(null); onRun(); }} />
      )}
    </div>
  );
}

// ── Quick Run Modal (single device) ───────────────────────────────────────────
function QuickRunModal({ template, devices, onClose, onDone }: {
  template: AITemplate; devices: Device[]; onClose: () => void; onDone: () => void;
}) {
  const { t } = useApp();
  const [deviceId, setDeviceId] = useState('');
  const [loops, setLoops] = useState((template.default_config as any)?.loop || 10);
  const [delay, setDelay] = useState((template.default_config as any)?.delay || 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRun = async () => {
    if (!deviceId) { setError(t('aiSelectDevice')); return; }
    setLoading(true); setError('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tasks?action=create_task`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.session?.access_token || ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, template_id: template.id, task_type: template.task_type, task_name: template.name, config: { loop: loops, delay } }),
      });
      const body = await res.json();
      if (!res.ok || body.error) { setError(body.error || 'Error'); setLoading(false); return; }
      onDone();
    } catch { setError('Network error'); setLoading(false); }
  };

  return (
    <Modal title={`${t('aiStart')}: ${template.name}`} onClose={onClose}>
      {error && <ErrorBox msg={error} />}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('aiSelectDevice')}</label>
          <select value={deviceId} onChange={e => setDeviceId(e.target.value)} className="tech-input">
            <option value="">—</option>
            {devices.filter(d => d.status === 'online').map(d => <option key={d.id} value={d.serial}>{d.name} ({d.serial})</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('aiLoops')}</label>
            <input type="number" min={1} max={9999} value={loops} onChange={e => setLoops(parseInt(e.target.value) || 1)} className="tech-input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('aiDelay')}</label>
            <input type="number" min={0} step={0.5} value={delay} onChange={e => setDelay(parseFloat(e.target.value) || 0)} className="tech-input" />
          </div>
        </div>
        <button onClick={handleRun} disabled={loading} className="btn-3d btn-3d-cyan w-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} {t('aiStart')}
        </button>
      </div>
    </Modal>
  );
}

// ── Batch Run Panel ───────────────────────────────────────────────────────────
function BatchRunPanel({ templates, devices, canControl, onDone }: {
  templates: AITemplate[]; devices: Device[]; canControl: boolean; onDone: () => void;
}) {
  const { t } = useApp();
  const [selectedTpl, setSelectedTpl] = useState<AITemplate | null>(null);
  const [selectedDevs, setSelectedDevs] = useState<Set<string>>(new Set());
  const [loops, setLoops] = useState(10);
  const [delay, setDelay] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const onlineDevs = devices.filter(d => d.status === 'online');

  const toggleDev = (serial: string) => {
    setSelectedDevs(prev => {
      const next = new Set(prev);
      next.has(serial) ? next.delete(serial) : next.add(serial);
      return next;
    });
  };

  const selectAll = () => setSelectedDevs(new Set(onlineDevs.map(d => d.serial)));
  const selectNone = () => setSelectedDevs(new Set());

  const handleBatch = async () => {
    if (selectedDevs.size === 0) { setError(t('aiSelectAtLeastOne')); return; }
    if (!selectedTpl) { setError(t('aiSelectTemplate')); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tasks?action=batch_create`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.session?.access_token || ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_ids: Array.from(selectedDevs), template_id: selectedTpl.id, task_type: selectedTpl.task_type, task_name: selectedTpl.name, config: { loop: loops, delay } }),
      });
      const body = await res.json();
      if (!res.ok || body.error) { setError(body.error || 'Error'); setLoading(false); return; }
      setSuccess(t('aiBatchCreated').replace('{count}', body.count).replace('{devices}', selectedDevs.size));
      setSelectedDevs(new Set()); setLoading(false); onDone();
    } catch { setError('Network error'); setLoading(false); }
  };

  if (!canControl) return <NoPermission />;

  return (
    <div className="space-y-4">
      {error && <ErrorBox msg={error} />}
      {success && <SuccessBox msg={success} />}

      <div className="panel p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{t('aiSelectTemplate')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {templates.map(tpl => {
            const Icon = ICON_MAP[tpl.icon] || Bot;
            const active = selectedTpl?.id === tpl.id;
            return (
              <button key={tpl.id} onClick={() => setSelectedTpl(tpl)}
                className={`p-3 rounded-lg flex flex-col items-center gap-2 transition-all ${active ? 'bg-cyan-500/15 border border-cyan-400/40' : 'panel-inner hover:bg-white/5 border border-transparent'}`}>
                <Icon className={`w-5 h-5 ${active ? 'text-cyan-400' : 'text-[var(--text-secondary)]'}`} />
                <span className={`text-xs font-medium text-center ${active ? 'text-cyan-400' : 'text-[var(--text-primary)]'}`}>{tpl.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="panel p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('aiSelectDevices')} ({selectedDevs.size}/{onlineDevs.length})</h3>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-xs text-cyan-400 hover:text-cyan-300 px-2 py-1">Select all</button>
            <button onClick={selectNone} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-2 py-1">Clear</button>
          </div>
        </div>
        {onlineDevs.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] text-center py-8">{t('noDevices')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {onlineDevs.map(d => {
              const checked = selectedDevs.has(d.serial);
              return (
                <button key={d.id} onClick={() => toggleDev(d.serial)}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all ${checked ? 'bg-cyan-500/10 border border-cyan-400/30' : 'panel-inner hover:bg-white/5 border border-transparent'}`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${checked ? 'bg-cyan-400 border-cyan-400' : 'border-[var(--border-subtle)]'}`}>
                    {checked && <CheckCircle2 className="w-3 h-3 text-[#060910]" />}
                  </div>
                  <Smartphone className={`w-4 h-4 ${checked ? 'text-cyan-400' : 'text-[var(--text-muted)]'}`} />
                  <div className="flex-1 text-left">
                    <div className="text-sm text-[var(--text-primary)]">{d.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{d.serial}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="panel p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{t('aiConfig')}</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('aiLoops')}</label>
            <input type="number" min={1} max={9999} value={loops} onChange={e => setLoops(parseInt(e.target.value) || 1)} className="tech-input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('aiDelay')}</label>
            <input type="number" min={0} step={0.5} value={delay} onChange={e => setDelay(parseFloat(e.target.value) || 0)} className="tech-input" />
          </div>
        </div>
        <button onClick={handleBatch} disabled={loading || selectedDevs.size === 0 || !selectedTpl} className="btn-3d btn-3d-cyan w-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {t('aiBatchRun')} ({selectedDevs.size})
        </button>
      </div>
    </div>
  );
}

// ── History Panel ─────────────────────────────────────────────────────────────
function HistoryPanel({ tasks, onUpdate }: { tasks: AITask[]; onUpdate: () => void }) {
  const { t } = useApp();
  const [filter, setFilter] = useState<AITaskStatus | 'all'>('all');

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  const handleStop = async (id: string) => {
    if (!confirm(t('aiConfirmStop'))) return;
    const { data: session } = await supabase.auth.getSession();
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tasks?action=stop_task`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${session.session?.access_token || ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    onUpdate();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('aiConfirmDelete'))) return;
    const { data: session } = await supabase.auth.getSession();
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tasks?action=delete_task&id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.session?.access_token || ''}` },
    });
    onUpdate();
  };

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'running', 'pending', 'completed', 'error', 'stopped'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === f ? 'bg-brand-600/20 text-cyan-400 border border-cyan-400/30' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent hover:bg-white/5'}`}>
            {f === 'all' ? t('all') : STATUS_CONFIG[f as AITaskStatus].color.replace('text-', '').replace('-400', '')}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="panel p-12 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3">
          <Clock className="w-12 h-12 opacity-30" />
          <p>{t('aiNoTasks')}</p>
        </div>
      ) : (
        <div className="panel overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-xs text-[var(--text-muted)] uppercase tracking-wider">
                <th className="text-left p-4 font-medium">{t('aiTaskType')}</th>
                <th className="text-left p-4 font-medium">{t('aiDevice')}</th>
                <th className="text-center p-4 font-medium">{t('aiStatus')}</th>
                <th className="text-center p-4 font-medium">{t('aiProgress')}</th>
                <th className="text-center p-4 font-medium">{t('aiLoops')}</th>
                <th className="text-left p-4 font-medium">{t('aiCreated')}</th>
                <th className="text-right p-4 font-medium">{''}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => {
                const sc = STATUS_CONFIG[task.status];
                const SIcon = sc.icon;
                return (
                  <tr key={task.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="p-4">
                      <div className="text-sm text-[var(--text-primary)] font-medium">{task.task_name || task.task_type}</div>
                      <div className="text-xs text-[var(--text-muted)]">{task.task_type}</div>
                    </td>
                    <td className="p-4 text-xs text-[var(--text-secondary)] font-mono">{task.device_id}</td>
                    <td className="p-4 text-center">
                      <span className={`tech-badge ${sc.bg} ${sc.color} inline-flex items-center gap-1`}>
                        <SIcon className={`w-3 h-3 ${task.status === 'running' ? 'animate-spin' : ''}`} />
                        {task.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden min-w-16">
                          <div className="h-full bg-cyan-400 transition-all" style={{ width: `${task.progress}%` }} />
                        </div>
                        <span className="text-xs text-[var(--text-muted)]">{task.progress}%</span>
                      </div>
                    </td>
                    <td className="p-4 text-center text-xs text-[var(--text-secondary)]">{task.current_loop}/{task.total_loops}</td>
                    <td className="p-4 text-xs text-[var(--text-muted)]">{new Date(task.created_at).toLocaleString('vi-VN')}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        {task.status === 'running' && (
                          <button onClick={() => handleStop(task.id)} className="text-amber-400 hover:text-amber-300 p-1.5 rounded-lg hover:bg-amber-500/10 transition" title={t('aiStop')}>
                            <Square className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => handleDelete(task.id)} className="text-[var(--text-muted)] hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition" title={t('aiDelete')}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Running Task Row ──────────────────────────────────────────────────────────
function RunningTaskRow({ task, onUpdate }: { task: AITask; onUpdate: () => void }) {
  const { t } = useApp();
  const sc = STATUS_CONFIG[task.status];

  const handleStop = async () => {
    if (!confirm(t('aiConfirmStop'))) return;
    const { data: session } = await supabase.auth.getSession();
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tasks?action=stop_task`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${session.session?.access_token || ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id }),
    });
    onUpdate();
  };

  return (
    <div className="panel-inner p-3 flex items-center gap-3">
      <Loader2 className={`w-4 h-4 ${sc.color} ${task.status === 'running' ? 'animate-spin' : ''}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-[var(--text-primary)] font-medium">{task.task_name || task.task_type}</div>
        <div className="text-xs text-[var(--text-muted)]">{task.device_id} · {task.current_loop}/{task.total_loops}</div>
      </div>
      <div className="flex-1 max-w-32">
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full bg-cyan-400 transition-all" style={{ width: `${task.progress}%` }} />
        </div>
      </div>
      <span className="text-xs text-[var(--text-muted)]">{task.progress}%</span>
      <button onClick={handleStop} className="text-amber-400 hover:text-amber-300 p-1.5 rounded-lg hover:bg-amber-500/10 transition">
        <Square className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Create Task Modal ─────────────────────────────────────────────────────────
function CreateTaskModal({ templates, devices, onClose, onDone }: {
  templates: AITemplate[]; devices: Device[]; onClose: () => void; onDone: () => void;
}) {
  const { t } = useApp();
  const [deviceId, setDeviceId] = useState('');
  const [tplId, setTplId] = useState('');
  const [taskName, setTaskName] = useState('');
  const [loops, setLoops] = useState(10);
  const [delay, setDelay] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedTpl = templates.find(t => t.id === tplId);

  const handleCreate = async () => {
    if (!deviceId) { setError(t('aiSelectDevice')); return; }
    if (!tplId && !taskName) { setError(t('aiTaskName')); return; }
    setLoading(true); setError('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const tpl = templates.find(t => t.id === tplId);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tasks?action=create_task`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.session?.access_token || ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          template_id: tplId || undefined,
          task_type: tpl?.task_type || 'custom',
          task_name: taskName || tpl?.name || '',
          config: { loop: loops, delay },
        }),
      });
      const body = await res.json();
      if (!res.ok || body.error) { setError(body.error || 'Error'); setLoading(false); return; }
      onDone();
    } catch { setError('Network error'); setLoading(false); }
  };

  return (
    <Modal title={t('aiCreateTask')} onClose={onClose}>
      {error && <ErrorBox msg={error} />}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('aiSelectDevice')}</label>
          <select value={deviceId} onChange={e => setDeviceId(e.target.value)} className="tech-input">
            <option value="">—</option>
            {devices.filter(d => d.status === 'online').map(d => <option key={d.id} value={d.serial}>{d.name} ({d.serial})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('aiSelectTemplate')}</label>
          <select value={tplId} onChange={e => { setTplId(e.target.value); const tpl = templates.find(t => t.id === e.target.value); if (tpl) { setLoops((tpl.default_config as any)?.loop || 10); setDelay((tpl.default_config as any)?.delay || 1); } }} className="tech-input">
            <option value="">{t('aiCustomTask')}</option>
            {templates.map(tpl => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('aiTaskName')}</label>
          <input type="text" value={taskName} onChange={e => setTaskName(e.target.value)} placeholder={t('aiTaskNamePlaceholder')} className="tech-input" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('aiLoops')}</label>
            <input type="number" min={1} max={9999} value={loops} onChange={e => setLoops(parseInt(e.target.value) || 1)} className="tech-input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('aiDelay')}</label>
            <input type="number" min={0} step={0.5} value={delay} onChange={e => setDelay(parseFloat(e.target.value) || 0)} className="tech-input" />
          </div>
        </div>
        <button onClick={handleCreate} disabled={loading} className="btn-3d btn-3d-cyan w-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} {t('aiStart')}
        </button>
      </div>
    </Modal>
  );
}

// ── Template Builder Modal ────────────────────────────────────────────────────
function TemplateBuilderModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t } = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState('custom');
  const [icon, setIcon] = useState('Bot');
  const [loops, setLoops] = useState(10);
  const [delay, setDelay] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const icons = ['Bot', 'Gamepad2', 'Smartphone', 'Heart', 'Play', 'Gift', 'MousePointerClick', 'Cpu'];

  const handleSave = async () => {
    if (!name || !taskType) { setError('Name and type required'); return; }
    setLoading(true); setError('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tasks?action=create_template`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.session?.access_token || ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, task_type: taskType, icon, default_config: { loop: loops, delay } }),
      });
      const body = await res.json();
      if (!res.ok || body.error) { setError(body.error || 'Error'); setLoading(false); return; }
      onDone();
    } catch { setError('Network error'); setLoading(false); }
  };

  return (
    <Modal title={t('aiCustomBuilder')} onClose={onClose}>
      {error && <ErrorBox msg={error} />}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('aiTaskName')}</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={t('aiTaskNamePlaceholder')} className="tech-input" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Mô tả</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="..." className="tech-input" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('aiTaskType')}</label>
          <input type="text" value={taskType} onChange={e => setTaskType(e.target.value)} placeholder="custom" className="tech-input font-mono" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Icon</label>
          <div className="flex gap-2 flex-wrap">
            {icons.map(ic => {
              const Icon = ICON_MAP[ic] || Bot;
              return (
                <button key={ic} onClick={() => setIcon(ic)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${icon === ic ? 'bg-cyan-500/15 border border-cyan-400/40' : 'panel-inner hover:bg-white/5 border border-transparent'}`}>
                  <Icon className={`w-5 h-5 ${icon === ic ? 'text-cyan-400' : 'text-[var(--text-secondary)]'}`} />
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('aiLoops')}</label>
            <input type="number" min={1} max={9999} value={loops} onChange={e => setLoops(parseInt(e.target.value) || 1)} className="tech-input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">{t('aiDelay')}</label>
            <input type="number" min={0} step={0.5} value={delay} onChange={e => setDelay(parseFloat(e.target.value) || 0)} className="tech-input" />
          </div>
        </div>
        <button onClick={handleSave} disabled={loading} className="btn-3d btn-3d-primary w-full">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t('aiSaveTemplate')}
        </button>
      </div>
    </Modal>
  );
}

// ── Shared UI ──────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in-up">
      <div className="panel max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] sticky top-0 bg-[var(--bg-panel)] z-10">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{msg}</div>;
}

function SuccessBox({ msg }: { msg: string }) {
  return <div className="mb-4 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">{msg}</div>;
}

function NoPermission() {
  return (
    <div className="panel p-12 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3">
      <AlertCircle className="w-12 h-12 opacity-30" />
      <p>No control permission</p>
    </div>
  );
}
