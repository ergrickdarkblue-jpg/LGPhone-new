"""
ADB Client Module - LGPhone Agent v3.0

Wrapper thấp nhất quanh lệnh `adb` (Android Debug Bridge). Đây là tầng
duy nhất trong agent được phép gọi trực tiếp subprocess tới adb - mọi
module khác (device_detector, command_executor...) phải đi qua đây,
không tự gọi subprocess riêng.

Quy tắc:
- Không hardcode timeout - lấy từ agent_config.
- Không bao giờ để lỗi ADB làm crash agent - luôn trả về giá trị an toàn
  (None, [], hoặc tuple lỗi) kèm log rõ ràng.
"""

import subprocess

import agent_config
from agent_logger import get_logger

log = get_logger(__name__)


# ====================================================================
# CORE ADB EXECUTION
# ====================================================================

def run_adb_command(adb_path, serial, args, timeout=None):
    """
    Chạy 1 lệnh `adb -s <serial> <args...>` và trả về kết quả.

    Args:
        adb_path: Đường dẫn/tên lệnh adb (từ config.adb_path)
        serial: Serial của thiết bị (vd: "emulator-5554", "192.168.1.10:5555")
        args: List các tham số adb, vd: ["shell", "getprop", "ro.product.model"]
        timeout: Timeout tính bằng giây (mặc định dùng
                 agent_config.DEFAULT_ADB_COMMAND_TIMEOUT nếu không truyền)

    Returns:
        tuple(int, str, str): (return_code, stdout, stderr)
                               return_code = -1 nếu có exception xảy ra

    Example:
        >>> run_adb_command("adb", "emulator-5554", ["shell", "getprop", "ro.product.model"])
        (0, 'Pixel_4', '')
    """
    if timeout is None:
        timeout = agent_config.DEFAULT_ADB_COMMAND_TIMEOUT

    command = [adb_path, "-s", serial] + list(args)

    try:
        result = subprocess.run(command, capture_output=True, timeout=timeout)
        stdout = result.stdout.decode("utf-8", errors="replace").strip()
        stderr = result.stderr.decode("utf-8", errors="replace").strip()
        return result.returncode, stdout, stderr

    except subprocess.TimeoutExpired:
        log.warning(f"[ADB] Timeout ({timeout}s) khi chạy: {' '.join(command)}")
        return -1, "", "timeout"

    except FileNotFoundError:
        log.error(f"[ADB] Không tìm thấy executable '{adb_path}' - kiểm tra ADB_PATH trong .env")
        return -1, "", "adb_not_found"

    except Exception as e:
        log.error(f"[ADB] Lỗi không xác định khi chạy '{' '.join(command)}': {e}")
        return -1, "", str(e)


def list_devices(adb_path, timeout=None):
    """
    Liệt kê toàn bộ thiết bị đang kết nối qua ADB (chạy `adb devices`,
    không cần chỉ định serial cụ thể).

    Args:
        adb_path: Đường dẫn/tên lệnh adb
        timeout: Timeout giây (mặc định agent_config.DEFAULT_ADB_DEVICES_TIMEOUT)

    Returns:
        list[dict]: [{"serial": str, "state": str}, ...]
                     state chỉ nhận "device" hoặc "emulator" (bỏ qua
                     "unauthorized", "offline" vì chưa dùng được)
    """
    if timeout is None:
        timeout = agent_config.DEFAULT_ADB_DEVICES_TIMEOUT

    try:
        result = subprocess.run([adb_path, "devices"], capture_output=True, timeout=timeout)
        raw_output = result.stdout.decode("utf-8", errors="replace").strip()
        lines = raw_output.splitlines()

    except subprocess.TimeoutExpired:
        log.warning(f"[ADB] Timeout ({timeout}s) khi chạy 'adb devices'")
        return []

    except FileNotFoundError:
        log.error(f"[ADB] Không tìm thấy executable '{adb_path}' - kiểm tra ADB_PATH trong .env")
        return []

    except Exception as e:
        log.error(f"[ADB] Lỗi không xác định khi chạy 'adb devices': {e}")
        return []

    devices = []
    # Dòng đầu tiên luôn là "List of devices attached" - bỏ qua
    for line in lines[1:]:
        parts = line.split()
        if len(parts) >= 2 and parts[1] in ("device", "emulator"):
            devices.append({"serial": parts[0], "state": parts[1]})
        elif len(parts) >= 2:
            log.debug(f"[ADB] Bỏ qua device '{parts[0]}' trạng thái '{parts[1]}' (chưa sẵn sàng)")

    return devices


def get_property(adb_path, serial, prop_key):
    """
    Lấy giá trị 1 system property của thiết bị (qua `getprop`).

    Args:
        adb_path: Đường dẫn/tên lệnh adb
        serial: Serial thiết bị
        prop_key: Tên property, vd: "ro.product.model"

    Returns:
        str: Giá trị property (đã lowercase, strip), chuỗi rỗng nếu lỗi/không có
    """
    return_code, stdout, stderr = run_adb_command(adb_path, serial, ["shell", f"getprop {prop_key}"])

    if return_code != 0:
        log.debug(f"[ADB] getprop {prop_key} thất bại cho {serial}: {stderr}")
        return ""

    return stdout.strip().lower()


def get_multiple_properties(adb_path, serial, prop_keys):
    """
    Lấy nhiều system property cùng lúc (tiện cho device_detector).

    Args:
        adb_path: Đường dẫn/tên lệnh adb
        serial: Serial thiết bị
        prop_keys: List tên property cần lấy

    Returns:
        dict: {prop_key: value}
    """
    properties = {}
    for key in prop_keys:
        properties[key] = get_property(adb_path, serial, key)
    return properties


def take_screenshot(adb_path, serial, timeout=None):
    """
    Chụp màn hình thiết bị. Ưu tiên dùng `exec-out` (nhanh, không cần file
    tạm trên thiết bị); nếu thất bại thì fallback sang cách cũ (chụp lưu
    vào /sdcard rồi pull về).

    Args:
        adb_path: Đường dẫn/tên lệnh adb
        serial: Serial thiết bị
        timeout: Timeout giây (mặc định agent_config.DEFAULT_SCREENSHOT_TIMEOUT)

    Returns:
        bytes hoặc None: Dữ liệu ảnh PNG, None nếu thất bại cả 2 cách
    """
    if timeout is None:
        timeout = agent_config.DEFAULT_SCREENSHOT_TIMEOUT

    # Cách 1: exec-out (nhanh, ưu tiên)
    try:
        result = subprocess.run(
            [adb_path, "-s", serial, "exec-out", "screencap", "-p"],
            capture_output=True, timeout=timeout,
        )
        if result.returncode == 0 and len(result.stdout) > 1000:
            return result.stdout
        log.debug(f"[ADB] exec-out screenshot cho {serial} không hợp lệ, thử fallback")

    except subprocess.TimeoutExpired:
        log.warning(f"[ADB] Timeout screenshot exec-out cho {serial}")
    except Exception as e:
        log.debug(f"[ADB] exec-out screenshot lỗi cho {serial}: {e}, thử fallback")

    # Cách 2: fallback - chụp lưu vào /sdcard rồi pull về máy local
    device_temp_path = "/sdcard/lg_ss.png"
    local_temp_path = str(agent_config.TEMP_DIR / f"lg_ss_{serial.replace(':', '_')}.png")

    return_code, _, stderr = run_adb_command(
        adb_path, serial, ["shell", "screencap", "-p", device_temp_path], timeout=timeout
    )
    if return_code != 0:
        log.error(f"[ADB] Fallback screencap thất bại cho {serial}: {stderr}")
        return None

    try:
        pull_result = subprocess.run(
            [adb_path, "-s", serial, "pull", device_temp_path, local_temp_path],
            capture_output=True, timeout=timeout,
        )
        if pull_result.returncode != 0:
            log.error(f"[ADB] Pull screenshot thất bại cho {serial}")
            return None

        with open(local_temp_path, "rb") as f:
            return f.read()

    except subprocess.TimeoutExpired:
        log.warning(f"[ADB] Timeout pull screenshot cho {serial}")
        return None
    except OSError as e:
        log.error(f"[ADB] Không đọc được file screenshot tạm cho {serial}: {e}")
        return None
    except Exception as e:
        log.error(f"[ADB] Lỗi không xác định khi pull screenshot cho {serial}: {e}")
        return None


def check_adb_available(adb_path):
    """
    Kiểm tra executable adb có chạy được không (gọi `adb version`).

    Args:
        adb_path: Đường dẫn/tên lệnh adb

    Returns:
        bool: True nếu adb chạy được
    """
    try:
        result = subprocess.run([adb_path, "version"], capture_output=True, timeout=5)
        return result.returncode == 0
    except FileNotFoundError:
        log.error(f"[ADB] Không tìm thấy executable '{adb_path}' trong PATH")
        return False
    except Exception as e:
        log.error(f"[ADB] Lỗi kiểm tra adb version: {e}")
        return False


if __name__ == "__main__":
    """Test adb_client khi chạy trực tiếp (cần adb đã cài và có trong PATH)."""
    print("\n" + "=" * 70)
    print("LGPhone Agent - ADB Client Test")
    print("=" * 70 + "\n")

    adb_path = agent_config.DEFAULT_ADB_PATH

    print(f"Kiểm tra ADB khả dụng ({adb_path})...")
    available = check_adb_available(adb_path)
    print(f"  {'✓' if available else '✗'} ADB available: {available}")

    if available:
        print("\nLiệt kê devices...")
        devices = list_devices(adb_path)
        print(f"  Tìm thấy {len(devices)} device(s): {devices}")

        if devices:
            serial = devices[0]["serial"]
            print(f"\nLấy property cho {serial}...")
            model = get_property(adb_path, serial, "ro.product.model")
            print(f"  ro.product.model = {model}")

            print(f"\nChụp screenshot cho {serial}...")
            screenshot_data = take_screenshot(adb_path, serial)
            if screenshot_data:
                print(f"  ✓ Screenshot: {len(screenshot_data)} bytes")
            else:
                print("  ✗ Screenshot thất bại")
    else:
        print("\n(Không có ADB trong môi trường này nên bỏ qua phần test thiết bị thật)")

    print("\n" + "=" * 70 + "\n")
