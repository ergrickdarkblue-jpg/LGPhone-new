# LGPhone Agent Tool

Agent Tool chay tren PC, nhan lenh tu web app qua Supabase, dieu khien Android qua ADB.

## HUONG DAN CACH DUNG FILE ZIP

### Buoc 1: Tai file zip ve may

Tai file zip chua thu muc `lgphone-agent` ve may tinh.

### Buoc 2: Giai nen file zip

**Cach 1: Right-click**
- Right-click vao file zip
- Chon "Extract All..." (Giai nen tat ca)
- Chon vi tri giai nen, vi du: `C:\lgphone-agent` hoac `D:\lgphone-agent`
- Nhan "Extract"

**Cach 2: Dung WinRAR / 7-Zip**
- Right-click vao file zip
- Chon "Extract to lgphone-agent\" (WinRAR)
- Hoac: 7-Zip -> "Extract to lgphone-agent\"

Sau khi giai nen, ban se co cau truc thu muc:
```
lgphone-agent\
  ├── start.bat          <- Chay cai dat lan dau
  ├── run.bat            <- Chay nhanh lan sau
  ├── .env               <- File cau hinh (can dien key)
  ├── .env.example       <- Mau cau hinh
  ├── package.json
  └── src\
      ├── index.js
      ├── adb.js
      └── command-handler.js
```

### Buoc 3: Cai Node.js (chi lam 1 lan)

1. Vao https://nodejs.org
2. Tai ban **LTS** (version 18 hoac 20)
3. Chay file cai dat, nhan "Next" cho den khi xong
4. Dong cua so cai dat

Kiem tra: Mo CMD (Win+R -> go `cmd`), go:
```
node --version
```
Neu hien version (VD: v20.11.0) la OK.

### Buoc 4: Cai ADB (chi lam 1 lan)

1. Vao https://developer.android.com/tools/releases/platform-tools
2. Tai "SDK Platform-Tools for Windows"
3. Giai nen file zip vao thu muc, vi du: `C:\platform-tools`
4. Them vao PATH:
   - Nhan Win+R, go: `sysdm.cpl`
   - Tab "Advanced" -> "Environment Variables"
   - Tim "Path" trong khung duoi -> "Edit" -> "New"
   - Dan: `C:\platform-tools`
   - OK -> OK -> OK
5. Mo CMD moi, kiem tra:
```
adb version
```
Neu hien version la OK.

### Buoc 5: Lay Service Role Key

1. Vao: https://supabase.com/dashboard/project/nyuvpiztruwdmvogtwpz/settings/api
2. Tim muc **service_role**
3. Nhan **Reveal**
4. Nhan **Copy**

### Buoc 6: Dien key vao file .env

1. Mo thu muc `lgphone-agent` (da giai nen o Buoc 2)
2. Right-click vao file `.env` -> Open with -> Notepad
3. Tim dong:
   ```
   SUPABASE_SERVICE_ROLE_KEY=PASTE_YOUR_SERVICE_ROLE_KEY_HERE
   ```
4. Xoa `PASTE_YOUR_SERVICE_ROLE_KEY_HERE`, dan key that vao
5. Luu file: Ctrl+S
6. Dong Notepad

### Buoc 7: Ket noi dien thoai

**Qua USB:**
1. Tren dien thoai: Settings -> Developer Options -> Bat "USB Debugging"
2. Cam cap USB tu dien thoai vao may tinh
3. Tren dien thoai: Chap nhan "Allow USB debugging"
4. Mo CMD, go:
```
adb devices
```
Se hien:
```
List of devices attached
1234567890abcdef    device
```

**Qua WiFi:**
1. Tren dien thoai: Settings -> Developer Options -> Bat "USB Debugging" + "Wireless debugging"
2. Mo CMD, go:
```
adb tcpip 5555
adb connect <IP_DIEN_THOAI>:5555
```
VD: `adb connect 192.168.1.100:5555`

### Buoc 8: Chay Agent

**Lan dau tien:**
- Mo thu muc `lgphone-agent`
- Double-click `start.bat`
- Script tu:
  - Kiem tra Node.js
  - Kiem tra ADB
  - Cai npm packages
  - Mo Notepad de ban dien key (neu chua co)
  - Hien thi thiet bi ADB ket noi
  - Khoi dong Agent

**Lan sau:**
- Double-click `run.bat` (nhanh hon, bo qua buoc kiem tra)

### Buoc 9: Dung web app de dieu khien

1. Mo web app LGPhone tren trinh duyet
2. Dang nhap bang tai khoan admin
3. Vao "Thiet bi" de xem thiet bi da ket noi
4. Vao "Dieu khien" de gui lenh: tap, swipe, screenshot, mo app, etc.
5. Vao "Cấp máy" de cap thiet bi cho tai khoan phu voi thoi gian su dung

## Lenh ho tro

| Lenh | Tham so | Mo ta |
|------|---------|-------|
| tap | x, y | Cham toa do |
| swipe | x1, y1, x2, y2, duration | Vuot |
| input_text | text | Nhap van ban |
| keyevent | keycode | Phim cung |
| screenshot | - | Chup man hinh |
| start_app | package | Mo app |
| stop_app | package | Dung app |
| clear_data | package | Xoa data app |
| install_app | apk_path | Cai APK |
| reboot | - | Khoi dong lai |
| wake | - | Danh thuc |
| back | - | Phim Back |
| home | - | Phim Home |
| script | script (JSON) | Chuoi lenh |

## Khac phuc loi

| Loi | Cach khac phuc |
|-----|----------------|
| "node: command not found" | Cai Node.js tu https://nodejs.org |
| "adb: command not found" | Cai ADB va them vao PATH (Buoc 4) |
| "Device unauthorized" | Chap nhan RSA key tren dien thoai |
| "Missing SUPABASE_SERVICE_ROLE_KEY" | Dien key vao file .env (Buoc 6) |
| "Device not connected" | Chay `adb devices` de kiem tra ket noi |
| "npm install failed" | Kiem tra internet, chay lai `npm install` |
| "no devices" | Kiem tra cap USB / bat USB Debugging |
