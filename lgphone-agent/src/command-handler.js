import { ADB } from './adb.js';

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
    case 'keyevent': {
      const { keycode } = command_data;
      if (!keycode) return { success: false, error: 'Missing keycode' };
      return await adb.keyevent(keycode);
    }
    case 'screenshot':
      return await adb.screenshot();
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
      const { apk_path } = command_data;
      if (!apk_path) return { success: false, error: 'Missing apk_path' };
      return await adb.installApp(apk_path);
    }
    case 'uninstall_app': {
      const { package: pkg } = command_data;
      if (!pkg) return { success: false, error: 'Missing package name' };
      return await adb.uninstallApp(pkg);
    }
    case 'reboot':
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
