"""
Agent Logger Module - LGPhone Agent v3.0

Quản lý logging cho toàn bộ python-agent. Thay thế các lệnh print() rời rạc
trong bản gốc bằng logging thật: ghi ra console + file theo ngày, có level
rõ ràng (DEBUG/INFO/WARNING/ERROR), giúp debug khi agent chạy nền dài hạn
trên nhiều máy.

Convention giống hệt logger.py bên LX-tool-ultimate để dễ bảo trì đồng bộ.
"""

import logging
import logging.handlers
import sys
from datetime import datetime

import agent_config

# ====================================================================
# CONSTANTS
# ====================================================================

LOG_FORMAT = "%(asctime)s | %(name)-18s | %(levelname)-8s | %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"
LOG_MAX_BYTES = 10 * 1024 * 1024  # 10 MB
LOG_BACKUP_COUNT = 10

_loggers = {}


# ====================================================================
# GET LOGGER
# ====================================================================

def get_logger(name):
    """
    Lấy hoặc tạo logger cho một module cụ thể trong agent.

    Args:
        name: Tên logger (thường là __name__ của module gọi)

    Returns:
        logging.Logger: Logger instance đã cấu hình console + file handler

    Example:
        >>> log = get_logger(__name__)
        >>> log.info("Agent started")
    """
    if name in _loggers:
        return _loggers[name]

    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    if logger.handlers:
        _loggers[name] = logger
        return logger

    formatter = logging.Formatter(fmt=LOG_FORMAT, datefmt=LOG_DATE_FORMAT)

    # Console handler
    try:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
    except Exception as e:
        print(f"[AGENT LOGGER ERROR] Không thể tạo console handler: {e}")

    # File handler (rotation theo dung lượng + tên file theo ngày)
    try:
        agent_config.LOG_DIR.mkdir(parents=True, exist_ok=True)
        log_file = get_log_file_path()

        file_handler = logging.handlers.RotatingFileHandler(
            filename=str(log_file),
            maxBytes=LOG_MAX_BYTES,
            backupCount=LOG_BACKUP_COUNT,
            encoding="utf-8",
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except Exception as e:
        print(f"[AGENT LOGGER ERROR] Không thể tạo file handler: {e}")

    _loggers[name] = logger
    return logger


def get_log_file_path(date=None):
    """
    Lấy đường dẫn file log cho một ngày cụ thể.

    Args:
        date: datetime object (mặc định dùng ngày hôm nay)

    Returns:
        Path: Đường dẫn file log, ví dụ logs/2026-07-08.log
    """
    if date is None:
        date = datetime.now()
    date_str = date.strftime("%Y-%m-%d")
    return agent_config.LOG_DIR / f"{date_str}.log"


# ====================================================================
# CONVENIENCE FUNCTIONS - AGENT-SPECIFIC EVENTS
# ====================================================================

def log_device_detected(logger, serial, device_type, confidence, model):
    """Ghi log khi phát hiện loại thiết bị (real/emulator)."""
    logger.info(
        f"[DEVICE] {serial} detected as {device_type.upper()} "
        f"({confidence}% confidence) - {model}"
    )


def log_device_upload(logger, serial, success):
    """Ghi log kết quả upload thông tin thiết bị lên Supabase."""
    if success:
        logger.info(f"[UPLOAD] Device {serial} uploaded successfully")
    else:
        logger.error(f"[UPLOAD] Device {serial} upload failed")


def log_command_received(logger, serial, command_id, command_name):
    """Ghi log khi agent nhận được 1 lệnh mới từ Supabase."""
    logger.info(f"[COMMAND] {serial} received '{command_name}' (id={command_id})")


def log_command_result(logger, serial, command_id, success, detail=""):
    """Ghi log kết quả thực thi 1 lệnh."""
    if success:
        logger.info(f"[COMMAND] {serial} command {command_id} completed. {detail}")
    else:
        logger.error(f"[COMMAND] {serial} command {command_id} FAILED. {detail}")


def log_heartbeat(logger, serial, success):
    """Ghi log heartbeat (chỉ ở mức DEBUG để tránh log quá nhiều mỗi 10s)."""
    if success:
        logger.debug(f"[HEARTBEAT] {serial} ok")
    else:
        logger.warning(f"[HEARTBEAT] {serial} failed")


def log_poll_error(logger, serial, error):
    """Ghi log khi vòng lặp poll lệnh gặp lỗi (thay vì except: pass im lặng)."""
    logger.error(f"[POLL] {serial} polling error: {error}")


if __name__ == "__main__":
    """Test agent_logger khi chạy trực tiếp."""
    print("\n" + "=" * 70)
    print("LGPhone Agent - Logger Test")
    print("=" * 70 + "\n")

    log = get_logger(__name__)

    log.debug("Đây là DEBUG message (chỉ vào file, không ra console)")
    log.info("Đây là INFO message")
    log.warning("Đây là WARNING message")
    log.error("Đây là ERROR message")

    log_device_detected(log, "emulator-5554", "emulator", 85, "Google Pixel 4")
    log_device_upload(log, "emulator-5554", True)
    log_command_received(log, "emulator-5554", "cmd-001", "screenshot")
    log_command_result(log, "emulator-5554", "cmd-001", True, "Screenshot captured")
    log_heartbeat(log, "emulator-5554", True)
    log_poll_error(log, "emulator-5554", "Connection timeout")

    print(f"\n✓ Log file tại: {get_log_file_path()}")
    print("\n" + "=" * 70 + "\n")
