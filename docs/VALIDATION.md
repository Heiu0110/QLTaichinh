# Kiểm chứng V1

## Kiểm tra đã thực hiện trong môi trường phát triển

- `npm ci --cache /workspace/.cache/npm`: cài lại dependencies từ lockfile thành công.
- `npm run dev`: giao diện chạy, lưu giao dịch và reload vẫn giữ dữ liệu trong kiểm tra trình duyệt.
- `npm test`: **17/17** kiểm thử nghiệp vụ/data layer đạt, sử dụng fake-indexeddb.
- `npm run build`: TypeScript strict và production build thành công, sinh manifest/service worker và precache toàn bộ application shell + các trang tải theo nhu cầu.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`: **6/6** kịch bản đạt trên Chromium desktop và mobile.

Các kịch bản E2E nhập thu/chi thật qua form, sửa/xóa, lọc, tạo tài khoản/danh mục/ngân sách/mục tiêu, export file JSON và restore. IndexedDB thật vẫn giữ số dư sau reload. Khi browser context offline, app reload/mở trang chưa từng truy cập, nhập thêm giao dịch và reload vẫn giữ dữ liệu. Viewport 375, 390, 430 và 1440 px được kiểm tra tất cả màn hình không tràn ngang. Form từ chối số tiền giao dịch bằng 0.

Unit test kiểm tra chuyển tiền trung lập với thu/chi, integer lớn, số dư ban đầu 0/âm, cùng ngày, đầu/cuối tháng, ngày không tồn tại/năm nhuận, loại trừ soft delete, phần trăm ngân sách vượt 100%, từ chối duplicate budget, orphan references/ID trùng/backup sai schema, và database close/reopen. Restore chạy trong một transaction Dexie duy nhất.

Kết quả kiểm tra không dùng dữ liệu tài chính thật. Database test và browser profile tách biệt khỏi dữ liệu sử dụng thực tế. `test-results/`, `dist/`, `node_modules/` không đưa vào Git.

## Chưa được xác nhận

- Deployment Cloudflare production và URL `.pages.dev`: cần chủ tài khoản kết nối repository theo [DEPLOY.md](DEPLOY.md).
- Cài PWA và standalone/offline trên iPhone/Safari thật: cần kiểm tra sau khi có URL production. Chromium mobile viewport không phải Safari.
- GitHub Actions chạy trên server: cấu hình CI đã có; kiểm tra trạng thái sau push. Kết quả local không thay thế kết quả CI.
- Đồng bộ thiết bị, auth, mã hóa backup và import Merge: ngoài phạm vi V1.

Không đưa dữ liệu quan trọng vào app trước khi thử export/restore trên thiết bị sẽ sử dụng. Dữ liệu local không thay thế backup.
