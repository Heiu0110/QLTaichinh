# Sổ tiền — QLTaichinh V2

Web app quản lý tài chính cá nhân bằng tiếng Việt, **local-first**, cài lên màn hình chính dưới dạng PWA. React + TypeScript strict + Vite + Tailwind CSS + Dexie/IndexedDB. V2 thêm Supabase Auth và đồng bộ cloud tùy chọn, giữ IndexedDB làm nguồn dữ liệu cho giao diện. Mã V2 đang được kiểm chứng; xem [thiết lập Supabase](docs/v2/SETUP.md) và [trạng thái nghiệm thu](docs/VALIDATION.md).

## Sử dụng trên điện thoại

Deploy lên **Cloudflare Pages** theo [hướng dẫn này](docs/DEPLOY.md). Sau đó mở URL HTTPS `*.pages.dev`; không cần máy tính chạy server hay mua domain.

- iPhone: Safari → Chia sẻ → Thêm vào Màn hình chính → mở biểu tượng Sổ tiền.
- Android/desktop: chọn Cài đặt ứng dụng trong trình duyệt hỗ trợ PWA.
- Chờ ứng dụng tải đầy đủ lần đầu. Vào Cài đặt kiểm tra trạng thái đã lưu offline. Sau đó app vẫn mở và nhập dữ liệu khi mất mạng.
- App có thông báo khi có bản cập nhật. Lưu form đang nhập rồi nhấn Cập nhật.

**GitHub chỉ chia sẻ mã nguồn, không chứa dữ liệu tài chính.** Ở chế độ local, mỗi trình duyệt có sổ riêng. Khi đã cấu hình Supabase và bật cloud, cùng một tài khoản có thể đồng bộ các thiết bị; dữ liệu vẫn dùng được offline. Đổi URL, xóa dữ liệu trình duyệt hoặc gỡ PWA có thể làm mất dữ liệu. Xuất backup thường xuyên. Không dùng chế độ riêng tư để lưu lâu dài.

## Tính năng

- Tổng quan tài sản ròng, thu/chi và dòng tiền tháng hiện tại, ngân sách và giao dịch gần đây.
- Thêm/sửa/xóa mềm giao dịch; lọc ngày, loại, tài khoản, danh mục và tìm ghi chú.
- Thu nhập, chi tiêu và chuyển tiền giữa hai tài khoản. Chuyển tiền không tính thành thu/chi.
- Tài khoản tiền mặt, ngân hàng, ví điện tử, thẻ tín dụng và khác. Số dư được tính từ số dư ban đầu + giao dịch. Số dư ban đầu âm thể hiện dư nợ.
- 14 danh mục mặc định; tạo/sửa tên/xóa danh mục. Không xóa tài khoản/danh mục đang được bản ghi hoạt động sử dụng.
- Ngân sách theo tháng, cho tổng chi tiêu hoặc danh mục; hiển thị số tiền và phần trăm đã dùng. Tổng ngân sách không cộng trùng ngân sách tổng và theo danh mục.
- Mục tiêu tiết kiệm và hạn hoàn thành. Tiến độ cập nhật thủ công, không tự trừ tài khoản.
- Báo cáo tháng, chi theo danh mục, dòng tiền 6 tháng và số dư tài khoản hiện tại.
- Biểu đồ tròn chi tiêu theo danh mục trên Tổng quan và Báo cáo; chạm danh mục để xem số tiền/tỷ lệ, đổi tháng tại Báo cáo. Hoạt động offline, có nhóm Chưa phân loại; không tính thu nhập, chuyển tiền hoặc giao dịch đã xóa.
- Export toàn bộ database JSON, bao gồm bản ghi đã xóa mềm; import có kiểm tra schema/tham chiếu/ID, số lượng bản ghi và xác nhận **thay thế toàn bộ**. Chưa hỗ trợ Merge.
- Bộ nhớ bền vững nếu trình duyệt cấp quyền; không ảnh hưởng việc sử dụng nếu bị từ chối.

V2 còn có đăng ký/đăng nhập, khôi phục mật khẩu, hồ sơ riêng theo user, upload/download ban đầu có xác nhận, hàng đợi bền vững, retry chống trùng, xung đột có lựa chọn và trạng thái đồng bộ. Full restore chỉ dùng trong sổ local; hồ sơ cloud vẫn xuất backup được.

### Tiền và ngày

App chỉ hỗ trợ VND. Nhập số nguyên, ví dụ `35000`; không dùng dấu chấm/phẩy. Giới hạn mỗi khoản 1.000.000.000.000 VND. Phép cộng/trừ tiền dùng integer có kiểm tra giới hạn an toàn. Phần trăm là tỷ lệ hiển thị, không dùng để lưu tiền. Giao dịch dùng ngày lịch `YYYY-MM-DD` của người dùng; timestamp metadata dùng ISO UTC.

## Phát triển

Cần Node.js **24 LTS** (tối thiểu 22.12).

```bash
npm ci
npm run dev
```

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

PWA/offline phải kiểm tra trên **production build** bằng preview hoặc HTTPS đã deploy. Service worker không bật trong `npm run dev`.

### Kiểm thử trình duyệt

```bash
npx playwright install chromium
npm run build
npm run test:e2e
```

Môi trường Codex có Chromium hệ thống có thể dùng:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Nếu npm cache mặc định không ghi được trong cloud, dùng `npm ci --cache /workspace/.cache/npm`. Test dùng IndexedDB giả lập cho nghiệp vụ và Chromium/IndexedDB thật cho E2E. Viewport mobile không thay thế kiểm tra trên iPhone/Safari thật. Xem [kết quả và kiểm tra thủ công](docs/VALIDATION.md).

## Cấu trúc

- `src/types`: schema Zod và entity UUID/timestamp/soft delete.
- `src/db`: Dexie schema 1 được giữ; schema 2 thêm bảng đồng bộ, hồ sơ user và atomic outbox.
- `src/auth`, `src/sync`: AuthService, bootstrap, coordinator, conflict và remote adapter.
- `supabase/migrations`: SQL, RLS, CAS, journal và receipts.
- `src/services`: nghiệp vụ tài chính, backup nguyên tử và lưu trữ trình duyệt.
- `src/utils`: tính toán tiền và định dạng ngày/tiền dùng chung.
- `src/hooks`: reactive snapshot qua data service.
- `src/app`, `src/pages`, `src/components`: routing, layout responsive và presentation.
- `tests`: kiểm thử nghiệp vụ, backup và PWA/E2E.

Thay đổi database sau này bằng migration version mới, không sửa lại schema version 1 đã phát hành. UI dùng service cố định theo hồ sơ, không gọi Supabase trực tiếp. Backup là JSON plaintext, không chứa auth/queue/metadata đồng bộ hoặc key. V2 dùng TLS + Auth + RLS, không có E2EE.

## Làm cùng project trên máy công ty và máy nhà

Mã nguồn nằm ở [Heiu0110/QLTaichinh](https://github.com/Heiu0110/QLTaichinh), nhánh `main`. Trong Codex chọn repo này trên cả ba nơi.

Trên máy phát triển thông thường:

```bash
git clone https://github.com/Heiu0110/QLTaichinh.git
cd QLTaichinh
npm ci
```

Chỉ thực hiện thao tác Git khi người dùng yêu cầu trong phiên; brief V2/V3 không tự cho phép commit/push. Khi được phép, trước mỗi phiên: `git pull --ff-only`. Sau khi hoàn thành: kiểm tra test/build, commit rồi `git push`. Nếu nhiều phiên sửa song song, dùng nhánh riêng và Pull Request, tránh ghi đè công việc. Cloud task đã có checkout cô lập; dùng checkout hiện tại, không tạo worktree trừ khi người dùng yêu cầu.

GitHub chia sẻ **code**; Supabase đồng bộ dữ liệu khi đã bật cloud; backup chia sẻ dữ liệu thủ công. Để chuyển dữ liệu: xuất JSON ở thiết bị nguồn, chuyển file riêng tư rồi nhập ở thiết bị đích; import sẽ thay thế dữ liệu thiết bị đích.

Yêu cầu gốc: [V1-SPEC](docs/V1-SPEC.md), [V2-SPEC](docs/V2-SPEC.md). [Kiến trúc V2](docs/v2/ARCHITECTURE.md). V3 chờ V2 đạt nghiệm thu trên dịch vụ và iPhone thật.

## Kiểm thử V2

```bash
npm run test:cloud
# Docker: PostgreSQL + PostgREST thật, fixture tự tạo/dọn dẹp, cổng localhost ngẫu nhiên:
npm run test:http
# PostgreSQL 17 fixture cục bộ, cổng 54329; chỉ dùng dữ liệu test:
docker run --rm --name sotien-v2-postgres -e POSTGRES_HOST_AUTH_METHOD=trust -p 127.0.0.1:54329:5432 -d postgres:17
npm run test:sql
docker stop sotien-v2-postgres
```

Nếu container cùng tên đã tồn tại, kiểm tra trước; không dừng database không thuộc bài kiểm thử. `test:sql` tạo/xóa database fixture riêng, không chạy trên production. `test:cloud` dùng HTTP mock và build riêng, không cần Supabase key thật. CI có cấu hình các bước này; kết quả trên GitHub chỉ được xác nhận sau khi thực sự chạy ở đó.

`test:http` tự khởi động PostgreSQL 17 và PostgREST 12.2.3 trong network Docker riêng, áp dụng migration thật, ký JWT thử nghiệm và gửi HTTP thật. Kiểm tra quyền truy cập, tham số RPC, CAS/xung đột, idempotency, phân trang, xóa mềm và bootstrap; tự xóa container/network sau khi chạy. Chỉ dùng dữ liệu giả; không truy cập project cloud, không kiểm chứng GoTrue/email hoặc iOS. Lần đầu Docker cần tải hai image. Quy trình phát triển này không thay yêu cầu kiểm chứng bản deploy V2 trước V3.
