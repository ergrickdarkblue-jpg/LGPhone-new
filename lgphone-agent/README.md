# LGPhone Agent - Python ADB Bridge

## Cài đặt

### Yêu cầu
- Python 3.8+
- pip (Python package installer)

### Cài đặt thư viện
```bash
pip install requests python-dotenv
```

### Cấu hình
Tạo file `.env` trong thư mục này với nội dung:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
```

> Lấy các giá trị này từ file `.env` của dự án web (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, và SUPABASE_SERVICE_ROLE_KEY).

## Chạy Agent

```bash
python lgphone_agent.py
```

Hoặc chỉ định trực tiếp:
```bash
python lgphone_agent.py --supabase-url https://xxx.supabase.co --supabase-key eyJ... --service-key eyJ...
```

## Tính năng

1. **Auto-tìm ADB**: Tự động tìm ADB trong PATH, Android SDK, hoặc tải về tự động nếu chưa có.
2. **Phát hiện thiết bị**: Tự động phát hiện điện thoại thật (USB) và máy ảo (emulator).
3. **Đồng bộ trạng thái**: Cập nhật trạng thái online/offline của thiết bị lên web.
4. **Điều khiển từ xa**: Nhận lệnh từ web (Home, Back, Power, Volume, Reboot, Screenshot, Tap, Swipe).
5. **Cài đặt APK**: Cài đặt ứng dụng APK lên thiết bị từ xa.
6. **Gỡ ứng dụng**: Gỡ ứng dụng người dùng (giữ lại app hệ thống).

## Cách hoạt động

1. Agent chạy vòng lặp, polling Supabase mỗi 2 giây.
2. Khi bạn bấm nút trên web (Home, Back, Power...), lệnh được lưu vào Supabase.
3. Agent đọc lệnh, gửi đến thiết bị qua ADB.
4. Trạng thái thiết bị được đồng bộ lên web theo thời gian thực.

## Lệnh ADB được hỗ trợ

| Lệnh web | Hành động ADB |
|----------|---------------|
| key 3 | Home |
| key 4 | Back |
| key 26 | Power on/off |
| key 24 | Volume Up |
| key 25 | Volume Down |
| key 187 | Recent Apps |
| screenshot | Chụp màn hình |
| reboot | Khởi động lại |
| tap x,y | Chạm vào màn hình |
| swipe x1,y1,x2,y2 | Vuốt màn hình |

## Lưu ý
- Đảm bảo ADB server đang chạy (`adb start-server`).
- Đối với máy thật: bật USB Debugging trong Developer Options.
- Đối với máy ảo: đảm bảo emulator đang chạy.
- Agent cần kết nối internet để giao tiếp với Supabase.
