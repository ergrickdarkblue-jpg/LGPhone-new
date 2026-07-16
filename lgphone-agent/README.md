# LGPhone Agent Tool

Agent Tool chạy trên PC, nhận lệnh từ web app qua Supabase và điều khiển Android qua ADB.

## Kiến trúc

```
Web App (React) → Supabase (device_commands) → Agent Tool (Node.js) → ADB → Android
```

## Yêu cầu

1. **Node.js** 18+
2. **ADB** (Android Debug Bridge)
3. **Supabase Service Role Key** — để agent cập nhật trạng thái lệnh

## Cài đặt

### Bước 1: Cài ADB

**Windows:** Tải Platform Tools từ https://developer.android.com/tools/releases/platform-tools → giải nén → thêm vào PATH

**macOS:**
```bash
brew install android-platform-tools
```

**Linux:**
```bash
sudo apt install adb
```

Kiểm tra:
```bash
adb version
```

### Bước 2: Cài Agent

```bash
cd lgphone-agent
npm install
```

### Bước 3: Lấy Service Role Key

Vào Supabase Dashboard:
```
https://supabase.com/dashboard/project/nyuvpiztruwdmvogtwpz/settings/api
```

Tìm mục **service_role** → **Reveal** → **Copy**

### Bước 4: Cấu hình

Tạo file `.env`:
```bash
cp .env.example .env
```

Mở `.env`, dán service_role key:
```
SUPABASE_URL=https://nyuvpiztruwdmvogtwpz.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-service-role-key
```

### Bước 5: Kết nối thiết bị

**USB:**
```bash
adb devices
# Bật USB Debugging trên điện thoại → cắm USB → chấp nhận RSA key
```

**WiFi:**
```bash
adb tcpip 5555
adb connect <device-ip>:5555
```

### Bước 6: Chạy

```bash
npm start
```

## Lệnh hỗ trợ

| Lệnh | Tham số | Mô tả |
|------|---------|-------|
| tap | x, y | Chạm tọa độ |
| swipe | x1, y1, x2, y2, duration | Vuốt |
| input_text | text | Nhập văn bản |
| keyevent | keycode | Phím cứng |
| screenshot | — | Chụp màn hình |
| start_app | package | Mở app |
| stop_app | package | Dừng app |
| clear_data | package | Xóa data app |
| install_app | apk_path | Cài APK |
| reboot | — | Khởi động lại |
| wake | — | Đánh thức |
| back | — | Phím Back |
| home | — | Phím Home |
| script | script (JSON) | Chuỗi lệnh |

## Script example

```json
[
  {"action": "tap", "x": 500, "y": 500},
  {"action": "wait", "ms": 1000},
  {"action": "input_text", "text": "Hello"},
  {"action": "tap", "x": 300, "y": 800}
]
```

## Troubleshooting

- **"adb: command not found"** — Thêm ADB vào PATH
- **"Device unauthorized"** — Chấp nhận RSA key trên điện thoại
- **"Missing SUPABASE_SERVICE_ROLE_KEY"** — Tạo file .env với service_role key
- **"Device not connected"** — Chạy `adb devices` để kiểm tra
