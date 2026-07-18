import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ADB {
  constructor(serial = '') {
    this.serial = serial;
  }

  serial: string;

  private cmd(parts: string) {
    const s = this.serial ? `-s ${this.serial}` : '';
    return `adb ${s} ${parts}`;
  }

  async exec(parts: string, timeout = 30000) {
    try {
      const { stdout } = await execAsync(this.cmd(parts), { timeout });
      return { success: true, output: stdout.trim(), error: '' };
    } catch (err: any) {
      return { success: false, output: '', error: err.stderr || err.message };
    }
  }

  async devices() {
    const result = await this.exec('devices');
    if (!result.success) return [];
    return result.output.split('\n').slice(1).map(l => l.split('\t')[0]).filter(s => s && !s.includes('offline'));
  }

  async getProperties() {
    const result = await this.exec('shell getprop');
    const props: Record<string, string> = {};
    if (result.success) {
      for (const line of result.output.split('\n')) {
        const m = line.match(/\[([^\]]+)\]:\s*\[([^\]]*)\]/);
        if (m) props[m[1]] = m[2];
      }
    }
    return {
      model: props['ro.product.model'] || '',
      android_version: props['ro.build.version.release'] || '',
      serial: this.serial,
      sdk: props['ro.build.version.sdk'] || '',
    };
  }

  async keyevent(keycode: number | string) {
    return await this.exec(`shell input keyevent ${keycode}`);
  }

  async tap(x: number, y: number) {
    return await this.exec(`shell input tap ${x} ${y}`);
  }

  async swipe(x1: number, y1: number, x2: number, y2: number, duration = 300) {
    return await this.exec(`shell input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`);
  }

  async screenshot() {
    const remotePath = `/sdcard/lg_screen.png`;
    const localPath = `./screenshots/${this.serial || 'default'}.png`;
    const fs = await import('fs');
    fs.mkdirSync('./screenshots', { recursive: true });
    const shotResult = await this.exec(`shell screencap -p ${remotePath}`);
    if (!shotResult.success) return shotResult;
    const pullResult = await this.exec(`pull ${remotePath} ${localPath}`);
    await this.exec(`shell rm ${remotePath}`);
    if (!pullResult.success) return pullResult;
    return { success: true, output: localPath, error: '' };
  }

  async installApp(apkPath: string) {
    return await this.exec(`install -r ${apkPath}`, 120000);
  }

  async uninstallApp(pkg: string) {
    return await this.exec(`uninstall ${pkg}`);
  }

  async reboot() {
    return await this.exec('reboot');
  }
}
