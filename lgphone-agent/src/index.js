import { createClient } from '@supabase/supabase-js';
import { ADB } from './adb.js';
import { executeCommand } from './command-handler.js';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env file
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
  console.error('======================================================');
  console.error('  THIẾU SUPABASE_SERVICE_ROLE_KEY');
  console.error('======================================================');
  console.error('  Agent can service_role key de cap nhat trang thai lenh.');
  console.error('');
  console.error('  Cach lay key:');
  console.error('  1. Mo file .env bang Notepad');
  console.error('  2. Vao https://supabase.com/dashboard/project/');
  console.error('     nyuvpiztruwdmvogtwpz/settings/api');
  console.error('  3. Tim "service_role" -> Reveal -> Copy');
  console.error('  4. Dan vao file .env');
  console.error('======================================================');
  console.error('');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const adb = new ADB();

console.log('');
console.log('==============================================');
console.log('  LGPhone Agent Tool v1.0.0');
console.log('==============================================');
console.log(`  Supabase: ${SUPABASE_URL}`);
console.log('==============================================');
console.log('');

const connectedDevices = new Set();

async function scanDevices() {
  const serials = await adb.devices();
  for (const serial of serials) {
    if (!connectedDevices.has(serial)) {
      connectedDevices.add(serial);
      console.log(`[DEVICE+] ${serial}`);
      const deviceAdb = new ADB(serial);
      const props = await deviceAdb.getProperties();
      console.log(`  Model: ${props.model}, Android: ${props.android_version}`);
      // Auto-register device in Supabase (upsert by serial)
      const { error: upsertErr } = await supabase.from('devices').upsert({
        serial,
        name: props.model || serial,
        model: props.model || null,
        android_version: props.android_version || null,
        status: 'online',
        last_seen: new Date().toISOString(),
      }, { onConflict: 'serial' });
      if (upsertErr) console.log(`  [WARN] upsert failed: ${upsertErr.message}`);
    } else {
      // Update last_seen for already connected devices
      await supabase.from('devices').update({ last_seen: new Date().toISOString() }).eq('serial', serial);
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
  console.log(`\n[COMMAND] ${command_type} -> ${device_serial} (id: ${id})`);
  await supabase.from('device_commands').update({ status: 'running', executed_at: new Date().toISOString() }).eq('id', id);
  try {
    const result = await executeCommand(command);
    if (result.success) {
      console.log(`  OK: ${result.output || 'Success'}`);
      await supabase.from('device_commands').update({ status: 'completed', result: result.output || 'Success', completed_at: new Date().toISOString() }).eq('id', id);
    } else {
      console.log(`  FAIL: ${result.error}`);
      await supabase.from('device_commands').update({ status: 'failed', result: result.error, completed_at: new Date().toISOString() }).eq('id', id);
    }
  } catch (err) {
    console.log(`  FAIL: ${err.message}`);
    await supabase.from('device_commands').update({ status: 'failed', result: err.message, completed_at: new Date().toISOString() }).eq('id', id);
  }
}

async function pollCommands() {
  const { data: commands, error } = await supabase.from('device_commands').select('*').eq('status', 'pending').order('priority', { ascending: true }).order('created_at', { ascending: true }).limit(10);
  if (error) { console.error('[POLL]', error.message); return; }
  if (commands && commands.length > 0) {
    for (const cmd of commands) {
      if (!connectedDevices.has(cmd.device_serial)) {
        console.log(`[SKIP] ${cmd.device_serial} not connected`);
        await supabase.from('device_commands').update({ status: 'failed', result: 'Device not connected', completed_at: new Date().toISOString() }).eq('id', cmd.id);
        continue;
      }
      await processCommand(cmd);
    }
  }
}

async function main() {
  console.log('[START] Quet thiet bi ADB...\n');
  await scanDevices();
  console.log('\n[START] Lang nghe lenh tu web app...\n');

  supabase
    .channel('device_commands')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'device_commands' }, async (payload) => {
      const cmd = payload.new;
      if (cmd.status === 'pending') {
        if (connectedDevices.has(cmd.device_serial)) {
          await processCommand(cmd);
        } else {
          console.log(`[REALTIME] ${cmd.id} -> ${cmd.device_serial} chua ket noi`);
          await supabase.from('device_commands').update({ status: 'failed', result: 'Device not connected', completed_at: new Date().toISOString() }).eq('id', cmd.id);
        }
      }
    })
    .subscribe();

  setInterval(pollCommands, 5000);
  setInterval(scanDevices, 10000);

  process.on('SIGINT', async () => {
    console.log('\n[SHUTDOWN] Dat tat ca thiet bi offline...');
    for (const serial of connectedDevices) {
      await supabase.from('devices').update({ status: 'offline' }).eq('serial', serial);
    }
    console.log('[SHUTDOWN] Done.');
    process.exit(0);
  });

  console.log('[READY] Agent dang chay. Nhan Ctrl+C de dung.\n');
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });
