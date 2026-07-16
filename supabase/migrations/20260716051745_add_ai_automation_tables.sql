/*
# AI Automation Tables

1. New Tables
- `ai_templates`: Reusable AI task templates
  - id, name, description, task_type, icon, default_config (jsonb), is_system, created_by, created_at
- `ai_tasks`: AI task execution instances
  - id, device_id, template_id, task_type, task_name, config (jsonb), status, progress, current_loop, total_loops, result (jsonb), error_message, created_by, created_at, started_at, completed_at

2. Indexes on device_id, status, created_at for ai_tasks; task_type for ai_templates

3. Security: RLS enabled on both. Authenticated-only CRUD. Templates owner-scoped. Tasks shared read, owner/admin update/delete.

4. System templates pre-seeded (game_farm, social_scroll, auto_like, auto_watch, daily_login, auto_tap).
*/

CREATE TABLE IF NOT EXISTS ai_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  task_type text NOT NULL,
  icon text DEFAULT 'Bot',
  default_config jsonb DEFAULT '{}'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  template_id uuid REFERENCES ai_templates(id) ON DELETE SET NULL,
  task_type text NOT NULL,
  task_name text DEFAULT '',
  config jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'error', 'stopped')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_loop integer NOT NULL DEFAULT 0,
  total_loops integer NOT NULL DEFAULT 0,
  result jsonb,
  error_message text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_device_id ON ai_tasks(device_id);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_status ON ai_tasks(status);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_created_at ON ai_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_templates_task_type ON ai_templates(task_type);

ALTER TABLE ai_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tasks ENABLE ROW LEVEL SECURITY;

-- ai_templates policies
DROP POLICY IF EXISTS "select_ai_templates" ON ai_templates;
CREATE POLICY "select_ai_templates" ON ai_templates FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_ai_templates" ON ai_templates;
CREATE POLICY "insert_ai_templates" ON ai_templates FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "update_ai_templates" ON ai_templates;
CREATE POLICY "update_ai_templates" ON ai_templates FOR UPDATE
  TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "delete_ai_templates" ON ai_templates;
CREATE POLICY "delete_ai_templates" ON ai_templates FOR DELETE
  TO authenticated USING (auth.uid() = created_by);

-- ai_tasks policies
DROP POLICY IF EXISTS "select_ai_tasks" ON ai_tasks;
CREATE POLICY "select_ai_tasks" ON ai_tasks FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_ai_tasks" ON ai_tasks;
CREATE POLICY "insert_ai_tasks" ON ai_tasks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "update_ai_tasks" ON ai_tasks;
CREATE POLICY "update_ai_tasks" ON ai_tasks FOR UPDATE
  TO authenticated USING (auth.uid() = created_by OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (auth.uid() = created_by OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "delete_ai_tasks" ON ai_tasks;
CREATE POLICY "delete_ai_tasks" ON ai_tasks FOR DELETE
  TO authenticated USING (auth.uid() = created_by OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Seed system templates
INSERT INTO ai_templates (name, description, task_type, icon, default_config, is_system) VALUES
  ('Cày game', 'Tap và swipe tự động để cày game', 'game_farm', 'Gamepad2', '{"loop": 50, "delay": 1}'::jsonb, true),
  ('Lướt MXH', 'Cuộn feed mạng xã hội tự động', 'social_scroll', 'Smartphone', '{"loop": 100, "delay": 2}'::jsonb, true),
  ('Auto Like', 'Double tap để like tự động', 'auto_like', 'Heart', '{"loop": 80, "delay": 2}'::jsonb, true),
  ('Auto Watch', 'Xem video tự động', 'auto_watch', 'Play', '{"loop": 20, "delay": 5}'::jsonb, true),
  ('Daily Login', 'Mở game nhận quà hàng ngày', 'daily_login', 'Gift', '{"loop": 1, "delay": 2}'::jsonb, true),
  ('Tap liên tục', 'Tap tại một điểm liên tục', 'auto_tap', 'MousePointerClick', '{"loop": 200, "delay": 0.5}'::jsonb, true)
ON CONFLICT DO NOTHING;
