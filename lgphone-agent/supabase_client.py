"""
Supabase Client Module - LGPhone Agent v3.0

Giao tiếp với Supabase qua 2 API chuẩn của Supabase (không qua Edge Function
lgphone-admin/lgphone-control, vì 2 function đó dành cho thao tác của
người dùng trên giao diện web, không phải cho agent chạy nền):

1. Supabase Auth REST API (/auth/v1/token) - agent tự đăng nhập bằng
   email/password của tài khoản agent riêng, lấy JWT access_token.
2. PostgREST tự sinh (/rest/v1/<table>) - dùng access_token đó để
   đọc/ghi trực tiếp bảng `devices` và `system_settings`, được kiểm
   soát bởi RLS policies (has_permission('can_control') v.v.) đã tạo
   trong migration.

Quy tắc:
- Access token JWT hết hạn sau ~1 giờ - module tự động refresh khi cần,
  không để request thất bại vì token hết hạn mà không xử lý.
- Không bao giờ log access_token/password đầy đủ ra console/file.
"""

import json
import time

import requests

import agent_config
from agent_logger import get_logger

log = get_logger(__name__)

# ====================================================================
# CONSTANTS
# ====================================================================

TOKEN_REFRESH_MARGIN_SECONDS = 60  # Refresh sớm 60s trước khi token thật sự hết hạn
DEFAULT_REQUEST_TIMEOUT = 15


class SupabaseAuthError(Exception):
    """Raised khi đăng nhập Supabase thất bại (sai email/password, mất mạng...)."""
    pass


# ====================================================================
# SUPABASE CLIENT
# ====================================================================

class SupabaseClient:
    """
    Client giao tiếp với Supabase, tự quản lý vòng đời JWT token.

    Attributes:
        config (agent_config.AgentConfig): Cấu hình agent
        access_token (str hoặc None): JWT token hiện tại
        refresh_token (str hoặc None): Refresh token
        token_expires_at (float): Unix timestamp token hết hạn
    """

    def __init__(self, config):
        self.config = config
        self.auth_base_url = f"{config.server_url}/auth/v1"
        self.rest_base_url = f"{config.server_url}/rest/v1"
        self.access_token = None
        self.refresh_token = None
        self.token_expires_at = 0

    # ----------------------------------------------------------------
    # AUTHENTICATION
    # ----------------------------------------------------------------

    def login(self):
        """
        Đăng nhập bằng email/password của tài khoản agent, lấy access_token
        và refresh_token. Gọi 1 lần khi agent khởi động.

        Returns:
            bool: True nếu đăng nhập thành công

        Raises:
            SupabaseAuthError: Nếu đăng nhập thất bại (sai thông tin, lỗi mạng...)
        """
        url = f"{self.auth_base_url}/token?grant_type=password"
        headers = {"apikey": self.config.anon_key, "Content-Type": "application/json"}
        payload = {"email": self.config.agent_email, "password": self.config.agent_password}

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=DEFAULT_REQUEST_TIMEOUT)
        except requests.exceptions.RequestException as e:
            log.error(f"[AUTH] Không thể kết nối tới Supabase để đăng nhập: {e}")
            raise SupabaseAuthError(f"Lỗi kết nối khi đăng nhập: {e}")

        if response.status_code != 200:
            error_detail = self._extract_error(response)
            log.error(f"[AUTH] Đăng nhập thất bại ({response.status_code}): {error_detail}")
            raise SupabaseAuthError(
                f"Đăng nhập thất bại ({response.status_code}): {error_detail}. "
                f"Kiểm tra lại AGENT_EMAIL/AGENT_PASSWORD trong .env."
            )

        data = response.json()
        self._store_tokens(data)
        log.info(f"[AUTH] Đăng nhập thành công với tài khoản {self.config.agent_email}")
        return True

    def _refresh_session(self):
        """
        Làm mới access_token bằng refresh_token, không cần đăng nhập lại
        bằng password.

        Returns:
            bool: True nếu refresh thành công
        """
        if not self.refresh_token:
            log.warning("[AUTH] Không có refresh_token, đăng nhập lại từ đầu")
            return self.login()

        url = f"{self.auth_base_url}/token?grant_type=refresh_token"
        headers = {"apikey": self.config.anon_key, "Content-Type": "application/json"}
        payload = {"refresh_token": self.refresh_token}

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=DEFAULT_REQUEST_TIMEOUT)
        except requests.exceptions.RequestException as e:
            log.error(f"[AUTH] Lỗi kết nối khi refresh token: {e}")
            return False

        if response.status_code != 200:
            log.warning(
                f"[AUTH] Refresh token thất bại ({response.status_code}), thử đăng nhập lại từ đầu"
            )
            try:
                return self.login()
            except SupabaseAuthError:
                return False

        self._store_tokens(response.json())
        log.debug("[AUTH] Refresh token thành công")
        return True

    def _store_tokens(self, token_response):
        """Lưu access_token/refresh_token/thời điểm hết hạn từ response Supabase Auth."""
        self.access_token = token_response.get("access_token")
        self.refresh_token = token_response.get("refresh_token")
        expires_in = token_response.get("expires_in", 3600)
        self.token_expires_at = time.time() + expires_in

    def _ensure_valid_token(self):
        """
        Đảm bảo access_token còn hợp lệ trước khi gọi API, tự refresh nếu
        sắp hết hạn hoặc chưa từng đăng nhập.

        Returns:
            bool: True nếu có token hợp lệ để dùng
        """
        if not self.access_token:
            try:
                return self.login()
            except SupabaseAuthError:
                return False

        if time.time() >= (self.token_expires_at - TOKEN_REFRESH_MARGIN_SECONDS):
            return self._refresh_session()

        return True

    def _auth_headers(self):
        """Header chuẩn cho mọi request PostgREST cần xác thực."""
        return {
            "apikey": self.config.anon_key,
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _extract_error(response):
        """Trích xuất message lỗi từ response Supabase (JSON hoặc text thô)."""
        try:
            data = response.json()
            return data.get("error_description") or data.get("message") or data.get("error") or response.text
        except (ValueError, json.JSONDecodeError):
            return response.text[:200]

    # ----------------------------------------------------------------
    # DEVICES
    # ----------------------------------------------------------------

    def register_or_update_device(self, serial, device_name, device_type, os_version, ip_address, metadata):
        """
        Đăng ký thiết bị mới hoặc cập nhật thiết bị đã tồn tại (upsert theo
        `serial`, dùng header Prefer: resolution=merge-duplicates của PostgREST).

        Args:
            serial: Serial ADB của thiết bị (khoá unique)
            device_name: Tên hiển thị
            device_type: "phone" hoặc "emulator"
            os_version: Chuỗi phiên bản Android, vd "Android 13"
            ip_address: Địa chỉ IP của máy chạy agent
            metadata: dict thông tin bổ sung (brand, model, confidence, fingerprint)

        Returns:
            bool: True nếu thành công
        """
        if not self._ensure_valid_token():
            log.error(f"[DEVICE] Không thể xác thực để đăng ký device {serial}")
            return False

        url = f"{self.rest_base_url}/devices?on_conflict=serial"
        headers = self._auth_headers()
        headers["Prefer"] = "resolution=merge-duplicates,return=minimal"

        payload = {
            "serial": serial,
            "name": device_name or serial,
            "device_type": device_type if device_type in ("phone", "emulator") else "phone",
            "os_version": os_version or "",
            "ip_address": ip_address or "",
            "status": "online",
            "metadata": metadata or {},
        }

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=DEFAULT_REQUEST_TIMEOUT)
        except requests.exceptions.RequestException as e:
            log.error(f"[DEVICE] Lỗi kết nối khi đăng ký {serial}: {e}")
            return False

        if response.status_code in (200, 201, 204):
            log.info(f"[DEVICE] {serial} đăng ký/cập nhật thành công ({device_type}, {os_version})")
            return True

        log.error(f"[DEVICE] Đăng ký {serial} thất bại ({response.status_code}): {self._extract_error(response)}")
        return False

    def send_heartbeat(self, serial):
        """
        Gửi heartbeat - cập nhật status='online' cho thiết bị đã đăng ký.

        Args:
            serial: Serial thiết bị

        Returns:
            bool: True nếu thành công
        """
        if not self._ensure_valid_token():
            log.warning(f"[HEARTBEAT] Không thể xác thực để gửi heartbeat cho {serial}")
            return False

        url = f"{self.rest_base_url}/devices?serial=eq.{serial}"
        headers = self._auth_headers()
        headers["Prefer"] = "return=minimal"
        payload = {"status": "online"}

        try:
            response = requests.patch(url, headers=headers, json=payload, timeout=DEFAULT_REQUEST_TIMEOUT)
        except requests.exceptions.RequestException as e:
            log.warning(f"[HEARTBEAT] Lỗi kết nối cho {serial}: {e}")
            return False

        success = response.status_code in (200, 204)
        if not success:
            log.warning(f"[HEARTBEAT] Thất bại cho {serial} ({response.status_code})")
        return success

    def mark_device_offline(self, serial):
        """
        Đánh dấu thiết bị offline (gọi khi agent dừng lại/mất kết nối thiết bị).

        Args:
            serial: Serial thiết bị

        Returns:
            bool: True nếu thành công
        """
        if not self._ensure_valid_token():
            return False

        url = f"{self.rest_base_url}/devices?serial=eq.{serial}"
        headers = self._auth_headers()
        headers["Prefer"] = "return=minimal"
        payload = {"status": "offline"}

        try:
            response = requests.patch(url, headers=headers, json=payload, timeout=DEFAULT_REQUEST_TIMEOUT)
            return response.status_code in (200, 204)
        except requests.exceptions.RequestException as e:
            log.warning(f"[DEVICE] Lỗi khi đánh dấu offline {serial}: {e}")
            return False

    # ----------------------------------------------------------------
    # COMMANDS (system_settings dùng tạm làm hàng đợi lệnh)
    # ----------------------------------------------------------------

    def get_pending_commands(self, serial):
        """
        Lấy danh sách lệnh đang chờ xử lý cho 1 thiết bị (key có dạng
        "cmd_{serial}_{timestamp}" trong bảng system_settings).

        Args:
            serial: Serial thiết bị

        Returns:
            list[dict]: [{"key": str, "command": str, "args": ..., "timestamp": int}, ...]
                        Danh sách rỗng nếu không có lệnh hoặc lỗi.
        """
        if not self._ensure_valid_token():
            return []

        # PostgREST like filter dùng "*" làm wildcard
        prefix = f"cmd_{serial}_"
        url = f"{self.rest_base_url}/system_settings?key=like.{prefix}*&order=key.asc"
        headers = self._auth_headers()

        try:
            response = requests.get(url, headers=headers, timeout=DEFAULT_REQUEST_TIMEOUT)
        except requests.exceptions.RequestException as e:
            log.error(f"[POLL] Lỗi kết nối khi lấy lệnh cho {serial}: {e}")
            return []

        if response.status_code != 200:
            log.error(f"[POLL] Lấy lệnh thất bại cho {serial} ({response.status_code})")
            return []

        rows = response.json()
        commands = []
        for row in rows:
            try:
                value_data = json.loads(row["value"])
                commands.append({
                    "key": row["key"],
                    "command": value_data.get("command", ""),
                    "args": value_data.get("args", {}),
                    "timestamp": value_data.get("timestamp", 0),
                })
            except (json.JSONDecodeError, KeyError, TypeError) as e:
                log.warning(f"[POLL] Bỏ qua lệnh không hợp lệ (key={row.get('key')}): {e}")

        return commands

    def delete_command(self, key):
        """
        Xoá 1 lệnh khỏi hàng đợi sau khi đã thực thi xong (system_settings
        không có cột status nên dùng cách xoá thay vì đánh dấu "done").

        Args:
            key: Key của dòng cần xoá trong system_settings

        Returns:
            bool: True nếu xoá thành công
        """
        if not self._ensure_valid_token():
            return False

        url = f"{self.rest_base_url}/system_settings?key=eq.{key}"
        headers = self._auth_headers()
        headers["Prefer"] = "return=minimal"

        try:
            response = requests.delete(url, headers=headers, timeout=DEFAULT_REQUEST_TIMEOUT)
            success = response.status_code in (200, 204)
            if not success:
                log.warning(f"[POLL] Xoá lệnh {key} thất bại ({response.status_code})")
            return success
        except requests.exceptions.RequestException as e:
            log.warning(f"[POLL] Lỗi kết nối khi xoá lệnh {key}: {e}")
            return False


if __name__ == "__main__":
    """Test supabase_client khi chạy trực tiếp (cần .env đã cấu hình đúng)."""
    print("\n" + "=" * 70)
    print("LGPhone Agent - Supabase Client Test")
    print("=" * 70 + "\n")

    try:
        cfg = agent_config.get_config()
    except agent_config.ConfigError as e:
        print(f"✗ Config lỗi, không thể test: {e}")
        raise SystemExit(1)

    client = SupabaseClient(cfg)

    print("Đăng nhập...")
    try:
        client.login()
        print(f"  ✓ Đăng nhập thành công, token hết hạn sau {cfg.__dict__.get('token_expires_at', 0)}")
    except SupabaseAuthError as e:
        print(f"  ✗ {e}")
        raise SystemExit(1)

    print("\nĐăng ký thử 1 thiết bị test...")
    success = client.register_or_update_device(
        serial="test-serial-001",
        device_name="Test Device",
        device_type="emulator",
        os_version="Android 13",
        ip_address="127.0.0.1",
        metadata={"brand": "Test", "confidence": 90},
    )
    print(f"  {'✓' if success else '✗'} Register device: {success}")

    print("\nGửi heartbeat...")
    hb_success = client.send_heartbeat("test-serial-001")
    print(f"  {'✓' if hb_success else '✗'} Heartbeat: {hb_success}")

    print("\nLấy danh sách lệnh đang chờ...")
    commands = client.get_pending_commands("test-serial-001")
    print(f"  Tìm thấy {len(commands)} lệnh: {commands}")

    print("\n" + "=" * 70 + "\n")
