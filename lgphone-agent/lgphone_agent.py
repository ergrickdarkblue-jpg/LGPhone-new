#!/usr/bin/env python3
"""
LGPhone Agent v2.0 - Bridge giữa web LGPhone và thiết bị Android qua ADB.

Tính năng:
  - Auto-tìm đường dẫn ADB (PATH, Android SDK, hoặc tải về tự động)
  - Phát hiện thiết bị thật và máy ảo (emulator) - KHÔNG tạo máy giả
  - Real-time screen capture & upload lên Supabase Storage
  - Polling lệnh điều khiển từ Supabase (home, back, power, reboot, screenshot...)
  - Cài đặt/gỡ ứng dụng APK
  - Reset máy (xóa tất cả ứng dụng người dùng, giữ lại app hệ thống)
  - Đồng bộ trạng thái thiết bị lên Supabase

Cách dùng:
  python lgphone_agent.py

Hoặc tạo file .env:
  SUPABASE_URL=https://...
  SUPABASE_ANON_KEY=eyJ...
  SUPABASE_SERVICE_ROLE_KEY=eyJ...
"""

import os
import sys
import json
import time
import shutil
import subprocess
import platform
import urllib.request
import zipfile
import tempfile
import signal
import base64
from pathlib import Path

try:
    import requests
except ImportError:
    print("[!] Đang cài requests...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ─── CẤU HÌNH ───────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or ""
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY") or ""
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY") or ""

POLL_INTERVAL = 2
SCREENSHOT_INTERVAL = 3  # giây - real-time screen update

# ─── AUTO-TÌM ADB ────────────────────────────────────────────
def find_adb():
    adb = shutil.which("adb")
    if adb:
        print(f"[+] Tìm thấy ADB trong PATH: {adb}")
        return adb

    candidates = []
    system = platform.system()
    if system == "Windows":
        candidates = [
            os.path.join(os.environ.get("USERPROFILE", ""), "AppData", "Local", "Android", "Sdk", "platform-tools", "adb.exe"),
            os.path.join(os.environ.get("LOCALAPPDATA", ""), "Android", "Sdk", "platform-tools", "adb.exe"),
        ]
    elif system == "Darwin":
        candidates = [os.path.expanduser("~/Library/Android/sdk/platform-tools/adb"), "/usr/local/bin/adb", "/opt/homebrew/bin/adb"]
    else:
        candidates = [os.path.expanduser("~/Android/Sdk/platform-tools/adb"), "/usr/local/bin/adb", "/usr/bin/adb"]

    for c in candidates:
        if os.path.isfile(c) and os.access(c, os.X_OK):
            print(f"[+] Tìm thấy ADB tại: {c}")
            return c

    print("[!] Không tìm thấy ADB. Đang tải tự động...")
    return download_platform_tools()

def download_platform_tools():
    system = platform.system()
    if system == "Windows":
        url = "https://dl.google.com/android/repository/platform-tools-latest-windows.zip"
    elif system == "Darwin":
        url = "https://dl.google.com/android/repository/platform-tools-latest-darwin.zip"
    else:
        url = "https://dl.google.com/android/repository/platform-tools-latest-linux.zip"

    target_dir = os.path.join(tempfile.gettempdir(), "lgphone-platform-tools")
    zip_path = os.path.join(tempfile.gettempdir(), "platform-tools.zip")

    print(f"[*] Đang tải từ: {url}")
    try:
        urllib.request.urlretrieve(url, zip_path)
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(target_dir)
        adb_name = "adb.exe" if system == "Windows" else "adb"
        adb_path = os.path.join(target_dir, "platform-tools", adb_name)
        if system != "Windows":
            os.chmod(adb_path, 0o755)
        print(f"[+] ADB đã sẵn sàng tại: {adb_path}")
        return adb_path
    except Exception as e:
        print(f"[LỖI] Không thể tải ADB: {e}")
        sys.exit(1)

# ─── ADB WRAPPER ─────────────────────────────────────────────
class ADB:
    def __init__(self, adb_path):
        self.adb_path = adb_path
        self.start_server()

    def _run(self, args, timeout=30):
        cmd = [self.adb_path] + args
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
            return result.returncode, result.stdout.strip(), result.stderr.strip()
        except subprocess.TimeoutExpired:
            return -1, "", "Timeout"
        except Exception as e:
            return -1, "", str(e)

    def start_server(self):
        print("[*] Khởi động ADB server...")
        self._run(["start-server"])
        print("[+] ADB server đã khởi động")

    def get_devices(self):
        code, out, _ = self._run(["devices"])
        devices = []
        if code == 0 and out:
            for line in out.split("\n")[1:]:
                line = line.strip()
                if not line or "List of devices" in line:
                    continue
                parts = line.split("\t")
                if len(parts) >= 2:
                    serial = parts[0]
                    state = parts[1]
                    is_emulator = "emulator" in serial
                    devices.append({"serial": serial, "state": state, "is_emulator": is_emulator})
        return devices

    def get_device_info(self, serial):
        info = {"model": "", "android_version": ""}
        code, model, _ = self._run(["-s", serial, "shell", "getprop", "ro.product.model"])
        if code == 0: info["model"] = model
        code, ver, _ = self._run(["-s", serial, "shell", "getprop", "ro.build.version.release"])
        if code == 0: info["android_version"] = ver
        return info

    def send_key(self, serial, keycode):
        code, _, _ = self._run(["-s", serial, "shell", "input", "keyevent", str(keycode)])
        return code == 0

    def tap(self, serial, x, y):
        code, _, _ = self._run(["-s", serial, "shell", "input", "tap", str(x), str(y)])
        return code == 0

    def swipe(self, serial, x1, y1, x2, y2, duration=300):
        code, _, _ = self._run(["-s", serial, "shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(duration)])
        return code == 0

    def screenshot(self, serial, output_path):
        code, _, _ = self._run(["-s", serial, "shell", "screencap", "-p", "/sdcard/lgphone_screen.png"])
        if code != 0: return False
        code, _, _ = self._run(["-s", serial, "pull", "/sdcard/lgphone_screen.png", output_path])
        return code == 0

    def install_apk(self, serial, apk_path):
        code, out, err = self._run(["-s", serial, "install", "-r", apk_path], timeout=120)
        return code == 0, out or err

    def uninstall_package(self, serial, package_name):
        code, out, _ = self._run(["-s", serial, "uninstall", package_name])
        return code == 0, out

    def list_user_packages(self, serial):
        code, out, _ = self._run(["-s", serial, "shell", "pm", "list", "packages", "-3"])
        if code == 0 and out:
            return [line.replace("package:", "").strip() for line in out.split("\n") if line.startswith("package:")]
        return []

    def reset_device(self, serial):
        """Xóa tất cả ứng dụng người dùng, giữ lại app hệ thống."""
        packages = self.list_user_packages(serial)
        count = 0
        for pkg in packages:
            code, _ = self.uninstall_package(serial, pkg)
            if code: count += 1
            time.sleep(0.2)
        return count

    def reboot(self, serial):
        code, _, _ = self._run(["-s", serial, "reboot"])
        return code == 0

# ─── SUPABASE CLIENT ──────────────────────────────────────────
class SupabaseClient:
    def __init__(self, url, anon_key, service_key):
        self.url = url.rstrip("/")
        self.service_key = service_key or anon_key
        self.headers = {"apikey": self.service_key, "Authorization": f"Bearer {self.service_key}", "Content-Type": "application/json"}

    def get_pending_commands(self):
        r = requests.get(f"{self.url}/rest/v1/system_settings?select=key,value&key=like=cmd_*", headers=self.headers, timeout=10)
        return r.json() if r.status_code == 200 else []

    def delete_command(self, key):
        requests.delete(f"{self.url}/rest/v1/system_settings?key=eq.{key}", headers={**self.headers, "Prefer": "return=minimal"}, timeout=10)

    def upsert_device(self, device_data):
        r = requests.get(f"{self.url}/rest/v1/devices?select=id&serial=eq.{device_data['serial']}", headers=self.headers, timeout=10)
        existing = r.json() if r.status_code == 200 else []
        if existing:
            requests.patch(f"{self.url}/rest/v1/devices?serial=eq.{device_data['serial']}", headers=self.headers, json=device_data, timeout=10)
        else:
            requests.post(f"{self.url}/rest/v1/devices", headers=self.headers, json=device_data, timeout=10)

    def update_device_status(self, serial, status):
        requests.patch(f"{self.url}/rest/v1/devices?serial=eq.{serial}", headers=self.headers, json={"status": status}, timeout=10)

    def upload_screenshot(self, serial, image_path):
        """Upload screenshot lên Supabase Storage (public bucket 'screenshots')."""
        try:
            with open(image_path, "rb") as f:
                files = {"file": f}
                headers = {"apikey": self.service_key, "Authorization": f"Bearer {self.service_key}", "x-upsert": "true", "Content-Type": "image/png"}
                requests.post(f"{self.url}/storage/v1/object/public/screenshots/{serial}.png", headers=headers, data=f, timeout=15)
        except Exception as e:
            print(f"  [!] Lỗi upload screenshot: {e}")

# ─── KEY MAP ─────────────────────────────────────────────────
KEY_MAP = {"3": 3, "4": 4, "26": 26, "24": 24, "25": 25, "187": 187}

# ─── MAIN AGENT ──────────────────────────────────────────────
class LGPhoneAgent:
    def __init__(self):
        print("=" * 60)
        print("  LGPhone Agent v2.0 - Phone Farm Bridge")
        print("=" * 60)
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            print("[LỖI] Thiếu cấu hình Supabase! Tạo file .env.")
            sys.exit(1)
        self.adb_path = find_adb()
        self.adb = ADB(self.adb_path)
        self.sb = SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY)
        self.running = True
        self.known_devices = set()
        self.screen_timers = {}
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        print(f"[+] Supabase: {SUPABASE_URL}")
        print(f"[+] ADB: {self.adb_path}")
        print("[*] Agent đang chạy... Ctrl+C để dừng.\n")

    def _signal_handler(self, signum, frame):
        print("\n[*] Đang dừng agent...")
        self.running = False

    def sync_devices(self):
        """Đồng bộ danh sách thiết bị THẬT với DB - không tạo máy giả."""
        devices = self.adb.get_devices()
        current_serials = set()
        for d in devices:
            serial = d["serial"]
            current_serials.add(serial)
            is_online = d["state"] == "device"
            info = self.adb.get_device_info(serial) if is_online else {}
            device_data = {
                "name": f"Emulator-{serial}" if d["is_emulator"] else f"Phone-{serial[:8]}",
                "serial": serial,
                "model": info.get("model", ""),
                "android_version": info.get("android_version", ""),
                "status": "online" if is_online else "offline",
                "vm_id": serial if d["is_emulator"] else None,
            }
            self.sb.upsert_device(device_data)
            if serial not in self.known_devices:
                print(f"[+] Thiết bị mới: {serial} ({'emulator' if d['is_emulator'] else 'thật'}) - {info.get('model', '?')}")
                self.known_devices.add(serial)
        for serial in self.known_devices - current_serials:
            self.sb.update_device_status(serial, "offline")
            print(f"[-] Thiết bị rời đi: {serial}")
        self.known_devices = current_serials

    def stream_screens(self):
        """Real-time screen capture cho thiết bị online."""
        for serial in self.known_devices:
            last = self.screen_timers.get(serial, 0)
            if time.time() - last < SCREENSHOT_INTERVAL:
                continue
            self.screen_timers[serial] = time.time()
            tmp = os.path.join(tempfile.gettempdir(), f"lgphone_{serial}.png")
            if self.adb.screenshot(serial, tmp):
                self.sb.upload_screenshot(serial, tmp)

    def process_commands(self):
        commands = self.sb.get_pending_commands()
        for cmd_entry in commands:
            key = cmd_entry["key"]
            try:
                cmd_data = json.loads(cmd_entry["value"])
                parts = key.split("_", 2)
                serial = parts[1] if len(parts) > 1 else ""
                command = cmd_data.get("command", "")
                args = cmd_data.get("args", "")
                print(f"[CMD] {serial}: {command} {args}")
                if command == "key" and args in KEY_MAP:
                    self.adb.send_key(serial, KEY_MAP[args])
                elif command == "screenshot":
                    tmp = os.path.join(tempfile.gettempdir(), f"lgphone_{serial}.png")
                    if self.adb.screenshot(serial, tmp):
                        self.sb.upload_screenshot(serial, tmp)
                elif command == "reboot":
                    self.adb.reboot(serial)
                elif command == "reset":
                    count = self.adb.reset_device(serial)
                    print(f"  -> Reset xong: xóa {count} ứng dụng người dùng")
                elif command == "install":
                    self.adb.install_apk(serial, args)
                elif command == "uninstall":
                    self.adb.uninstall_package(serial, args)
                elif command == "tap":
                    coords = args.split(",")
                    if len(coords) == 2: self.adb.tap(serial, int(coords[0]), int(coords[1]))
                elif command == "swipe":
                    coords = args.split(",")
                    if len(coords) >= 4: self.adb.swipe(serial, int(coords[0]), int(coords[1]), int(coords[2]), int(coords[3]))
            except Exception as e:
                print(f"  [!] Lỗi: {e}")
            finally:
                self.sb.delete_command(key)

    def run(self):
        while self.running:
            try:
                self.sync_devices()
                self.process_commands()
                self.stream_screens()
            except Exception as e:
                print(f"[!] Lỗi vòng lặp: {e}")
            time.sleep(POLL_INTERVAL)
        print("[*] Agent đã dừng.")

if __name__ == "__main__":
    agent = LGPhoneAgent()
    agent.run()
