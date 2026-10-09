# Sửa bộ chọn tài khoản chuyển tiền — 09/10/2026

Form trước đây cho chọn placeholder rỗng, xóa lựa chọn tài khoản nhận khi nguồn trùng đích, và không hướng dẫn khi chỉ có một tài khoản. Select danh mục/tài khoản nhận cũng dùng lại cùng vị trí DOM khi đổi loại giao dịch. Bản sửa giữ danh sách option tài khoản ổn định (disable nguồn tại danh sách nhận), tách danh tính field danh mục/đích, tự chọn đích khác nguồn khi chuyển chế độ và đổi chỗ cặp tài khoản khi đổi nguồn sang đích hiện tại.

Khi thiếu tài khoản, giải thích rõ chuyển tiền cần hai tài khoản khác nhau và chặn Lưu chưa hợp lệ. Có thể thêm tài khoản ngay trong form qua FinanceService hiện có; số tiền, ngày, ghi chú và loại giao dịch được giữ khi thêm/hủy. Không đổi schema hay quy tắc số dư/thu chi.

49 unit tests, TypeScript/build và 10 E2E desktop/mobile Chromium đạt. Sau chỉnh vị trí hướng dẫn trong form thêm tài khoản, build và 2 regression E2E chuyển tiền chạy lại đạt. Regression kiểm tra một tài khoản, thêm/hủy tài khoản thứ hai không mất draft, đổi nguồn/đích, đổi qua lại loại giao dịch, lưu/reload/export đúng ID và số tiền; chuyển tiền vẫn không cộng vào thu/chi. Chưa kiểm chứng trực tiếp native picker trên iPhone/Safari thật; ảnh người dùng cho thấy tình trạng form nhưng không đủ xác nhận một lỗi engine Safari riêng.

# V2 + biểu đồ đã triển khai — 08/10/2026

Đã push commit `8ae280d8a40ed3156fb3c71d7898025c1a2db2f6` lên `origin/main`; native Git xác nhận remote ref. Cloudflare đã tự cập nhật tại **https://qltaichinh-web.pages.dev/**, entry asset `index-DBVeIlf6.js`, có `ExpensePieChart-PBfC_Bnh.js`. **8/8 E2E trên URL production mới đã đạt** ở desktop/mobile Chromium: CRUD, backup/restore, reload, responsive, PWA offline và Pie Chart đổi tháng/chọn danh mục/ngoại trừ thu nhập–chuyển tiền–xóa mềm.

Kiểm tra bổ sung trên origin production với native IndexedDB fixture V1 trong context riêng: version 10 (Dexie schema 1) nâng lên version 20 (schema 2); toàn bộ account/transaction payload và ID giữ nguyên; số dư 75.000 VND, biểu đồ khoản chi 25.000 VND đúng sau reload. Đây là fixture nâng schema trình duyệt, không phải thử nâng service worker trên điện thoại của người dùng.

Màn hình Cài đặt của bản đã deploy xác nhận **“Chưa cấu hình Supabase”**. V2 frontend và biểu đồ đã có trên website nhưng cloud sync chưa bật. Chưa kiểm chứng Auth/email/RLS trên project Supabase thực hoặc iPhone/Safari. V3 chưa được triển khai. GitHub API vẫn bị Forbidden, nên không khẳng định CI GitHub đã đạt từ kết quả local.

Kết quả trước push: 49/49 unit tests, build và 8/8 E2E local đạt. Các đoạn phía dưới là lịch sử trước khi cập nhật repo/deployment, không phải trạng thái mới nhất.

# Kiểm chứng sau Publish môi trường — 08/10/2026

Quyền truy cập `https://qltaichinh-web.pages.dev/` đã có hiệu lực: HTTPS trả 200, header CSP và assets đọc được. Trình duyệt xác nhận bản đang chạy trước lần cập nhật này là **V1**, không có đăng nhập/cloud hoặc Pie Chart mới. Toàn bộ **6/6 E2E V1 trên URL thật** đã đạt ở desktop/mobile Chromium: CRUD, tính tiền, backup/restore, reload, offline, routing và viewport. Test dùng browser context riêng cùng dữ liệu giả; không thay dữ liệu cá nhân của chủ app và không thay thế thử iPhone/Safari.

Chromium trong sandbox ban đầu báo lỗi chứng chỉ vì kho NSS chỉ đọc. Chạy trình duyệt với quyền truy cập NSS phù hợp đã giải quyết; vẫn giữ kiểm tra HTTPS, không dùng `ignoreHTTPSErrors`. HTTPS đi qua proxy đã cấu hình, không đi vòng proxy. GitHub API trả Forbidden nên chưa xác nhận CI qua API; native Git đọc được repo.

Trước khi cập nhật repo: 49 unit tests và production build chạy lại đạt. Mã V2 + biểu đồ được chuẩn bị cho nhánh `main` theo yêu cầu đưa mã lên Git ban đầu và tiếp tục tự động triển khai của chủ app. Các ghi chú “chưa push/deploy” phía dưới ghi lại trạng thái tại những lượt trước. Supabase URL/key và quyền quản trị Cloudflare/Supabase vẫn chưa có; frontend có thể triển khai ở chế độ local, chưa được đánh dấu đồng bộ V2 hoàn tất hoặc bắt đầu V3.

# Tự động kiểm chứng bổ sung — 08/10/2026

Theo yêu cầu tự thực hiện kiểm tra, đã chạy lại TypeScript, **49/49 unit tests**, SQL trên PostgreSQL 17 và **6/6 cloud E2E** desktop/mobile; tất cả đạt. Cloud E2E vẫn dùng HTTP mock. Build production có cấu hình cloud giả của test cũng đạt. Kết quả 8 E2E giao diện/biểu đồ ở lượt trước vẫn giữ nguyên; không thay source ứng dụng trong lượt kiểm chứng bổ sung.

Đã thêm và chạy thành công `npm run test:http`: PostgreSQL 17 + PostgREST 12.2.3 thật trong các container/network riêng, migration thật và HTTP thật. Xác minh JWT có chữ ký/hết hạn/chữ ký sai, anonymous denial, RLS hai user, chặn ghi trực tiếp, tham số RPC đặt tên, CAS cạnh tranh, replay idempotent và replay đổi nội dung bị từ chối, soft-delete pull, pagination, FK khác chủ sở hữu, staging chưa xuất bản và initialize lặp lại. JWT là danh tính test tự ký; không chạy GoTrue/SMTP. Fixture tự dọn dẹp, chỉ publish cổng loopback ngẫu nhiên. CI đã được bổ sung lệnh này nhưng chưa chạy trên GitHub.

Kiểm tra cấu hình runtime chỉ đọc tên/trạng thái: không có `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, Supabase management token hoặc Cloudflare token. Hai biến public đã có trong yêu cầu cấu hình môi trường, chưa được cung cấp giá trị. Không có công cụ truy cập iPhone thật. Những thiếu hụt này không thể giải quyết bằng cách coi fixture cục bộ là production.

Chủ app đã cung cấp URL `https://qltaichinh-web.pages.dev/`. Yêu cầu HTTPS từ môi trường trả `CONNECT tunnel failed, response 403`, header `server: envoy`; proxy chặn trước khi truy cập site, không phải kết luận Cloudflare/app bị lỗi. Draft cấu hình đã thêm riêng hostname này vào custom allowlist, giữ nguyên các preset. Tool trả `status: saved`, `requires_publish: true`; thử lại vẫn bị proxy chặn do draft chưa áp dụng vào runtime. Cần người dùng lưu/Publish môi trường rồi thử lại kiểm tra bản deploy. Chưa xác minh phiên bản web, biểu đồ, Auth/cloud config, response headers hoặc offline của URL này.

Đã cập nhật [đánh giá kiến trúc V3](v3/ARCHITECTURE.md) theo source V2 hiện tại; tính năng V3 chưa được triển khai theo điều kiện trong brief. Không thực hiện push/deploy.

# Biểu đồ chi tiêu và điều kiện V3 — 08/10/2026

Chủ app xác nhận đã mở và dùng app trên web; chưa xác nhận đồng bộ hai thiết bị, Supabase thật hoặc iPhone PWA. Việc mở web không đủ để đánh dấu V2 hoàn tất. Bản biểu đồ mới hiện ở workspace, chưa push/deploy.

- Thêm biểu đồ tròn dùng chung tại Tổng quan và Báo cáo, số tiền/tỷ lệ từng danh mục, chọn bằng chạm hoặc bàn phím; Báo cáo đổi được tháng.
- Dùng phép tổng hợp chi tiêu hiện có, số tiền integer VND; không đổi schema, auth, outbox hay sync.
- `npm run typecheck`, `npm test` (**49/49**), `npm run build` đạt. Browser suite **8/8** đạt trên desktop/mobile Chromium, gồm 6 bài cũ và 2 bài biểu đồ.
- Kịch bản mới kiểm tra 60%/30%/10% gồm Chưa phân loại; loại trừ thu nhập/chuyển tiền/giao dịch xóa/tháng khác; chọn/bỏ chọn, tháng một danh mục, tháng trống, offline reload và tương tác. Đã xem ảnh desktop/mobile, không tràn ngang.
- Không chạy lại SQL/cloud mock vì thay đổi chỉ ở phần hiển thị; kết quả V2 bên dưới là lần kiểm chứng trước, không phải kết quả dịch vụ production.

V3 dừng ở Milestone 0 theo brief, chờ [các điều kiện còn thiếu](v3/READINESS.md).

# Kiểm chứng V2 — 08/10/2026

**Trạng thái: đã triển khai và kiểm thử trong workspace; chưa nghiệm thu Supabase/Cloudflare production hoặc iPhone thật. V3 chưa bắt đầu.** Chủ app cho biết chưa tạo project Supabase. Không có thao tác commit/push trong lượt V2/V3.

## Kết quả tự động

| Kiểm tra             | Kết quả       | Phạm vi                                                                                               |
| -------------------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run typecheck`  | Đạt           | TypeScript strict cho app/build                                                                       |
| `npm test`           | **49/49 đạt** | 17 test V1 giữ nguyên + auth, migration, outbox, sync, bootstrap, profile, scheduler, adapter         |
| `npm run test:sql`   | Đạt           | PostgreSQL 17 thật, role migration không SUPERUSER, RLS/CAS/constraints/idempotency/journal/bootstrap |
| `npm run build`      | Đạt           | Production build, manifest, precache; không còn cảnh báo chunk > 500 kB                               |
| `npm run test:e2e`   | **6/6 đạt**   | CRUD/tính tiền/backup/restore/reload/offline/viewport V1 trên desktop + mobile Chromium               |
| `npm run test:cloud` | **6/6 đạt**   | 3 luồng V2 × desktop/mobile Chromium, dùng HTTP mock Supabase                                         |

Kiểm tra bổ sung: package.json khớp dependency declarations của lockfile; CSP local chỉ self, CSP cloud chỉ thêm đúng origin cấu hình; service worker không cache URL Auth/REST. Source không ghi payload tài chính vào console. Build từ chối key đặc quyền/incomplete config. Đã xem ảnh màn hình mobile của bootstrap và conflict panel; kiểm tra không tràn ngang.

SQL suite chạy migration trong database fixture mới bằng một role có CREATEROLE nhưng không SUPERUSER/BYPASSRLS. Quyền CREATE schema và membership dùng để chuyển owner function được thu hồi sau migration; writer không sở hữu bảng. SELECT chỉ thấy dữ liệu mình; direct DML và anonymous RPC bị chặn. Kiểm tra FK khác user, tiền lẻ/0/currency sai, ngày không tồn tại, transfer cùng tài khoản, category type/historical references, budget duy nhất kể cả NULL/nil UUID, CAS đồng thời, lost ACK, pagination, commit order, staging bất biến, publish nguyên tử và initialization cạnh tranh.

Vitest kiểm tra nâng cấp một DB có đúng schema V1, giữ ID/dữ liệu, atomic domain+outbox rollback, coalesce trước gửi, successor trong lúc gửi, snapshot form cũ, logout/expired session, late callback, user isolation và giữ nguồn legacy. Có kịch bản A–E bằng hai DB độc lập, ACK qua pull của tab khác, cursor nguyên tử, parent-delete/local-child conflict, bounded retry/manual retry và foreground kiểm tra kết nối.

Browser V2 dùng Supabase SDK thật nhưng chặn HTTP bằng fixture. Luồng gồm đăng nhập, xác nhận nguồn dữ liệu, upload/download, hai browser contexts, offline reload, xung đột với cả hai bản, backup nguồn local cũ, chặn full restore cloud, logout A → B, và quay lại A để gửi phần còn chưa đồng bộ. Fixture tự chặn RPC khi giả lập mất mạng vì route fulfillment của Playwright có thể vượt qua offline emulation. Các test dùng dữ liệu giả; không chứng minh email/SMTP/Auth server hoặc PostgREST production đã hoạt động.

## Điều kiện còn thiếu để hoàn tất V2

- Tạo project Supabase của chủ app; chạy migration và cấu hình Email Auth/redirect URL.
- Cấu hình `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` trên Cloudflare và môi trường Codex, build/deploy bản V2 qua HTTPS. Chưa có deployment V2/URL thực tế được xác nhận.
- Kiểm tra signup/xác nhận email, login/logout, reset/recovery, hết phiên, RLS qua Supabase/PostgREST thật với hai tài khoản test.
- Thực hiện A–G trên PC + iPhone thật, cài standalone, offline đóng/mở lại, reconnect và foreground sau khi iOS suspend. Chromium mobile không phải Safari/iOS.
- Kiểm tra GitHub Actions sau khi người dùng yêu cầu đưa mã lên Git; CI chưa được chạy trên GitHub trong lượt này.

Hướng dẫn cụ thể: [SETUP](v2/SETUP.md). Cần ghi URL, phiên bản thiết bị/iOS/Safari, ngày và kết quả thực tế vào tài liệu này trước khi đánh dấu V2 hoàn tất. Brief V3 yêu cầu dừng nếu V2 chưa đầy đủ; chưa thêm tính năng V3.

---

# Lịch sử kiểm chứng V1

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
