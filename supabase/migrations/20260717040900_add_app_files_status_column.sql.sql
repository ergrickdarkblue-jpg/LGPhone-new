ALTER TABLE app_files ADD COLUMN IF NOT EXISTS status text DEFAULT 'uploaded';
