# Bật V2 trên Cloudflare + Supabase

V2 đã có mã đăng nhập và đồng bộ; môi trường hiện chưa có project Supabase của chủ app. Các kiểm thử mô phỏng không thay thế việc kiểm tra dịch vụ thật và iPhone thật. Dùng cùng một URL production ổn định trên các thiết bị. Không cần máy tính chạy liên tục sau khi triển khai.

## 1. Tạo project Supabase

1. Mở <https://supabase.com/dashboard>, đăng nhập và tạo **New project** trong tổ chức của bạn. Chọn khu vực gần người dùng. Mật khẩu database chỉ lưu trong trình quản lý mật khẩu của bạn.
2. Chờ database sẵn sàng. Trong **SQL Editor**, chạy toàn bộ [migration V2](../../supabase/migrations/202610080001_v2.sql) một lần trên project mới. Script có transaction: nếu lỗi, toàn bộ migration sẽ rollback. Không chỉ chạy riêng các lệnh tạo bảng hoặc bỏ qua RLS.
3. Migration tạo 5 bảng nghiệp vụ, RLS, khóa ngoại cùng chủ sở hữu và các RPC đồng bộ. Ghi tài chính đi qua RPC; quyền ghi trực tiếp từ frontend bị thu hồi có chủ đích. `sotien_writer` là role không đăng nhập, không bỏ qua RLS và không sở hữu bảng.
4. Trong **Authentication → Providers / Sign In**, bật Email/password. Giữ xác nhận email khi dùng thật. Kiểm tra cấu hình email/SMTP và giới hạn gửi của gói đang sử dụng.
5. Trong **Authentication → URL Configuration**, đặt **Site URL** thành URL Cloudflare production của app. Thêm redirect URL chính xác `https://<địa-chỉ-app>/settings` cho xác nhận email và khôi phục mật khẩu. Nếu kiểm thử localhost, thêm riêng `http://localhost:5173/settings`; không dùng wildcard rộng cho production.
6. Trong trang **Connect** hoặc **Project Settings → API / API Keys**, lấy **Project URL** và **publishable key** (`sb_publishable_...`). Legacy `anon` key cũng được chấp nhận. Không lấy `service_role`, `sb_secret_...`, mật khẩu database hoặc access token quản trị.

## 2. Cấu hình và triển khai frontend

Trong Cloudflare Pages → project → Settings → Variables and Secrets / Environment variables, thêm cho production:

| Tên                             | Giá trị                                                |
| ------------------------------- | ------------------------------------------------------ |
| `NODE_VERSION`                  | `24`                                                   |
| `VITE_SUPABASE_URL`             | Project URL, ví dụ `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key của cùng project                       |

Đây là cấu hình public của frontend; phân quyền dữ liệu do Auth + RLS quyết định. Hai biến Supabase phải cùng có hoặc cùng vắng. Build từ chối cấu hình không đầy đủ và key đặc quyền.

Chạy build `npm run build`, output `dist`. Redeploy sau khi thêm biến: Vite đọc biến tại **thời điểm build**. File `dist/_headers` được tạo với `connect-src 'self'` và đúng origin Supabase đã cấu hình. Không cần sửa CSP thành `*`, không cần WebSocket/realtime.

Để phát triển local, sao chép `.env.example` thành `.env.local`, điền hai giá trị public trên máy của bạn rồi khởi động lại Vite. `.env.local` đã bị loại khỏi Git. Nếu bỏ cả hai biến, app vẫn chạy ở chế độ local.

Cloudflare nối Git chỉ build V2 khi mã đã được đưa lên nhánh deploy. Publish môi trường Codex không cập nhật website; kiểm tra build Cloudflare từ commit mới nhất và URL production `https://qltaichinh-web.pages.dev/`.

## 3. Dùng sổ trên thiết bị đầu tiên

1. Trước khi nâng cấp, xuất backup JSON ở thiết bị có dữ liệu. Giữ file riêng tư.
2. Mở app → Cài đặt → đăng ký và xác nhận email, sau đó đăng nhập.
3. App giữ nguồn local cũ riêng cho tài khoản vừa đăng nhập. Khi đăng xuất, app dùng một sổ local riêng để tránh lộ dữ liệu cũ cho người dùng kế tiếp. Nguồn cũ không bị xóa.
4. Cloud trống: kiểm tra số tài khoản/giao dịch rồi chọn **Tải sổ local lên cloud**. Hoặc chọn **Bắt đầu sổ cloud trống** nếu muốn sổ mới. Phải đánh dấu xác nhận trước khi chọn.
5. Cloud đã có dữ liệu: sao lưu nguồn local cũ nếu cần rồi chọn **Dùng dữ liệu cloud**. Không tự gộp các sổ khác nhau, không đối chiếu bằng tên.
6. Nếu tải dở, mở lại và tiếp tục cùng lựa chọn. Các batch và bước xuất bản có mã cố định để thử lại an toàn. Nếu một thiết bị khác đã thiết lập cloud, kiểm tra cloud lại rồi chọn tải bản cloud; nguồn local vẫn được giữ.

Sau khi thiết lập, xem số thay đổi đang chờ, xung đột và lần đồng bộ thành công ở Cài đặt. Nút **Sao lưu sổ local cũ** vẫn cho phép lấy lại nguồn trước khi bật cloud. **Đồng bộ không phải backup**. Full restore bị chặn ở mọi hồ sơ cloud, kể cả khi offline/hết phiên; muốn khôi phục file, đăng xuất và dùng sổ local riêng. V2 không tự nhập sổ local mới vào một hồ sơ cloud đã hoạt động.

## 4. Thiết bị thứ hai và kiểm chứng thật

Mở cùng URL app, đăng nhập cùng tài khoản, chọn **Dùng dữ liệu cloud**. Thử bằng dữ liệu mẫu trước:

- PC tạo một khoản chi; điện thoại mở app/Đồng bộ ngay và thấy đúng khoản chi.
- Điện thoại bật chế độ máy bay, tạo khoản chi, đóng/mở lại PWA: bản ghi còn. Bật mạng, mở lại app; PC nhận được bản ghi.
- PC xóa mềm một giao dịch; điện thoại nhận thay đổi và ẩn giao dịch.
- Hai thiết bị sửa cùng bản ghi khi một thiết bị offline: có xung đột, xem được cả hai bản; chọn giữ local/cloud theo ý muốn.
- Đăng xuất A, đăng nhập B trên cùng trình duyệt: B không thấy dữ liệu A. Đăng nhập lại A: thay đổi chưa gửi vẫn còn.
- Đặt lại mật khẩu bằng email thật; mở link trong cùng trình duyệt đã yêu cầu (PKCE). Nếu dùng trình duyệt khác, yêu cầu link mới tại đó.
- Trên iPhone: Safari → Chia sẻ → Thêm vào Màn hình chính; thử standalone, offline, đóng app rồi mở lại, trở lại foreground sau thời gian dài. iOS không đảm bảo đồng bộ khi app đóng.

Ghi URL triển khai, phiên bản iOS/Safari, ngày kiểm tra, kết quả từng bước vào [VALIDATION.md](../VALIDATION.md). Chỉ sau khi các bước thật này đạt mới đánh dấu V2 hoàn tất và bắt đầu V3.
