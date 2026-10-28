# CYBER-DRIFT: ZERO GRAVITY 🚀✨

Trò chơi 3D Sci-Fi Endless Runner & Obstacle Course tốc độ cao với cơ chế vật lý đảo trọng lực (Antigravity Physics), xây dựng hoàn chỉnh bằng **Three.js**, **Tailwind CSS**, **GSAP** và **Web Audio API**.

---

## 🎮 1. Giới thiệu Trò chơi
Người chơi điều khiển phi thuyền không gian tương lai lướt qua hành lang lượng tử vô tận trong không gian vũ trụ sâu thẳm. Bạn cần né tránh các rào cản laser đỏ rực, thu thập tinh thể năng lượng Cyan để kích hoạt **Hyper-Boost** và sử dụng công nghệ **Antigravity Flip** để lộn ngược bay bám trần hoặc sàn nhà nhằm sinh tồn.

---

## ⚡ 2. Điểm nổi bật Kỹ thuật (Technical Highlights)
- **Zero External Asset Dependency**: Toàn bộ mô hình 3D (phi thuyền đa khối khí động học, buồng lái phát quang, ống xả plasma, rào chắn laser xoay, tinh thể bát diện, hoa văn lưới sàn trần) đều được tạo hoàn toàn bằng hình học thủ tục (**Procedural Geometries & Materials**). Game chạy 100% không bao giờ gặp lỗi thiếu model hoặc kết nối mạng hỏng.
- **Post-Processing Neon Bloom**: Tích hợp `EffectComposer` cùng `UnrealBloomPass` đem lại phong cách thị giác Cyberpunk rực rỡ với ánh sáng neon phát quang trung thực.
- **Procedural Synth Web Audio Engine**: Tích hợp bộ tổng hợp âm thanh chuyên dụng bằng **Web Audio API** (Oscillators, Biquad Filters, White Noise Buffer), phát ra âm thanh động cơ phản lực, tiếng nhặt ngọc pha lê ngân vang, tiếng nổ va chạm, tiếng xé gió đảo trọng lực và giai điệu Synthwave arpeggio êm ái mà không cần bất kỳ file MP3 tải ngoài nào.
- **Hệ thống Tái sử dụng Đối tượng (Object Pooling)**: Chướng ngại vật, tinh thể năng lượng và các chùm hạt nổ đều được quản lý qua Object Pool cố định trong RAM, loại bỏ hiện tượng giật khung hình do thu gom rác (Garbage Collection).
- **Vật lý & Camera Warp**: Xử lý va chạm 3D AABB chuẩn xác, cơ chế lộn 180° mượt mà kết hợp hiệu ứng biến dạng góc nhìn máy quay (**GSAP FOV Warp 65° → 88°**) khi kích hoạt Hyper-Boost.
- **Vòng lặp Delta-Time Chuẩn**: Khung hình gameplay mượt mà và đồng nhất trên mọi tần số quét màn hình (60Hz, 120Hz, 144Hz, 240Hz).
- **Giao diện Glassmorphism Hiện đại**: Thiết kế HUD trong suốt tinh tế, đồng hồ đo tốc độ (Speedometer), đo FPS thời gian thực, bảng điểm cá nhân lưu trữ qua `localStorage`, cùng các nút điều khiển cảm ứng tối ưu cho thiết bị di động.

---

## 🕹️ 3. Phím điều khiển (Controls)

| Phím / Thao tác | Chức năng |
| :--- | :--- |
| `A` / `D` hoặc `Mũi tên Trái / Phải` | Lượn ngang mượt mà (Lateral Strafe & Bank Roll tilt) |
| `W` / `S` hoặc `Mũi tên Lên / Xuống` | Tinh chỉnh góc mũi tàu và độ cao (Pitch Control) |
| `SPACEBAR` | **Antigravity Flip**: Đảo ngược trọng lực lộn giữa Sàn ↔ Trần |
| `SHIFT` hoặc `F` | **Hyper-Boost**: Tăng tốc độ x1.85, giãn FOV, càn quét chướng ngại vật |
| `P` hoặc `ESC` | Tạm dừng trò chơi (Pause / Resume) |
| `M` | Bật / Tắt âm thanh (Mute / Unmute) |
| `Màn hình cảm ứng` | Có sẵn các phím ảo ◀, ▶, FLIP, BOOST ở góc dưới |

---

## 🚀 4. Hướng dẫn Khởi chạy (Quick Start)

Dự án không có bất kỳ phụ thuộc nào bắt buộc phải cài đặt qua `npm`, bạn có thể khởi động ngay lập tức:

### Cách 1: Khởi chạy bằng Node.js (Khuyên dùng)
Mở cửa sổ dòng lệnh tại thư mục dự án và chạy:
```bash
node server.js
```
Hoặc trên Windows chỉ cần nhấp đúp vào tệp:
```bash
start.bat
```
Sau đó truy cập trình duyệt web tại địa chỉ:
👉 **`http://localhost:5173`**

### Cách 2: Chạy bằng bất kỳ Local Static Server nào
Bạn có thể sử dụng VSCode Live Server, `npx serve`, hoặc Python:
```bash
npx serve .
# Hoặc: python -m http.server 5173
```

---

## 📁 5. Cấu trúc Dự án
```
cyber-drift-zero-gravity/
├── index.html          # Giao diện HTML5, Tailwind CSS, Glassmorphism HUD & Game Over Modal
├── server.js           # Máy chủ tĩnh Node.js HTTP thuần siêu nhẹ
├── package.json        # Cấu hình dự án
├── start.bat           # File khởi chạy nhanh 1-click cho Windows
├── src/
│   ├── main.js         # Game Manager, State Machine, Input handler, Vòng lặp RAF Delta-time
│   ├── renderer.js     # Three.js WebGLRenderer, Camera, EffectComposer, UnrealBloomPass
│   ├── player.js       # Mô hình Phi thuyền 3D Procedural, Động cơ phản lực hạt, Vật lý lộn ngược
│   ├── world.js        # Hành lang Cyberpunk, Lưới sàn/trần động, Starfield 2,500 sao, Object Pooling
│   ├── physics.js      # Phát hiện va chạm AABB 3D, Hệ thống năng lượng & Hyper-Boost
│   └── audio.js        # Bộ tổng hợp âm thanh Procedural Sound Synthesis qua Web Audio API
└── README.md           # Hướng dẫn chi tiết
```
