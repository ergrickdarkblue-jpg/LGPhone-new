import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ADB {
  constructor(serial = '') {
    this.serial = serial;
  }

  get deviceArg() {
    return this.serial ? `-s ${this.serial}` : '';
  }

  async exec(command) {
    const fullCmd = `adb ${this.deviceArg} ${command}`;
    try {
      const { stdout, stderr } = await execAsync(fullCmd, { timeout: 30000 });
      return { success: true, output: stdout.trim(), error: stderr.trim() };
    } catch (err) {
      return { success: false, output: '', error: err.message };
    }
  }

  async connect(host, port) {
    return this.exec(`connect ${host}:${port}`);
  }

  async devices() {
    try {
      const { stdout } = await execAsync('adb devices', { timeout: 10000 });
      const lines = stdout.trim().split('\n').slice(1);
      return lines
        .filter(l => l.trim() && !l.includes('unauthorized'))
        .map(l => l.split('\t')[0].trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  async tap(x, y) {
    return this.exec(`shell input tap ${x} ${y}`);
  }

  async swipe(x1, y1, x2, y2, duration = 300) {
    return this.exec(`shell input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`);
  }

  async inputText(text) {
    const escaped = text.replace(/'/g, "'\\''").replace(/ /g, '%s');
    return this.exec(`shell input text '${escaped}'`);
  }

  async keyevent(keycode) {
    return this.exec(`shell input keyevent ${keycode}`);
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

  async startApp(packageName) {
    return this.exec(`shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`);
  }

  async stopApp(packageName) {
    return this.exec(`shell am force-stop ${packageName}`);
  }

  async clearData(packageName) {
    return this.exec(`shell pm clear ${packageName}`);
  }

  async installApp(apkPath) {
    return this.exec(`install -r "${apkPath}"`);
  }

  async uninstallApp(packageName) {
    return this.exec(`uninstall ${packageName}`);
  }

  async reboot() {
    return this.exec('reboot');
  }

  async wake() {
    return this.exec('shell input keyevent KEYCODE_WAKEUP');
  }

  async back() {
    return this.exec('shell input keyevent KEYCODE_BACK');
  }

  async home() {
    return this.exec('shell input keyevent KEYCODE_HOME');
  }

  async recents() {
    return this.exec('shell input keyevent KEYCODE_APP_SWITCH');
  }

  async getScreenInfo() {
    return this.exec('shell wm size');
  }

  async getBatteryLevel() {
    return this.exec('shell dumpsys battery | grep level');
  }

  async getProperties() {
    const model = await this.exec('shell getprop ro.product.model');
    const version = await this.exec('shell getprop ro.build.version.release');
    const serial = await this.exec('shell getprop ro.serialno');
    return {
      model: model.output || 'unknown',
      android_version: version.output || 'unknown',
      serial: serial.output || 'unknown',
    };
  }
}
