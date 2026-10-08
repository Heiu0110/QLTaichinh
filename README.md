# Sổ tiền — QLTaichinh V1

Web app quản lý tài chính cá nhân bằng tiếng Việt, **local-first**, cài lên màn hình chính dưới dạng PWA. React + TypeScript strict + Vite + Tailwind CSS + Dexie/IndexedDB. Không có backend hoặc đồng bộ cloud trong V1.

## Sử dụng trên điện thoại

Deploy lên **Cloudflare Pages** theo [hướng dẫn này](docs/DEPLOY.md). Sau đó mở URL HTTPS `*.pages.dev`; không cần máy tính chạy server hay mua domain.

- iPhone: Safari → Chia sẻ → Thêm vào Màn hình chính → mở biểu tượng Sổ tiền.
- Android/desktop: chọn Cài đặt ứng dụng trong trình duyệt hỗ trợ PWA.
- Chờ ứng dụng tải đầy đủ lần đầu. Vào Cài đặt kiểm tra trạng thái đã lưu offline. Sau đó app vẫn mở và nhập dữ liệu khi mất mạng.
- App có thông báo khi có bản cập nhật. Lưu form đang nhập rồi nhấn Cập nhật.

**Dữ liệu tài chính lưu trên từng thiết bị/trình duyệt, không lưu lên GitHub và chưa tự đồng bộ.** Máy công ty, máy nhà, Safari và Chrome có kho dữ liệu riêng. Đổi URL, xóa dữ liệu trình duyệt hoặc gỡ PWA có thể làm mất dữ liệu. Xuất backup thường xuyên. Không dùng chế độ riêng tư để lưu lâu dài.

## Tính năng V1

- Tổng quan tài sản ròng, thu/chi và dòng tiền tháng hiện tại, ngân sách và giao dịch gần đây.
- Thêm/sửa/xóa mềm giao dịch; lọc ngày, loại, tài khoản, danh mục và tìm ghi chú.
- Thu nhập, chi tiêu và chuyển tiền giữa hai tài khoản. Chuyển tiền không tính thành thu/chi.
- Tài khoản tiền mặt, ngân hàng, ví điện tử, thẻ tín dụng và khác. Số dư được tính từ số dư ban đầu + giao dịch. Số dư ban đầu âm thể hiện dư nợ.
- 14 danh mục mặc định; tạo/sửa tên/xóa danh mục. Không xóa tài khoản/danh mục đang được bản ghi hoạt động sử dụng.
- Ngân sách theo tháng, cho tổng chi tiêu hoặc danh mục; hiển thị số tiền và phần trăm đã dùng. Tổng ngân sách không cộng trùng ngân sách tổng và theo danh mục.
- Mục tiêu tiết kiệm và hạn hoàn thành. Tiến độ cập nhật thủ công, không tự trừ tài khoản.
- Báo cáo tháng, chi theo danh mục, dòng tiền 6 tháng và số dư tài khoản hiện tại.
- Export toàn bộ database JSON, bao gồm bản ghi đã xóa mềm; import có kiểm tra schema/tham chiếu/ID, số lượng bản ghi và xác nhận **thay thế toàn bộ**. Chưa hỗ trợ Merge.
- Bộ nhớ bền vững nếu trình duyệt cấp quyền; không ảnh hưởng việc sử dụng nếu bị từ chối.

### Tiền và ngày

V1 chỉ hỗ trợ VND. Nhập số nguyên, ví dụ `35000`; không dùng dấu chấm/phẩy. Giới hạn mỗi khoản 1.000.000.000.000 VND. Phép cộng/trừ tiền dùng integer có kiểm tra giới hạn an toàn. Phần trăm là tỷ lệ hiển thị, không dùng để lưu tiền. Giao dịch dùng ngày lịch `YYYY-MM-DD` của người dùng; timestamp metadata dùng ISO UTC.

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
- `src/db`: Dexie schema version 1, seed danh mục/tài khoản rỗng, repository abstraction và implementation local.
- `src/services`: nghiệp vụ tài chính, backup nguyên tử và lưu trữ trình duyệt.
- `src/utils`: tính toán tiền và định dạng ngày/tiền dùng chung.
- `src/hooks`: reactive snapshot qua data service.
- `src/app`, `src/pages`, `src/components`: routing, layout responsive và presentation.
- `tests`: kiểm thử nghiệp vụ, backup và PWA/E2E.

Thay đổi database sau này bằng migration version mới, không sửa lại schema version 1 đã phát hành. `TransactionRepository` có thể thay implementation khi thêm sync. V1 chưa có auth/encryption; backup là JSON plaintext, không chứa secret frontend.

## Làm cùng project trên máy công ty và máy nhà

Mã nguồn nằm ở [Heiu0110/QLTaichinh](https://github.com/Heiu0110/QLTaichinh), nhánh `main`. Trong Codex chọn repo này trên cả ba nơi.

Trên máy phát triển thông thường:

```bash
git clone https://github.com/Heiu0110/QLTaichinh.git
cd QLTaichinh
npm ci
```

Trước mỗi phiên: `git pull --ff-only`. Sau khi hoàn thành: kiểm tra test/build, commit rồi `git push`. Nếu nhiều phiên sửa song song, dùng nhánh riêng và Pull Request, tránh ghi đè công việc. Cloud task đã có checkout cô lập; dùng checkout hiện tại, không tạo worktree trừ khi người dùng yêu cầu.

GitHub chia sẻ **code**, backup chia sẻ dữ liệu thủ công. Để chuyển dữ liệu: xuất JSON ở thiết bị nguồn, chuyển file riêng tư rồi nhập ở thiết bị đích; import sẽ thay thế dữ liệu thiết bị đích.

Yêu cầu gốc: [V1-SPEC](docs/V1-SPEC.md). V2/V3 chưa triển khai.
