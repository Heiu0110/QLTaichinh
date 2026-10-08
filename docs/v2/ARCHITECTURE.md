# Kiến trúc V2

UI luôn đọc snapshot IndexedDB qua FinanceService được gắn cố định với một hồ sơ. Supabase nằm sau RemoteSyncRepository; trang nghiệp vụ không gọi Supabase. Số tiền vẫn là VND nguyên, số dư suy ra từ giao dịch, transfer trung lập với thu/chi. UUID và metadata/soft delete V1 được giữ.

## Local và phiên đăng nhập

Dexie schema 1 không đổi; version 2 thêm `syncQueue`, `syncRemoteMeta`, `syncState`, `syncConflicts`. Guest V1 dùng `sotien-v1`. Hồ sơ cloud dùng tên chứa project scope và UUID user, không tự seed. Nguồn guest được giữ trong `legacySource` của người dùng, có `claimedBy` để chặn ghi từ tab cũ và không hiện lại dưới guest khi logout. Việc chọn nguồn được ghi nguyên tử; giữ nguồn cũ khi bootstrap thất bại.

AuthService phân biệt mất phiên với logout chủ động. Mất phiên giữ hồ sơ đang dùng và outbox, cho sửa offline; khi cùng user đăng nhập lại sẽ tiếp tục. Logout hủy coordinator/bootstrap, đóng DB, unmount cây UI theo identity và xóa session phụ thuộc user. Dữ liệu user không bị xóa. Các callback giữ service cũ bị từ chối sau khi service nghỉ. Session snapshot được gắn vào Authorization từng RPC, tránh dùng token tài khoản mới cho payload hồ sơ cũ.

IndexedDB và backup không được mã hóa đầu cuối. Local profile hint chỉ phục vụ mở offline, không phải cơ chế chống người đã có quyền truy cập thiết bị/devtools. Không đặt thiết bị dùng chung ở trạng thái còn đăng nhập.

## Outbox và concurrency

Mỗi thao tác nghiệp vụ và enqueue dùng cùng transaction Dexie. Chỉ mutation chưa từng gửi mới được coalesce. Mutation đã attempted giữ nguyên UUID, payload và baseVersion; edit mới tạo successor phụ thuộc nó. ACK chỉ cập nhật remote metadata, gỡ mutation đúng ID và gắn baseVersion cho successor; không thay local desired state. Import/remote apply ghi trực tiếp trong transaction có chủ đích và không enqueue.

Server dùng per-user counter row `FOR UPDATE`, giữ đến commit. Domain write + revision + append-only journal + receipt được commit nguyên tử. Nhờ vậy không xuất hiện revision cao commit trước revision thấp rồi bị cursor bỏ qua. Revision truyền bằng chuỗi thập phân, so sánh bằng BigInt; không dùng client updatedAt để phân thắng thua.

Receipt khóa theo user + mutation UUID, hash SHA-256 của nội dung request. Retry cùng UUID trả cùng kết quả; khác nội dung bị từ chối. Insert chỉ được chấp nhận nếu ID chưa tồn tại. Update dùng CAS baseVersion, kể cả khi giải quyết xung đột. Direct DML bị thu hồi; RPC writer không sở hữu bảng, không LOGIN/BYPASSRLS. RLS áp dụng cả các bảng hạ tầng. FK composite `(user_id,id)` ngăn tham chiếu sang tài khoản khác. Validation server chặn money sai, loại/currency sai, ngày sai, transfer không hợp lệ, duplicate budget và xóa parent còn active child.

Pull journal có upper bound cố định theo lượt, phân trang, tăng cursor cùng transaction apply. ACK không tăng pull cursor. Bản remote cũ không ghi đè metadata mới. Pull thấy mutation của chính mình có thể xử lý như ACK khi hai tab cùng chạy. Web Locks giảm chạy trùng; CAS/idempotency mới đảm bảo tính đúng.

## Bootstrap, xung đột và scheduler

Upload ban đầu gửi batch tối đa 200 bản ghi vào staging. Các batch bất biến và có thể retry; publish toàn bộ dưới user lock sau khi kiểm tra count và cloud còn trống. Các thiết bị không thấy nửa sổ. Download có phân trang và không seed/gộp tên. Chưa ready thì không cho ghi hồ sơ cloud; crash vẫn giữ cursor và nguồn để tiếp tục.

Xung đột lưu cả local/remote, version, mutation ID và lý do. Giữ local tạo UUID mới dựa trên remoteVersion mới nhất; giữ cloud thay record và bỏ các mutation của record sau khi kiểm tra tham chiếu. Nếu cloud chưa có bản record lỗi validation, phải sửa local và thử lại; không âm thầm bỏ bản local. Parent-delete/local-child-create tạo dependency conflict, giữ dataset có tham chiếu hợp lệ. Một form mở trước khi record bị thay đổi không được ghi đè snapshot mới: báo lỗi và giữ nội dung đang nhập.

Coordinator chạy khi startup, session restore, online, foreground, local save debounce và manual. Có tối đa 5 lần tự retry sau lỗi ban đầu với backoff 2/4/8/16/32 giây. Manual/foreground/online mở lượt retry mới. Auth error tạm dừng sync, không xóa hàng đợi. Không dùng setInterval hoặc Background Sync.

Backup vẫn format V1 và whitelist 6 bảng domain/settings; không có auth, queue, cursor, versions, conflict hoặc keys. Full restore chặn ở service cho mọi hồ sơ cloud. CSP build chỉ thêm đúng Supabase HTTPS origin. SW chỉ precache application shell; mọi RPC/Auth dùng network/no-store.

## Kiểm thử và giới hạn nghiệm thu

Vitest dùng fake-indexeddb + FakeRemoteSyncRepository để kiểm tra nhiều thiết bị, retry, conflict, migration, outbox, hủy phiên, bootstrap và scheduler. `npm run test:sql` chạy migration thật trên PostgreSQL 17 bằng authenticated/anon roles trong database fixture mới; không dùng Supabase production. Script chỉ chấp nhận PostgreSQL localhost, tự dọn database do nó tạo.

`npm run test:e2e` kiểm tra toàn bộ V1 với cấu hình local; `npm run test:cloud` build riêng vào `dist-cloud-test` với URL/key giả và chặn toàn bộ HTTP Supabase bằng fixture trong Playwright. Không gọi Supabase thật. Hai browser contexts mô phỏng thiết bị độc lập; mobile Chromium không thay iPhone/Safari.

Chưa có Supabase project, deployment production đã kiểm chứng hoặc kết quả iPhone thật. Email/SMTP, RLS dưới PostgREST thực tế và URL redirects cần kiểm tra sau triển khai. V3 chưa bắt đầu.
