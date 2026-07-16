import { createClient } from '@supabase/supabase-js';
import { ADB } from './adb.js';
import { executeCommand } from './command-handler.js';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env file if it exists ──
const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').replace(/^["']|["']$/g, '');
    if (key && value && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nyuvpiztruwdmvogtwpz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY === 'PASTE_YOUR_SERVICE_ROLE_KEY_HERE') {
  console.error('');
  console.error('╔══════════════════════════════════════════════════════════════╗');
  console.error('║  THIẾU SUPABASE_SERVICE_ROLE_KEY                            ║');
  console.error('╠══════════════════════════════════════════════════════════════╣');
  console.error('║  Agent cần service_role key để cập nhật trạng thái lệnh.      ║');
  console.error('║                                                              ║');
  console.error('║  Cách 1: Tạo file .env                                        ║');
  console.error('║    cp .env.example .env                                       ║');
  console.error('║    Mở .env và dán service_role key vào                        ║');
  console.error('║                                                              ║');
  console.error('║  Cách 2: Set biến môi trường                                  ║');
  console.error('║    export SUPABASE_SERVICE_ROLE_KEY=your-key-here             ║');
  console.error('║                                                              ║');
  console.error('║  Lấy key từ:                                                  ║');
  console.error('║  https://supabase.com/dashboard/project/                      ║');
  console.error('║  nyuvpiztruwdmvogtwpz/settings/api                            ║');
  console.error('║  → Mục "service_role" → Reveal → Copy                         ║');
  console.error('╚══════════════════════════════════════════════════════════════╝');
  console.error('');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const adb = new ADB();

console.log('');
console.log('══════════════════════════════════════════════');
console.log('  LGPhone Agent Tool v1.0.0');
console.log('══════════════════════════════════════════════');
console.log(`  Supabase: ${SUPABASE_URL}`);
console.log(`  Key: ${SUPABASE_SERVICE_KEY.substring(0, 20)}...`);
console.log('══════════════════════════════════════════════');
console.log('');

const connectedDevices = new Set();

async function scanDevices() {
  const serials = await adb.devices();
  for (const serial of serials) {
    if (!connectedDevices.has(serial)) {
      connectedDevices.add(serial);
      console.log(`[DEVICE+] ${serial}`);
      const props = await new ADB(serial).getProperties();
      console.log(`  Model: ${props.model}, Android: ${props.android_version}`);
      const { error } = await supabase.from('devices').update({ status: 'online' }).eq('serial', serial);
      if (error) console.log(`  (Chưa đăng ký trong database. Thêm qua web app.)`);
      else console.log(`  → Đã cập nhật trạng thái online`);
    }
  }
  for (const serial of [...connectedDevices]) {
    if (!serials.includes(serial)) {
      connectedDevices.delete(serial);
      console.log(`[DEVICE-] ${serial}`);
      await supabase.from('devices').update({ status: 'offline' }).eq('serial', serial);
    }
  }
  return serials;
}

async function processCommand(command) {
  const { id, command_type, command_data, device_serial } = command;
  console.log(`\n[COMMAND] ${command_type} → ${device_serial} (id: ${id})`);
  await supabase.from('device_commands').update({ status: 'running', executed_at: new Date().toISOString() }).eq('id', id);
  try {
    const result = await executeCommand(command);
    if (result.success) {
      console.log(`  ✅ ${result.output || 'Success'}`);
      await supabase.from('device_commands').update({ status: 'completed', result: result.output || 'Success', completed_at: new Date().toISOString() }).eq('id', id);
    } else {
      console.log(`  ❌ ${result.error}`);
      await supabase.from('device_commands').update({ status: 'failed', result: result.error, completed_at: new Date().toISOString() }).eq('id', id);
    }
  } catch (err) {
    console.log(`  ❌ ${err.message}`);
    await supabase.from('device_commands').update({ status: 'failed', result: err.message, completed_at: new Date().toISOString() }).eq('id', id);
  }
}

async function pollCommands() {
  const { data: commands, error } = await supabase.from('device_commands').select('*').eq('status', 'pending').order('priority', { ascending: true }).order('created_at', { ascending: true }).limit(10);
  if (error) { console.error('[POLL]', error.message); return; }
  if (commands && commands.length > 0) {
    for (const cmd of commands) {
      if (!connectedDevices.has(cmd.device_serial)) {
        console.log(`[SKIP] ${cmd.device_serial} not connected — failing command ${cmd.id}`);
        await supabase.from('device_commands').update({ status: 'failed', result: `Device not connected`, completed_at: new Date().toISOString() }).eq('id', cmd.id);
        continue;
      }
      await processCommand(cmd);
    }
  }
}

async function updateDeviceStatuses() {
  const { data: dbDevices } = await supabase.from('devices').select('serial,status');
  if (dbDevices) {
    for (const dev of dbDevices) {
      const isOnline = connectedDevices.has(dev.serial);
      if ((dev.status === 'online') !== isOnline) {
        await supabase.from('devices').update({ status: isOnline ? 'online' : 'offline' }).eq('serial', dev.serial);
      }
    }
  }
}

async function main() {
  console.log('[START] Quét thiết bị ADB...\n');
  await scanDevices();
  console.log('\n[START] Lắng nghe lệnh từ web app...\n');

  supabase
    .channel('device_commands')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'device_commands' }, async (payload) => {
      const cmd = payload.new;
      if (cmd.status === 'pending') {
        if (connectedDevices.has(cmd.device_serial)) {
          await processCommand(cmd);
        } else {
          console.log(`[REALTIME] ${cmd.id} → ${cmd.device_serial} chưa kết nối`);
          await supabase.from('device_commands').update({ status: 'failed', result: `Device not connected`, completed_at: new Date().toISOString() }).eq('id', cmd.id);
        }
      }
    })
    .subscribe();

  setInterval(pollCommands, 5000);
  setInterval(async () => { await scanDevices(); await updateDeviceStatuses(); }, 10000);

  process.on('SIGINT', async () => {
    console.log('\n[SHUTDOWN] Đặt tất cả thiết bị offline...');
    for (const serial of connectedDevices) {
      await supabase.from('devices').update({ status: 'offline' }).eq('serial', serial);
    }
    console.log('[SHUTDOWN] Done.');
    process.exit(0);
  });

  console.log('[READY] Agent đang chạy. Nhấn Ctrl+C để dừng.\n');
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });
