## Mục tiêu

Xây dựng một **web app quản lý tài chính cá nhân theo kiến trúc local-first**, sử dụng được trên:

- iPhone/iOS
- Android
- Windows/macOS
- Trình duyệt desktop/mobile
- Có thể cài ra Home Screen dưới dạng PWA
- Không cần App Store
- Không cần Google Play
- Không cần mua domain
- Không cần máy tính chạy server liên tục
- Có thể hoạt động khi offline
- Dữ liệu nhập vào được lưu lại trên thiết bị
- Chuẩn bị kiến trúc để sau này đồng bộ nhiều thiết bị

## Stack

Sử dụng:

- React
- TypeScript
- Vite
- Tailwind CSS
- Dexie.js
- IndexedDB
- vite-plugin-pwa
- Web Crypto API khi cần mã hóa dữ liệu
- Deploy Cloudflare Pages

Không sử dụng backend trong V1 nếu chưa cần thiết.

## Kiến trúc

```text
React PWA
    │
    ▼
Application Layer
    │
    ▼
Repository / Data Layer
    │
    ▼
Dexie.js
    │
    ▼
IndexedDB
```

App phải sử dụng kiến trúc local-first.

IndexedDB là database hoạt động chính của app trên từng thiết bị.

Không phụ thuộc vào server local.

Sau khi build/deploy lên Cloudflare Pages, app phải có khả năng chạy độc lập trên điện thoại và máy tính.

## Offline/PWA

Cấu hình PWA đầy đủ:

- Web App Manifest
- Service Worker
- Cache application shell
- Offline fallback
- Installable trên iOS/Android/Desktop
- Icon app
- Theme color
- Standalone display mode

App phải mở được khi mất Internet nếu người dùng đã truy cập/cài app trước đó.

Không thiết kế dựa trên JavaScript chạy background liên tục vì iOS có thể suspend web app.

## Database

Dùng Dexie.js + IndexedDB.

Thiết kế database có version để hỗ trợ migration sau này.

Các bảng chính:

```text
accounts
transactions
categories
budgets
savingsGoals
settings
```

### accounts

```ts
interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'ewallet' | 'credit' | 'other';
  initialBalance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}
```

### transactions

```ts
interface Transaction {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  accountId: string;
  categoryId?: string;
  date: string;
  note?: string;

  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}
```

### categories

```ts
interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}
```

### budgets

```ts
interface Budget {
  id: string;
  categoryId?: string;
  amount: number;
  period: 'monthly';
  month: string;
  createdAt: string;
  updatedAt: string;
}
```

### savingsGoals

```ts
interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  createdAt: string;
  updatedAt: string;
}
```

## Quy tắc tiền tệ

Không sử dụng floating point để xử lý tiền.

Tiền phải lưu dưới dạng integer.

Ví dụ:

```text
35.000 VNĐ → 35000
1.250.000 VNĐ → 1250000
```

Nếu sau này hỗ trợ USD:

```text
$12.35 → 1235 cents
```

Tất cả phép cộng/trừ/sum phải thực hiện bằng integer.

## ID

Tất cả entity phải sử dụng UUID hoặc `crypto.randomUUID()`.

Không sử dụng array index làm ID.

Ví dụ:

```ts
const id = crypto.randomUUID();
```

## Soft Delete

Không xóa vật lý record ngay.

Sử dụng:

```ts
deletedAt: string | null
```

Mục đích là chuẩn bị cho cloud sync trong tương lai.

Các query bình thường phải tự động loại bỏ record đã bị soft-delete.

## Timestamp

Mỗi record quan trọng phải có:

```ts
createdAt
updatedAt
deletedAt
```

Dùng ISO 8601.

Ví dụ:

```text
2026-10-07T08:30:00.000Z
```

Điều này cần thiết để sau này triển khai synchronization.

## Các màn hình V1

### Dashboard

Hiển thị:

- Tổng tài sản
- Thu nhập tháng hiện tại
- Chi tiêu tháng hiện tại
- Số dư
- Ngân sách đã sử dụng
- Giao dịch gần đây

### Transactions

Cho phép:

- Thêm giao dịch
- Sửa
- Xóa
- Filter theo ngày
- Filter income/expense
- Filter account
- Filter category
- Search note

### Accounts

Cho phép:

- Tạo tài khoản
- Tiền mặt
- Ngân hàng
- Ví điện tử
- Thẻ tín dụng
- Khác

Hiển thị balance theo transaction.

Không lưu balance hiện tại riêng nếu có thể derive từ transaction.

### Categories

Có category mặc định.

Expense ví dụ:

- Ăn uống
- Di chuyển
- Mua sắm
- Nhà cửa
- Điện nước
- Giải trí
- Sức khỏe
- Giáo dục
- Khác

Income:

- Lương
- Thưởng
- Kinh doanh
- Đầu tư
- Khác

Cho phép user tạo category mới.

### Budget

V1 chỉ cần budget theo tháng.

Ví dụ:

```text
Ăn uống: 3.000.000
Mua sắm: 2.000.000
Giải trí: 1.000.000
```

Hiển thị:

```text
đã dùng / ngân sách
```

và percentage.

### Savings Goals

Cho phép tạo:

```text
Tên mục tiêu
Số tiền mục tiêu
Số tiền hiện tại
Deadline
```

## Báo cáo cơ bản

Cần có:

- Income theo tháng
- Expense theo tháng
- Expense theo category
- Cash flow
- Account balance

Không cần chart quá phức tạp trong V1.

Ưu tiên correctness của dữ liệu.

## Backup

V1 bắt buộc phải có:

### Export

Export toàn bộ database thành JSON.

Tên file:

```text
finance-backup-YYYY-MM-DD.json
```

### Import

Cho phép import backup JSON.

Trước khi import:

- Validate schema
- Báo số record sẽ import
- Không silently overwrite dữ liệu

Có thể cho lựa chọn:

```text
Replace database
Merge
Cancel
```

V1 có thể chỉ hỗ trợ Replace nếu Merge làm tăng complexity quá nhiều.

## Persistent Storage

Khi phù hợp, yêu cầu browser persistent storage bằng:

```ts
navigator.storage.persist()
```

Không giả định request luôn được browser chấp nhận.

App phải vẫn hoạt động nếu persistent storage không được cấp.

## Security

Không hard-code:

- password
- API key bí mật
- database secret
- private key

Không đưa secret vào frontend.

Hiện tại V1 local-only nên chưa cần authentication.

Thiết kế code sao cho sau này có thể thêm:

- authentication
- encryption
- cloud sync

Không tự triển khai crypto bằng thuật toán tự chế.

Nếu triển khai encryption sau này, sử dụng Web Crypto API / AES-GCM.

## Sync-ready architecture

Chưa triển khai sync trong V1 nhưng code phải chuẩn bị sẵn.

Tạo abstraction:

```ts
interface TransactionRepository {
  getAll(): Promise<Transaction[]>;
  getById(id: string): Promise<Transaction | undefined>;
  create(data: Transaction): Promise<void>;
  update(id: string, data: Partial<Transaction>): Promise<void>;
  remove(id: string): Promise<void>;
}
```

Implementation V1:

```text
DexieTransactionRepository
```

Sau này có thể thêm:

```text
CloudTransactionRepository
SyncService
```

UI không được gọi Dexie trực tiếp ở mọi component.

Tách Data Layer khỏi Presentation Layer.

## Cloud Sync tương lai

Không triển khai trong V1 trừ khi core app đã hoàn thiện.

Kiến trúc tương lai:

```text
iPhone IndexedDB
        │
        ▼
    Sync Engine
        │
        ▼
    Cloud Database
        ▲
        │
    Sync Engine
        ▲
        │
Laptop IndexedDB
```

Có thể sử dụng:

```text
Supabase
```

hoặc:

```text
Cloudflare Workers
+
D1
```

Sync cần xử lý:

- UUID
- updatedAt
- deletedAt
- offline updates
- conflict
- last-write-wins ở phiên bản đầu tiên

## UX trên iPhone

UI phải mobile-first.

Ưu tiên:

```text
375px
390px
430px
```

Không để input quá nhỏ.

Button/touch target phù hợp mobile.

Bottom navigation có thể gồm:

```text
Dashboard
Transactions
Add
Budget
Settings
```

Nút Add Transaction nên dễ truy cập bằng một tay.

Không phụ thuộc hover.

Keyboard mở lên không được che form quan trọng.

Các input số tiền nên tối ưu cho numeric keyboard trên mobile.

## Responsive Desktop

Desktop có thể chuyển sang sidebar.

Ví dụ:

```text
┌──────────────┬──────────────────────────┐
│ Dashboard    │                          │
│ Transactions │        Content           │
│ Accounts     │                          │
│ Budgets      │                          │
│ Reports      │                          │
│ Settings     │                          │
└──────────────┴──────────────────────────┘
```

Không cần làm desktop và mobile thành hai app khác nhau.

## Giao diện

Thiết kế:

- Sạch
- Tối giản
- Tập trung vào số liệu
- Không quá nhiều animation
- Tốc độ thao tác nhanh
- Phù hợp app tài chính

Currency mặc định:

```text
VND
```

Locale:

```text
vi-VN
```

Ví dụ:

```ts
new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND'
})
```

## Cấu trúc source đề xuất

```text
src/
├── app/
├── components/
├── features/
│   ├── accounts/
│   ├── transactions/
│   ├── categories/
│   ├── budgets/
│   ├── savings/
│   └── dashboard/
│
├── db/
│   ├── database.ts
│   ├── migrations.ts
│   └── repositories/
│
├── services/
│   ├── backup/
│   └── storage/
│
├── hooks/
├── utils/
├── types/
└── pages/
```

Không gom toàn bộ logic vào `App.tsx`.

## Yêu cầu chất lượng code

- TypeScript strict
- Không dùng `any` nếu không thực sự cần
- Component nhỏ và rõ responsibility
- Business logic không nhét vào JSX
- Database operations xử lý error
- Validate form
- Không duplicate calculation logic
- Không hard-code dữ liệu trong nhiều component
- Tách currency/date formatting thành utility
- Có empty states
- Có loading states khi cần
- Có error states

## Testing quan trọng

Ít nhất kiểm tra:

- Add income
- Add expense
- Edit transaction
- Delete transaction
- Balance calculation
- Monthly total
- Category total
- Budget percentage
- Export
- Import
- IndexedDB persistence sau reload

Đặc biệt test:

```text
0
số tiền lớn
transaction cùng ngày
xóa record
timezone
cuối tháng
đầu tháng
```

## Điều kiện hoàn thành V1

V1 được coi là hoàn thành khi:

1. App chạy bằng `npm run dev`.
2. Build thành công.
3. Deploy được lên Cloudflare Pages.
4. Có thể mở URL `*.pages.dev`.
5. Cài được lên Home Screen trên iPhone.
6. Sau khi cài, app mở dạng standalone.
7. Có thể nhập income/expense.
8. Reload app vẫn còn dữ liệu.
9. Tắt Internet vẫn mở được app đã cache.
10. Có thể export backup.
11. Có thể restore backup.
12. Không cần máy tính developer bật.
13. Không cần domain riêng.
14. Responsive tốt trên iPhone và desktop.

## Thứ tự triển khai

Không cố làm toàn bộ một lần.

Thực hiện theo thứ tự:

```text
1. Scaffold project
2. Routing/layout
3. Dexie database
4. Accounts
5. Categories
6. Transactions
7. Dashboard
8. Budget
9. Savings goals
10. Backup/restore
11. PWA
12. Offline testing
13. Responsive/iOS testing
14. Production build
```

Sau mỗi bước phải đảm bảo project vẫn build được.

Không triển khai cloud sync cho tới khi local-first V1 chạy ổn định.

## Yêu cầu khi Codex bắt đầu

Trước tiên hãy:

1. Kiểm tra repository hiện tại.
2. Nếu project chưa tồn tại, scaffold React + Vite + TypeScript.
3. Thiết lập cấu trúc thư mục.
4. Cài dependencies cần thiết.
5. Implement database schema bằng Dexie.
6. Tạo các repository abstraction.
7. Sau đó bắt đầu xây UI theo roadmap trên.

Không chỉ tạo mock UI.

Ưu tiên một ứng dụng thực sự có khả năng nhập và persist dữ liệu.
