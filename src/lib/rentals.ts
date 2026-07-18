import { supabase } from './supabase';
import type { DeviceRental } from './supabase';

export async function getRentals(): Promise<DeviceRental[]> {
  const { data, error } = await supabase
    .from('device_rentals')
    .select('*, device:devices(id,name,serial,model), user:profiles!device_rentals_user_id_fkey(id,email,full_name), assigner:profiles!device_rentals_assigned_by_fkey(id,email,full_name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as DeviceRental[];
}

export async function getMyRentals(userId: string): Promise<DeviceRental[]> {
  const { data, error } = await supabase
    .from('device_rentals')
    .select('*, device:devices(id,name,serial,model), user:profiles!device_rentals_user_id_fkey(id,email,full_name), assigner:profiles!device_rentals_assigned_by_fkey(id,email,full_name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as DeviceRental[];
}

export async function createRental(rental: {
  device_id: string; user_id: string; assigned_by?: string;
  start_time: string; end_time?: string | null; notes?: string;
}): Promise<void> {
  const { error } = await supabase.from('device_rentals').insert({
    device_id: rental.device_id, user_id: rental.user_id, assigned_by: rental.assigned_by || null,
    start_time: rental.start_time, end_time: rental.end_time || null,
    notes: rental.notes || '', status: 'active',
  });
  if (error) throw error;
  await supabase.from('devices').update({ assigned_to: rental.user_id }).eq('id', rental.device_id);
}

export async function updateRentalStatus(id: string, status: DeviceRental['status']): Promise<void> {
  const { error } = await supabase.from('device_rentals').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  if (status === 'returned' || status === 'cancelled' || status === 'expired') {
    const { data } = await supabase.from('device_rentals').select('device_id').eq('id', id).single();
    if (data) await supabase.from('devices').update({ assigned_to: null }).eq('id', data.device_id);
  }
}

export async function deleteRental(id: string): Promise<void> {
  const { data } = await supabase.from('device_rentals').select('device_id').eq('id', id).single();
  if (data) await supabase.from('devices').update({ assigned_to: null }).eq('id', data.device_id);
  const { error } = await supabase.from('device_rentals').delete().eq('id', id);
  if (error) throw error;
}

export function getRentalStatusInfo(status: DeviceRental['status']) {
  switch (status) {
    case 'active': return { label: 'Đang sử dụng', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    case 'expired': return { label: 'Hết hạn', color: 'text-red-400', bg: 'bg-red-500/10' };
    case 'returned': return { label: 'Đã trả', color: 'text-slate-400', bg: 'bg-slate-500/10' };
    case 'cancelled': return { label: 'Đã hủy', color: 'text-amber-400', bg: 'bg-amber-500/10' };
    default: return { label: status, color: 'text-slate-400', bg: 'bg-slate-500/10' };
  }
}

export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function getDuration(start: string, end: string | null): string {
  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : Date.now();
  const diffMs = endTime - startTime;
  if (diffMs < 0) return '0m';
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function getTimeRemaining(end: string | null): string {
  if (!end) return 'Vô thời hạn';
  const remaining = new Date(end).getTime() - Date.now();
  if (remaining < 0) return 'Đã hết hạn';
  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `Còn ${days}d ${hours}h`;
  if (hours > 0) return `Còn ${hours}h ${mins}m`;
  return `Còn ${mins}m`;
}

export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}
