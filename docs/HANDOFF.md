# Handoff V2 + biểu đồ

Bản sửa chọn tài khoản `f5cd62a` đã push và deploy trên https://qltaichinh-web.pages.dev/ ngày 09/10/2026; 2 regression E2E trên URL production đạt (desktop/mobile Chromium). Người dùng PWA cũ cần nhận bản cập nhật, không xóa IndexedDB/dữ liệu trình duyệt.

Sửa lỗi 09/10/2026: bộ chọn tài khoản chuyển tiền có option ổn định, placeholder không chọn được, đích khác nguồn và đổi chiều không để rỗng. Có thông báo cần hai tài khoản và thêm tài khoản ngay trong form, giữ draft khi thêm/hủy. Xem tests/e2e/transfer-accounts.spec.ts; 49 unit tests, build và 10 E2E Chromium đạt, regression 2/2 chạy lại sau chỉnh hướng dẫn. Không đổi DB/sync; chưa kiểm chứng native Safari trên iPhone thật.

Cập nhật 08/10/2026: mã V2 + Pie Chart đã push lên `origin/main` tại commit `8ae280d8a40ed3156fb3c71d7898025c1a2db2f6`. Cloudflare tự triển khai thành công tại https://qltaichinh-web.pages.dev/. Xem docs/VALIDATION.md và docs/DEPLOY.md; các ghi chú chưa push/proxy 403 ở lịch sử cũ đã được thay bằng kết quả này.

## Đã kiểm chứng

- 49 unit tests, TypeScript/build và 8 E2E local đạt trước push.
- 8 E2E trên URL production V2 đạt ở desktop/mobile Chromium: CRUD, backup/restore, reload, responsive, PWA offline và biểu đồ tương tác/đổi tháng.
- Native IndexedDB fixture V1 trên origin production nâng lên V2 giữ nguyên account/transaction payload, ID, số dư; biểu đồ tính đúng sau reload. Đây là dữ liệu giả trong browser context riêng.
- Lượt trước: SQL PostgreSQL 17, 6 cloud mock E2E và `npm run test:http` (PostgreSQL + PostgREST thật, JWT fixture) đạt. Không dùng các kết quả này để khẳng định Auth/email/Supabase production đã chạy.
- GitHub API bị Forbidden; chưa xác minh trạng thái CI GitHub. Native Git hoạt động và remote main đã được xác nhận.

## Phần còn thiếu

Production hiển thị **Chưa cấu hình Supabase**. Runtime vẫn thiếu VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY và quyền quản trị Supabase/Cloudflare. Thông tin gần nhất từ chủ app: chưa tạo Supabase project. Không có thiết bị iPhone thật để tự kiểm chứng.

Bước tiếp theo là tạo/cấu hình Supabase theo docs/v2/SETUP.md, chạy migration, thêm public URL/key tại Cloudflare và Codex, redeploy rồi kiểm tra Auth/email/RLS và đồng bộ đa thiết bị thật. Không yêu cầu gửi service_role key, database password hoặc secret trong chat. V3 dừng ở review kiến trúc theo brief; docs/v3/ARCHITECTURE.md đã cập nhật đủ 20 mục và docs/v3/READINESS.md ghi rõ các điều kiện còn thiếu.

## Tiếp tục phát triển

Đọc AGENTS.md, README.md, docs/V2-SPEC.md, docs/v2/ARCHITECTURE.md và docs/v2/SETUP.md. Giữ schema Dexie 1, integer VND, user DB isolation, atomic domain/outbox, CAS/idempotency, backup whitelist và giới hạn full restore. Không tự gộp nguồn local/cloud hoặc đồng bộ settings wholesale.

Kiểm tra chuẩn: npm run typecheck, npm test, npm run build; UI/PWA chạy test:e2e, sync/security chạy test:sql + test:http + test:cloud. Chromium hệ thống dùng PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium. Không sửa/build cùng lúc browser suite đang kiểm tra bản build đó.

Truy cập HTTPS production qua proxy đã cấu hình. Chromium trong sandbox có thể báo ERR_CERT_AUTHORITY_INVALID do NSS ở /home/agent/.pki/nssdb chỉ đọc; dùng luồng cấp quyền thích hợp để trình duyệt đọc/ghi kho NSS. Không tắt kiểm chứng HTTPS hoặc đi vòng proxy. Lượt kiểm chứng production đã chạy được bằng quyền phù hợp. URL đã có trong allowlist và người dùng đã Publish môi trường; không yêu cầu Publish lại chỉ vì trạng thái lịch sử cũ.

Giữ checkout hiện tại, không tạo worktree; chỉ thao tác Git trong phạm vi yêu cầu người dùng. Người dùng đã yêu cầu chia sẻ mã lên Git và tự động tiếp tục triển khai trong phiên này, nên V2 + biểu đồ đã được cập nhật lên main. Không cần giữ điều kiện “chưa được phép push” từ các lượt trước làm blocker cho cùng yêu cầu.
