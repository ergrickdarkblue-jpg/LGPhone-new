import { ADB } from './adb.js';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function downloadApk(storagePath) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL || 'https://0ec90b57d6e95fcbda19832f.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data, error } = await supabase.storage.from('app-files').download(storagePath);
    if (error || !data) return { success: false, error: error?.message || 'Download failed' };
    const buffer = Buffer.from(await data.arrayBuffer());
    const localDir = join(__dirname, '..', 'downloads');
    mkdirSync(localDir, { recursive: true });
    const localPath = join(localDir, storagePath.split('/').pop());
    writeFileSync(localPath, buffer);
    return { success: true, output: localPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function executeCommand(command) {
  const { command_type, command_data = {}, device_serial } = command;
  if (!command_type) return { success: false, error: 'Missing command_type' };

  const adb = new ADB(device_serial || '');

  switch (command_type) {
    case 'screenshot': {
      const shotResult = await adb.screenshot();
      if (!shotResult.success) return shotResult;
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL || 'https://0ec90b57d6e95fcbda19832f.supabase.co',
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const fileBuffer = readFileSync(shotResult.output);
      const { error: upErr } = await supabase.storage
        .from('screenshots')
        .upload(`${device_serial}.png`, fileBuffer, { upsert: true, contentType: 'image/png' });
      if (upErr) return { success: false, error: `Screenshot taken but upload failed: ${upErr.message}` };
      return { success: true, output: `screenshot://${device_serial}.png` };
    }

    case 'keyevent':
    case 'key': {
      const { keycode } = command_data;
      if (!keycode) return { success: false, error: 'Missing keycode' };
      return await adb.keyevent(keycode);
    }

    case 'tap': {
      const { x, y } = command_data;
      if (x == null || y == null) return { success: false, error: 'Missing x or y' };
      return await adb.tap(x, y);
    }

    case 'swipe': {
      const { x1, y1, x2, y2, duration } = command_data;
      if (x1 == null || y1 == null || x2 == null || y2 == null) return { success: false, error: 'Missing swipe coords' };
      return await adb.swipe(x1, y1, x2, y2, duration || 300);
    }

    case 'install_app': {
      const { apk_path, app_file_id } = command_data;
      if (!apk_path) return { success: false, error: 'Missing apk_path' };
      const downloadResult = await downloadApk(apk_path);
      if (!downloadResult.success) return downloadResult;
      const installResult = await adb.installApp(downloadResult.output);
      if (app_file_id) {
        const status = installResult.success ? 'installed' : 'failed';
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL || 'https://0ec90b57d6e95fcbda19832f.supabase.co',
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        await supabase.from('app_files').update({ status }).eq('id', app_file_id);
      }
      return installResult;
    }

    case 'uninstall_app': {
      const { package_name } = command_data;
      if (!package_name) return { success: false, error: 'Missing package_name' };
      return await adb.uninstallApp(package_name);
    }

    case 'reboot':
    case 'reset':
      return await adb.reboot();

    default:
      return { success: false, error: `Unknown command: ${command_type}` };
  }
}
