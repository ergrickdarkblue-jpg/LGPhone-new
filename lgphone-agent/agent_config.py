"""
Agent Config Module - LGPhone Agent v3.0

Quản lý toàn bộ cấu hình cho agent: đường dẫn, timeout, thông tin kết nối
Supabase (server URL, anon key). Mọi module khác trong python-agent phải
import từ đây, không tự đọc file .env hay hardcode giá trị riêng.

Quy tắc bảo mật:
- KHÔNG hardcode SERVER_URL/ANON_KEY mặc định trong code.
- Bắt buộc phải có file .env hợp lệ (agent tự tạo template ở lần chạy đầu
  và yêu cầu người dùng điền vào), nếu không sẽ raise ConfigError rõ ràng
  và dừng lại - không tự ý dùng giá trị ngầm định nào cho secret.
"""

from pathlib import Path

# ====================================================================
# BASE PATHS
# ====================================================================

BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"
LOG_DIR = BASE_DIR / "logs"
TEMP_DIR = BASE_DIR / "temp"

# ====================================================================
# NON-SECRET DEFAULTS (an toàn để đặt mặc định - không phải secret)
# ====================================================================

DEFAULT_AGENT_ID = "agent-01"
DEFAULT_ADB_PATH = "adb"
DEFAULT_POLL_INTERVAL_SECONDS = 2
DEFAULT_HEARTBEAT_INTERVAL_SECONDS = 10
DEFAULT_ADB_COMMAND_TIMEOUT = 15
DEFAULT_ADB_DEVICES_TIMEOUT = 10
DEFAULT_SCREENSHOT_TIMEOUT = 20
DEFAULT_UPLOAD_TIMEOUT = 30

# Placeholder dùng trong .env template - agent sẽ từ chối chạy nếu giá trị
# thật vẫn còn giữ nguyên là placeholder này.
PLACEHOLDER_SERVER_URL = "https://your-project.supabase.co"
PLACEHOLDER_ANON_KEY = "your-supabase-anon-key-here"

ENV_TEMPLATE = f"""# LGPhone Agent - Cau hinh ket noi Supabase
# Lay 2 gia tri nay trong Supabase Dashboard -> Settings -> API
SERVER_URL={PLACEHOLDER_SERVER_URL}
ANON_KEY={PLACEHOLDER_ANON_KEY}
AGENT_ID={DEFAULT_AGENT_ID}
ADB_PATH={DEFAULT_ADB_PATH}
"""


# ====================================================================
# EXCEPTIONS
# ====================================================================

class ConfigError(Exception):
    """Raised khi cấu hình thiếu hoặc không hợp lệ (thiếu SERVER_URL/ANON_KEY...)."""
    pass


# ====================================================================
# AGENT CONFIG (kết quả trả về của get_config())
# ====================================================================

class AgentConfig:
    """
    Đại diện cho toàn bộ cấu hình đã được load và validate của agent.

    Attributes:
        server_url (str): URL Supabase project
        anon_key (str): Supabase anon key dùng để xác thực request
        agent_id (str): Định danh của agent này (phân biệt nhiều máy chạy agent)
        adb_path (str): Đường dẫn/tên lệnh adb (mặc định "adb", dựa vào PATH)
        poll_interval (int): Khoảng thời gian poll lệnh mới (giây)
        heartbeat_interval (int): Khoảng thời gian gửi heartbeat (giây)
    """

    def __init__(self, server_url, anon_key, agent_id, adb_path,
                 poll_interval=DEFAULT_POLL_INTERVAL_SECONDS,
                 heartbeat_interval=DEFAULT_HEARTBEAT_INTERVAL_SECONDS):
        self.server_url = server_url.rstrip("/")
        self.anon_key = anon_key
        self.agent_id = agent_id
        self.adb_path = adb_path
        self.poll_interval = poll_interval
        self.heartbeat_interval = heartbeat_interval

    def __repr__(self):
        # Không bao giờ in anon_key đầy đủ ra log/console - chỉ hiện vài ký tự đầu
        masked_key = f"{self.anon_key[:8]}..." if len(self.anon_key) > 8 else "****"
        return (
            f"AgentConfig(server_url={self.server_url!r}, anon_key={masked_key!r}, "
            f"agent_id={self.agent_id!r}, adb_path={self.adb_path!r})"
        )


# ====================================================================
# ENV FILE HANDLING
# ====================================================================

def ensure_env_file():
    """
    Đảm bảo file .env tồn tại. Nếu chưa có, tự tạo template với placeholder
    và trả về False để báo cho caller biết cần dừng lại, yêu cầu người dùng
    điền thông tin thật vào trước khi chạy tiếp.

    Returns:
        bool: True nếu .env đã tồn tại sẵn (có thể load được),
              False nếu vừa mới tạo template (cần người dùng điền tay)
    """
    if ENV_FILE.exists():
        return True

    try:
        ENV_FILE.write_text(ENV_TEMPLATE, encoding="utf-8")
    except OSError as e:
        raise ConfigError(f"Không thể tạo file .env template tại {ENV_FILE}: {e}")

    return False


def _parse_env_file(env_path):
    """
    Parse thủ công 1 file .env dạng KEY=VALUE (không dùng thư viện ngoài
    để giữ agent nhẹ, không phụ thuộc python-dotenv).

    Args:
        env_path: Path tới file .env

    Returns:
        dict: {key: value} đã parse được
    """
    env_data = {}
    try:
        content = env_path.read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        raise ConfigError(f"Không thể đọc file .env tại {env_path}: {e}")

    for line_number, raw_line in enumerate(content.splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue  # Bỏ qua dòng không đúng định dạng KEY=VALUE
        key, _, value = line.partition("=")
        env_data[key.strip()] = value.strip()

    return env_data


# ====================================================================
# PUBLIC API
# ====================================================================

def get_config():
    """
    Load và validate toàn bộ cấu hình từ .env, trả về AgentConfig.

    Đây là entrypoint chính mà agent.py sẽ gọi khi khởi động.

    Returns:
        AgentConfig: Cấu hình đã validate hợp lệ

    Raises:
        ConfigError: Nếu .env chưa tồn tại (vừa được tạo template),
                     hoặc SERVER_URL/ANON_KEY thiếu/vẫn là placeholder

    Example:
        >>> config = get_config()
        >>> config.server_url
        'https://xxxxx.supabase.co'
    """
    env_existed = ensure_env_file()

    if not env_existed:
        raise ConfigError(
            f"Chưa tìm thấy file .env, đã tạo template mới tại: {ENV_FILE}\n"
            f"Vui lòng mở file này và điền SERVER_URL + ANON_KEY thật "
            f"(lấy trong Supabase Dashboard -> Settings -> API), "
            f"sau đó chạy lại agent."
        )

    env_data = _parse_env_file(ENV_FILE)

    server_url = env_data.get("SERVER_URL", "").strip()
    anon_key = env_data.get("ANON_KEY", "").strip()

    if not server_url or server_url == PLACEHOLDER_SERVER_URL:
        raise ConfigError(
            f"SERVER_URL chưa được cấu hình hợp lệ trong {ENV_FILE}. "
            f"Vui lòng điền URL Supabase project thật (Settings -> API -> Project URL)."
        )

    if not anon_key or anon_key == PLACEHOLDER_ANON_KEY:
        raise ConfigError(
            f"ANON_KEY chưa được cấu hình hợp lệ trong {ENV_FILE}. "
            f"Vui lòng điền anon key thật (Settings -> API -> anon public key)."
        )

    agent_id = env_data.get("AGENT_ID", "").strip() or DEFAULT_AGENT_ID
    adb_path = env_data.get("ADB_PATH", "").strip() or DEFAULT_ADB_PATH

    # Đảm bảo các thư mục runtime tồn tại
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        TEMP_DIR.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        raise ConfigError(f"Không thể tạo thư mục runtime (logs/temp): {e}")

    return AgentConfig(
        server_url=server_url,
        anon_key=anon_key,
        agent_id=agent_id,
        adb_path=adb_path,
    )


if __name__ == "__main__":
    """Test agent_config khi chạy trực tiếp."""
    print("\n" + "=" * 70)
    print("LGPhone Agent - Config Test")
    print("=" * 70 + "\n")

    try:
        config = get_config()
        print(f"✓ Config hợp lệ: {config}")
        print(f"  LOG_DIR: {LOG_DIR}")
        print(f"  TEMP_DIR: {TEMP_DIR}")
    except ConfigError as e:
        print(f"✗ Config lỗi (đúng như mong đợi nếu chưa điền .env):\n{e}")

    print("\n" + "=" * 70 + "\n")
