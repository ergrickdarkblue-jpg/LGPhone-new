import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'operator';
  can_control: boolean;
  can_power: boolean;
  can_upload: boolean;
  can_view: boolean;
  can_edit: boolean;
  is_active: boolean;
  theme: string;
  created_at: string;
}

export interface Device {
  id: string;
  name: string;
  serial: string;
  model: string;
  android_version: string;
  status: string;
  assigned_to: string | null;
  screen_url: string | null;
  group_label: string;
  last_seen: string | null;
  created_at: string;
}

export interface DeviceCommand {
  id: string;
  device_serial: string | null;
  command_type: string | null;
  command_data: Record<string, unknown> | null;
  status: string;
  result: Record<string, unknown> | null;
  priority: number;
  created_at: string;
  executed_at: string | null;
  completed_at: string | null;
}

export interface AppFile {
  id: string;
  filename: string;
  file_path: string;
  file_size: number;
  package_name: string | null;
  is_system: boolean;
  device_id: string | null;
  uploaded_by: string | null;
  created_at: string;
  status: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  created_by: string | null;
  created_at: string;
  is_active: boolean;
}

export interface AiTemplate {
  id: string;
  name: string;
  description: string;
  task_type: string;
  icon: string;
  default_config: Record<string, unknown>;
  is_system: boolean;
  created_at: string;
}

export interface AiTask {
  id: string;
  device_id: string;
  task_type: string;
  task_name: string;
  config: Record<string, unknown>;
  status: string;
  result: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}
