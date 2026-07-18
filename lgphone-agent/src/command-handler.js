import { ADB } from './adb.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function downloadApk(storagePath) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL || 'https://nyuvpiztruwdmvogtwpz.supabase.co',
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
  const { command_type, command_data, device_serial } = command;
  const adb = new ADB(device_serial);

  console.log(`[CMD] ${command_type} on ${device_serial}`, command_data);

  switch (command_type) {
    case 'tap': {
      const { x, y } = command_data;
      if (x == null || y == null) return { success: false, error: 'Missing x or y' };
      return await adb.tap(x, y);
    }
    case 'swipe': {
      const { x1, y1, x2, y2, duration = 300 } = command_data;
      if ([x1, y1, x2, y2].some(v => v == null)) return { success: false, error: 'Missing coordinates' };
      return await adb.swipe(x1, y1, x2, y2, duration);
    }
    case 'input_text': {
      const { text } = command_data;
      if (!text) return { success: false, error: 'Missing text' };
      return await adb.inputText(text);
    }
    case 'keyevent':
    case 'key': {
      const { keycode } = command_data;
      if (!keycode) return { success: false, error: 'Missing keycode' };
      return await adb.keyevent(keycode);
    }
    case 'screenshot': {
      const shotResult = await adb.screenshot();
      if (!shotResult.success) return shotResult;
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL || 'https://nyuvpiztruwdmvogtwpz.supabase.co',
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      const { readFileSync } = await import('fs');
      const fileBuffer = readFileSync(shotResult.output);
      const { error: upErr } = await supabase.storage
        .from('screenshots')
        .upload(`${device_serial}.png`, fileBuffer, { upsert: true, contentType: 'image/png' });
      if (upErr) return { success: false, error: `Screenshot taken but upload failed: ${upErr.message}` };
      return { success: true, output: `screenshot://${device_serial}.png` };
    }
    case 'start_app': {
      const { package: pkg } = command_data;
      if (!pkg) return { success: false, error: 'Missing package name' };
      return await adb.startApp(pkg);
    }
    case 'stop_app': {
      const { package: pkg } = command_data;
      if (!pkg) return { success: false, error: 'Missing package name' };
      return await adb.stopApp(pkg);
    }
    case 'clear_data': {
      const { package: pkg } = command_data;
      if (!pkg) return { success: false, error: 'Missing package name' };
      return await adb.clearData(pkg);
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
          process.env.SUPABASE_URL || 'https://nyuvpiztruwdmvogtwpz.supabase.co',
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        await supabase.from('app_files').update({ status }).eq('id', app_file_id);
      }
      return installResult;
    }
    case 'uninstall_app': {
      const { package: pkg } = command_data;
      if (!pkg) return { success: false, error: 'Missing package name' };
      return await adb.uninstallApp(pkg);
    }
    case 'reboot':
    case 'reset':
      return await adb.reboot();
    case 'wake':
      return await adb.wake();
    case 'back':
      return await adb.back();
    case 'home':
      return await adb.home();
    case 'recents':
      return await adb.recents();
    case 'script': {
      const { script } = command_data;
      if (!script) return { success: false, error: 'Missing script' };
      let steps;
      try {
        steps = typeof script === 'string' ? JSON.parse(script) : script;
      } catch {
        return { success: false, error: 'Invalid script JSON' };
      }
      if (!Array.isArray(steps)) return { success: false, error: 'Script must be an array' };
      const results = [];
      for (const step of steps) {
        const stepResult = await executeCommand({ command_type: step.action, command_data: step, device_serial });
        results.push({ step, result: stepResult });
        if (!stepResult.success) break;
        if (step.wait) await new Promise(r => setTimeout(r, step.wait));
        if (step.ms) await new Promise(r => setTimeout(r, step.ms));
      }
      const allSuccess = results.every(r => r.result.success);
      return { success: allSuccess, output: JSON.stringify(results), error: allSuccess ? '' : 'Some steps failed' };
    }
    default:
      return { success: false, error: `Unknown command type: ${command_type}` };
  }
}
