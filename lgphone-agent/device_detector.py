"""
Device Detector Module - LGPhone Agent v3.0

Phát hiện một thiết bị Android kết nối qua ADB là điện thoại thật hay máy
ảo (emulator/giả lập), dựa trên hệ thống chấm điểm (scoring) từ các system
property đặc trưng. Logic được giữ nguyên 100% so với bản gốc (đã kiểm
chứng hoạt động), chỉ tách ra module riêng và dùng adb_client thay vì tự
gọi ADB trực tiếp.
"""

import agent_config
import adb_client
from agent_logger import get_logger

log = get_logger(__name__)

# ====================================================================
# SCORING SIGNATURES
# ====================================================================
# Mỗi tuple: (property_key, [danh sách giá trị cho thấy đây là emulator])

EMULATOR_SIGNATURES = [
    ("ro.hardware", ["goldfish", "ranchu", "vbox86", "genymotion", "nox", "bluestacks"]),
    ("ro.product.model", ["sdk", "emulator", "genymotion", "bluestacks", "memu", "nox"]),
    ("ro.product.manufacturer", ["unknown", "generic", "genymotion"]),
    ("ro.kernel.qemu", ["1"]),
    ("ro.product.name", ["sdk", "generic", "emulator"]),
]

# Các property mà máy thật thường có, máy ảo thường thiếu/rỗng
REAL_DEVICE_SIGNATURES = ["ro.boot.serialno", "gsm.sim.state", "ril.serialnumber"]

# Toàn bộ property cần đọc để chấm điểm
PROPERTY_KEYS_TO_CHECK = [
    "ro.hardware", "ro.product.model", "ro.product.manufacturer",
    "ro.build.tags", "ro.build.fingerprint", "ro.kernel.qemu",
    "ro.product.name", "ro.product.brand", "ro.build.version.release",
    "ro.boot.serialno", "gsm.sim.state", "ril.serialnumber",
    "ro.build.characteristics", "ro.secure", "ro.debuggable",
]


# ====================================================================
# DETECTION LOGIC
# ====================================================================

def _calculate_scores(properties, serial):
    """
    Tính điểm emulator/real dựa trên bộ properties đã lấy được.

    Args:
        properties: dict {property_key: value} đã lowercase
        serial: Serial thiết bị (dùng để check tiền tố "emulator-")

    Returns:
        tuple(int, int): (score_emulator, score_real)
    """
    score_emulator = 0
    score_real = 0

    # Serial dạng "emulator-XXXX" gần như chắc chắn là máy ảo Android Studio
    if serial.lower().startswith("emulator-"):
        score_emulator += 5

    for property_key, bad_values in EMULATOR_SIGNATURES:
        value = properties.get(property_key, "")
        if any(bad in value for bad in bad_values):
            score_emulator += 2
        elif value and value not in ("", "unknown"):
            score_real += 1

    for property_key in REAL_DEVICE_SIGNATURES:
        value = properties.get(property_key, "")
        if value and value not in ("", "unknown", "null"):
            score_real += 2

    if "emulator" in properties.get("ro.build.characteristics", ""):
        score_emulator += 3

    if properties.get("ro.secure") == "1" and properties.get("ro.debuggable") == "0":
        score_real += 2

    return score_emulator, score_real


def detect_device_type(serial, adb_path=None):
    """
    Phát hiện loại thiết bị (real phone hoặc emulator) qua hệ thống chấm điểm
    dựa trên các system property đặc trưng.

    Args:
        serial: Serial của thiết bị cần phát hiện
        adb_path: Đường dẫn/tên lệnh adb (mặc định agent_config.DEFAULT_ADB_PATH)

    Returns:
        dict: {
            "type": "phone" | "emulator",
            "confidence": int (0-100),
            "model": str (vd: "Google Pixel_4"),
            "brand": str,
            "android": str (phiên bản Android),
            "fingerprint": str,
        }

    Example:
        >>> detect_device_type("emulator-5554")
        {'type': 'emulator', 'confidence': 83, 'model': 'Google Sdk_Gphone64_X86_64', ...}
    """
    if adb_path is None:
        adb_path = agent_config.DEFAULT_ADB_PATH

    properties = adb_client.get_multiple_properties(adb_path, serial, PROPERTY_KEYS_TO_CHECK)

    score_emulator, score_real = _calculate_scores(properties, serial)
    total_score = max(score_emulator + score_real, 1)

    if score_emulator > score_real:
        device_type = "emulator"
        confidence = round(score_emulator / total_score * 100)
    else:
        device_type = "phone"
        confidence = round(score_real / total_score * 100)

    brand = properties.get("ro.product.brand", "").title()
    model = properties.get("ro.product.model", "Unknown").title()

    result = {
        "type": device_type,
        "confidence": confidence,
        "model": f"{brand} {model}".strip(),
        "brand": brand,
        "android": properties.get("ro.build.version.release", ""),
        "fingerprint": properties.get("ro.build.fingerprint", ""),
    }

    log.info(
        f"[DETECT] {serial}: {device_type.upper()} ({confidence}% confidence) "
        f"- {result['model']} - Android {result['android']}"
    )

    return result


if __name__ == "__main__":
    """Test device_detector khi chạy trực tiếp (cần adb + device thật)."""
    print("\n" + "=" * 70)
    print("LGPhone Agent - Device Detector Test")
    print("=" * 70 + "\n")

    adb_path = agent_config.DEFAULT_ADB_PATH

    if not adb_client.check_adb_available(adb_path):
        print("✗ ADB không khả dụng trong môi trường này, bỏ qua test thiết bị thật.")
        print("\nTest _calculate_scores() với dữ liệu giả lập thay thế:")

        fake_emulator_props = {
            "ro.hardware": "ranchu",
            "ro.product.model": "sdk_gphone64_x86_64",
            "ro.kernel.qemu": "1",
            "ro.build.characteristics": "emulator",
            "ro.secure": "0",
            "ro.debuggable": "1",
        }
        score_emu, score_real = _calculate_scores(fake_emulator_props, "emulator-5554")
        print(f"  Fake emulator props -> score_emu={score_emu}, score_real={score_real}")
        assert score_emu > score_real, "Test thất bại: fake emulator phải có score_emu cao hơn"
        print("  ✓ Logic chấm điểm hoạt động đúng cho trường hợp emulator")

        fake_real_props = {
            "ro.hardware": "qcom",
            "ro.product.model": "pixel 7",
            "ro.boot.serialno": "R58M12ABCDE",
            "gsm.sim.state": "ready",
            "ro.secure": "1",
            "ro.debuggable": "0",
        }
        score_emu2, score_real2 = _calculate_scores(fake_real_props, "R58M12ABCDE")
        print(f"  Fake real device props -> score_emu={score_emu2}, score_real={score_real2}")
        assert score_real2 > score_emu2, "Test thất bại: fake real device phải có score_real cao hơn"
        print("  ✓ Logic chấm điểm hoạt động đúng cho trường hợp máy thật")

    else:
        devices = adb_client.list_devices(adb_path)
        if not devices:
            print("✗ Không tìm thấy device nào đang kết nối")
        else:
            for device in devices:
                result = detect_device_type(device["serial"], adb_path)
                print(f"  {device['serial']}: {result}")

    print("\n" + "=" * 70 + "\n")
