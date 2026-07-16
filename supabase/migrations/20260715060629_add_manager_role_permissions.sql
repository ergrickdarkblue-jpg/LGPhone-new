/*
# Add manager role and granular permissions

1. Modified tables
- profiles: role check now includes 'manager'
- profiles: add can_view (view devices/screens), can_edit (edit device settings)
2. Add theme preference setting
3. Add language preference setting
*/

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'manager', 'operator'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS can_view boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS can_edit boolean NOT NULL DEFAULT false;

INSERT INTO system_settings (key, value) VALUES
  ('theme', 'dark'),
  ('language', 'vi')
ON CONFLICT (key) DO NOTHING;
