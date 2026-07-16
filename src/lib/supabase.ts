import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Role = 'admin' | 'manager' | 'operator';

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  can_control: boolean;
  can_power: boolean;
  can_upload: boolean;
  can_view: boolean;
  can_edit: boolean;
  is_active: boolean;
  created_at: string;
};

export type Device = {
  id: string;
  name: string;
  serial: string;
  model: string;
  android_version: string;
  status: 'online' | 'offline';
  assigned_to: string | null;
  vm_id: string | null;
  screen_url: string | null;
  group_label: string;
  created_at: string;
};

export type Announcement = {
  id: string;
  title: string;
  content: string;
  created_by: string | null;
  created_at: string;
  is_active: boolean;
};

export type AppFile = {
  id: string;
  filename: string;
  file_path: string;
  file_size: number;
  package_name: string | null;
  is_system: boolean;
  device_id: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type SystemSetting = {
  id: string;
  key: string;
  value: string;
  updated_by: string | null;
  updated_at: string;
};

export type AITemplate = {
  id: string;
  name: string;
  description: string;
  task_type: string;
  icon: string;
  default_config: Record<string, unknown>;
  is_system: boolean;
  created_by: string | null;
  created_at: string;
};

export type AITaskStatus = 'pending' | 'running' | 'completed' | 'error' | 'stopped';

export type AITask = {
  id: string;
  device_id: string;
  template_id: string | null;
  task_type: string;
  task_name: string;
  config: Record<string, unknown>;
  status: AITaskStatus;
  progress: number;
  current_loop: number;
  total_loops: number;
  result: Record<string, unknown> | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};
