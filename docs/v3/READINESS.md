# V3 — Điều kiện bắt đầu

Cập nhật 08/10/2026. Trạng thái: **V2 đã có mã và kiểm thử trong workspace, chưa đủ nghiệm thu thực tế; chưa triển khai V3.** Chủ app xác nhận mới mở và dùng ứng dụng trên web.

URL đã cung cấp: `https://qltaichinh-web.pages.dev/`. Sau khi chủ app Publish môi trường, HTTPS truy cập được và 6 E2E V1 trên site thật đạt. Trước lần cập nhật repo, site hiển thị V1, không có đăng nhập/cloud hoặc Pie Chart. Việc kiểm thử V1 production không thay nghiệm thu đồng bộ V2.

Theo [brief V3](../V3-BRIEF.md), Milestone 0 yêu cầu kiểm chứng V2 trước khi sửa code V3: “V3 must be implemented only after V2 multi-device sync is stable and its regression/security tests pass.” Biểu đồ chi tiêu là yêu cầu bổ sung độc lập, đã triển khai mà không đổi schema hay sync.

## Hiện trạng

- Dexie version 1 giữ sáu bảng local; version 2 thêm queue, remote metadata, state và conflicts. Chưa có migration V3.
- V2 có Supabase Auth, database riêng từng user, outbox nguyên tử, idempotent push/CAS, incremental pull, soft delete, conflict UI, bootstrap có xác nhận và backup.
- SQL có RLS, quyền ghi qua RPC, kiểm tra quyền sở hữu và journal. Kiểm thử PostgreSQL fixture và cloud HTTP mock đã đạt ở lượt V2; không thay kiểm chứng Supabase production.
- Baseline hiện tại: TypeScript/build đạt, 49 unit tests và 8 E2E desktop/mobile đạt. Xem [VALIDATION](../VALIDATION.md).
- Kiểm tra bổ sung: 6 cloud mock E2E và SQL chạy lại đạt; `npm run test:http` đã kiểm chứng migration/RPC/RLS bằng PostgreSQL + PostgREST và HTTP thật cục bộ. Danh tính JWT test tự ký, chưa kiểm chứng Auth/email production.
- [Review kiến trúc V3 hiện tại](ARCHITECTURE.md) đã cập nhật theo mã V2. Không cần dùng báo cáo cũ coi repo chỉ có V1.

## Còn thiếu trước khi triển khai V3

1. Tạo/cấu hình Supabase, chạy migration và cấu hình public URL/key cho bản deploy V2 theo [SETUP](../v2/SETUP.md). Thông tin gần nhất từ chủ app là chưa tạo project; chưa có xác nhận thay đổi trạng thái này.
2. Kiểm tra đăng ký, email xác nhận, đăng nhập, khôi phục mật khẩu và hết phiên với dịch vụ thật.
3. Hai thiết bị cùng tài khoản đồng bộ tạo/sửa/xóa, offline rồi reconnect không mất hoặc nhân đôi dữ liệu; xử lý xung đột và khởi tạo sổ cloud đúng.
4. Hai tài khoản tách biệt dữ liệu qua Supabase/PostgREST thật và khi đổi tài khoản trên cùng trình duyệt.
5. iPhone/Safari thật: cài PWA, offline đóng/mở lại, foreground sau suspend, đồng bộ phần chờ khi có mạng và kiểm tra backup.

Ghi URL bản V2, thiết bị/phiên bản iOS, ngày và kết quả vào VALIDATION. Không cần gửi mật khẩu hoặc service-role key trong chat. Khi các điều kiện đạt, cập nhật đánh giá kiến trúc V3 theo brief rồi triển khai các milestone; không dùng báo cáo cũ mô tả repo chỉ có V1 làm hiện trạng hiện nay.

Mã V2 + biểu đồ được chuẩn bị đưa lên nhánh main theo yêu cầu Git ban đầu và yêu cầu tiếp tục tự động triển khai của chủ app. Trạng thái triển khai thực tế xem VALIDATION và lịch sử main; không đánh đồng Publish môi trường Codex với deployment Cloudflare.
