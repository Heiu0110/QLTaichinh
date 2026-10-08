# Deploy Cloudflare Pages

## Kết nối GitHub (khuyến nghị)

Dùng tài khoản Cloudflare hiện có. Không cần secret trong frontend hoặc bật máy tính liên tục.

1. Đăng nhập dashboard Cloudflare. Vào **Workers & Pages**, tạo ứng dụng **Pages** và chọn kết nối/import Git repository (nhãn UI có thể thay đổi).
2. Kết nối tài khoản GitHub, cấp Cloudflare quyền truy cập repo `Heiu0110/QLTaichinh` và chọn repo này.
3. Đặt project name, ví dụ `qltaichinh` nếu còn khả dụng. Production branch: **main**.
4. Build settings:

   | Thiết lập              | Giá trị                  |
   | ---------------------- | ------------------------ |
   | Framework preset       | Vite hoặc None           |
   | Build command          | `npm run build`          |
   | Build output directory | `dist`                   |
   | Root directory         | Gốc repository, để trống |
   | Environment variable   | `NODE_VERSION=24`        |

   `.nvmrc` cũng chỉ định Node 24. Chế độ local không yêu cầu key. Để bật V2 cloud, làm thêm [hướng dẫn Supabase](v2/SETUP.md) và đặt hai biến public của Supabase trước khi build.

5. Save and Deploy. Chờ deployment thành công, mở **URL do Cloudflare cung cấp** có đuôi `.pages.dev`. Tên miền chính xác phụ thuộc project name còn khả dụng; không tự giả định URL.
6. Mở `/transactions` và `/settings` trực tiếp để kiểm tra SPA routing. Cloudflare Pages tự fallback về SPA khi không có file `404.html`; repo không tạo file đó.
7. Vào Cài đặt app: kiểm tra đã lưu offline; xuất backup thử. Trên iPhone thực hiện kiểm tra bên dưới.

Sau khi kết nối, mỗi lần push lên `main` sẽ build/deploy lại tự động. Dữ liệu IndexedDB trên cùng URL được giữ lại khi cập nhật, trừ khi migration/code yêu cầu khác. Dùng URL production ổn định để nhập dữ liệu thật; các preview URL có kho dữ liệu riêng.

## Kiểm tra trên iPhone thật

1. Mở URL production bằng Safari, tải đủ trang và vào Cài đặt kiểm tra cache offline.
2. Thêm giao dịch thu/chi, reload và xác nhận dữ liệu còn.
3. Safari → Chia sẻ → Thêm vào Màn hình chính. Mở từ biểu tượng, kiểm tra chế độ standalone.
4. Bật chế độ máy bay, mở lại từ biểu tượng, nhập thêm giao dịch và reload.
5. Tắt chế độ máy bay, mở lại app và kiểm tra đồng bộ trên PC. Xuất JSON; chỉ thử nhập lại trong sổ local riêng vì full restore bị chặn ở hồ sơ cloud.

Không cần máy developer bật sau khi deploy. Không cần App Store/Google Play/domain riêng. iOS có thể thu hồi dữ liệu hoặc suspend app; không dựa vào chạy background liên tục. Backup vẫn bắt buộc để tránh mất dữ liệu.

## Trạng thái triển khai

URL production: **https://qltaichinh-web.pages.dev/**. Ngày 08/10/2026, sau khi push commit `8ae280d` lên main, Cloudflare đã tự triển khai V2 frontend + Pie Chart. **8/8 E2E trên URL thật** qua desktop/mobile Chromium đạt, gồm offline, backup/restore và biểu đồ. Fixture IndexedDB V1 nâng lên V2 giữ nguyên dữ liệu/số dư. Xem [VALIDATION](VALIDATION.md) để biết phạm vi kiểm tra. iPhone/Safari thật chưa kiểm chứng.

Bản deploy hiện hiển thị **“Chưa cấu hình Supabase”**: chế độ local và biểu đồ hoạt động; đăng nhập/đồng bộ chưa được bật. Cần tạo project, chạy migration và thêm public URL/key vào Cloudflare rồi redeploy theo hướng dẫn bên dưới. Publish môi trường Codex chỉ cập nhật môi trường làm việc; push code lên main mới kích hoạt cập nhật Cloudflare.

V2 cần chạy migration, cấu hình Auth redirects và build frontend với public Supabase URL/key. Xem [SETUP.md](v2/SETUP.md). Chưa có project Supabase của người dùng trong môi trường; không đánh dấu deployment hoặc iOS đã đạt từ kết quả test mô phỏng.
