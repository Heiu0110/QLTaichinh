QLTaichinh V3 — Implementation Brief
PROJECT: QLTaichinh / Sổ tiền
PHASE: V3 — Automation, Import, Planning & Financial Intelligence

IMPORTANT:
V3 must be implemented only after V2 multi-device sync is stable and
its regression/security tests pass.

Do not weaken V1/V2 guarantees to add V3 features.

1. Mục tiêu V3
   V3 phải nâng ứng dụng từ:
   Nhập giao dịch
   → xem dashboard
   → sync nhiều thiết bị

thành:
Nhập / import
↓
Tự phân loại
↓
Theo dõi định kỳ
↓
Ngân sách + kế hoạch
↓
Cảnh báo
↓
Phân tích tài chính
↓
Đề xuất hành động

V3 ưu tiên giảm số thao tác thủ công của người dùng. 2. Preconditions — V2 phải đạt trước
Trước khi sửa code V3, Codex phải xác nhận V2 thực sự có:
Auth
Per-user local DB
Offline outbox
Idempotent sync
Incremental pull
Soft-delete sync
Conflict detection
RLS
User isolation
Backup
PWA offline

Chạy baseline:
npm run typecheck
npm test
npm run build
npm run test:e2e

Nếu V2 chưa hoàn thành, không giả lập rằng V2 đã tồn tại.
Dừng và báo rõ missing prerequisite. 3. Preserve all existing invariants
Không thay đổi:
local-first
offline-first
IndexedDB runtime source
UUID
soft delete
integer VND
YYYY-MM-DD transaction dates
ISO UTC metadata
derived balances
transfer neutral to income/expense
server-side ownership
RLS
sync conflict guarantees

V3 feature không được query cloud trực tiếp từ UI nếu V2 đã thiết kế UI dựa trên local data. 4. V3 scope
V3 core gồm 7 capability chính:
A. Recurring transactions
B. Transaction templates
C. CSV transaction import
D. Categorization rule engine
E. Advanced budget & cash-flow planning
F. Notifications / reminders
G. Financial insights

Không cố làm toàn bộ ngân hàng/Open Banking trong V3. 5. Recurring Transactions
Cho phép user tạo giao dịch định kỳ.
Ví dụ:
Lương
15.000.000đ
mỗi tháng
ngày 05

Netflix
260.000đ
mỗi tháng
ngày 12

Tiền thuê nhà
6.000.000đ
mỗi tháng
ngày 01

Entity concept:
RecurringTransaction {
id
type

amount
accountId
toAccountId?
categoryId?

note?

frequency:
| daily
| weekly
| monthly
| yearly

interval

startDate
endDate?

dayOfMonth?
dayOfWeek?
monthOfYear?

autoCreate
reminderDaysBefore?

lastGeneratedDate?
nextOccurrenceDate

createdAt
updatedAt
deletedAt
}

Không dùng free-form cron cho user-facing recurrence. 6. Recurrence correctness
Phải xử lý rõ:
29/30/31
February
leap year
timezone
month boundary
DST không được làm đổi calendar date

Ví dụ recurring ngày 31:
January → 31
February → ngày cuối tháng
March → 31

hoặc policy khác, nhưng phải document và test.
Không dùng:
date + 30 days

để đại diện “monthly”. 7. Generated transaction identity
Không được tạo duplicate nếu app mở nhiều lần.
Mỗi occurrence cần deterministic identity hoặc unique occurrence key.
Concept:
recurringRuleId + scheduledDate

unique.
Ví dụ:
rule abc
2026-11-01

chỉ được sinh một transaction.
Sync retry cũng không được sinh bản thứ hai. 8. Auto-create vs reminder mode
Hai mode:
Automatic
Reminder only

Automatic:
occurrence tới hạn
→ transaction được tạo

Reminder only:
occurrence tới hạn
→ user confirm
→ transaction được tạo

Với các khoản không cố định, nên dùng reminder. 9. Không phụ thuộc background iOS
Recurring generation phải đúng dù app đóng nhiều ngày.
Khi app mở:
last evaluation
→ today
→ calculate missed occurrences
→ generate idempotently

Không phụ thuộc:
setInterval
background JS

Nếu có backend scheduler sau này, đó chỉ là enhancement. 10. Transaction Templates
Cho phép lưu template để nhập nhanh.
Ví dụ:
Ăn trưa
Grab
Xăng xe
Gửi bố mẹ

Template lưu:
type
default account
category
amount optional
note optional
destination account optional

Không phải transaction thật.
Không ảnh hưởng report/balance. 11. Quick Add UX
Mobile cần:

- Chi tiêu
- Thu nhập
- Chuyển tiền

Sau đó:
Recent
Favorites
Templates

Mục tiêu:
common transaction
≤ 3 taps after amount

Không redesign toàn app. 12. CSV Import
V3 phải hỗ trợ import giao dịch từ file CSV.
Đây là bước thực tế trước khi tích hợp trực tiếp ngân hàng.
Flow:
Select CSV
↓
Detect delimiter / encoding
↓
Preview
↓
Map columns
↓
Normalize
↓
Validate
↓
Detect duplicates
↓
Categorize
↓
Confirm
↓
Atomic import

13. Generic CSV mapper
    Không hard-code duy nhất một ngân hàng.
    User có thể map:
    Date
    Description
    Amount
    Debit
    Credit
    Reference
    Account

Hỗ trợ ít nhất hai dạng:
signed amount

hoặc

debit column + credit column

14. Import profiles
    Cho phép lưu mapping profile.
    Ví dụ:
    Vietcombank CSV
    Techcombank CSV
    Momo export
    Custom CSV

Không chứa secret.
Profile chỉ chứa cấu hình parser/mapping. 15. CSV parsing safety
Phải xử lý:
UTF-8 BOM
comma
semicolon
quoted comma
quoted newline
blank rows
invalid dates
invalid amounts
large files

Không tự parse CSV bằng:
line.split(',')

Dùng parser đáng tin cậy. 16. Preview before import
Không import ngay sau khi upload.
Hiển thị:
128 giao dịch hợp lệ
3 giao dịch nghi trùng
2 dòng lỗi

Cho user review trước. 17. Import duplicate detection
Không dựa duy nhất vào:
date + amount

vì hai giao dịch có thể giống nhau.
Fingerprint có thể dựa vào:
normalized date
amount
direction
account
description/reference

Nếu nguồn có reference ID:
ưu tiên reference.
Phải phân biệt:
exact duplicate
probable duplicate
new transaction

Không tự bỏ probable duplicate mà không thông báo. 18. Import atomicity
Nếu user xác nhận 500 records:
all valid accepted rows

phải được import nhất quán.
Mỗi imported record vẫn phải đi qua:
domain validation
outbox
sync

Không bypass FinanceService chỉ vì import bulk.
Có thể cung cấp bulk API trong service để tối ưu. 19. Import source metadata
Có thể thêm local/domain metadata thích hợp:
source
externalReference
importBatchId

Không hiển thị tất cả trên UI mặc định.
Phải cân nhắc backup + sync compatibility.
Schema migration bắt buộc nếu thêm field. 20. Categorization Rule Engine
User có thể tạo rule:
Nếu ghi chú chứa "GRAB"
→ category = Di chuyển

hoặc:
Nếu description chứa "HIGHLANDS"
→ Ăn uống

Rule concept:
CategorizationRule {
id
name
priority
enabled

conditions[]
actions[]

createdAt
updatedAt
deletedAt
}

21. Supported rule conditions
    V3 chỉ cần deterministic rules:
    description contains
    description startsWith
    description equals
    amount greater than
    amount less than
    account equals
    transaction type equals

Không cần scripting.
Không cho user nhập JavaScript expression. 22. Rule actions
V3 core:
set category
set note/tag if tags are implemented

Không để rule thay amount.
Không để rule tự chuyển tiền giữa account. 23. Rule priority
Nếu nhiều rule match:
priority ASC

hoặc contract tương tự.
Behavior phải deterministic.
UI phải cho user reorder priority. 24. Rule explainability
Mọi auto-category phải biết:
which rule matched

Ví dụ:
Tự phân loại bởi:
"Grab → Di chuyển"

Cho phép undo.
Không có “magic classification” không giải thích được. 25. Optional smart suggestions
Sau deterministic rules ổn định mới được thêm heuristic:
previous merchant/category history

Ví dụ:
10 giao dịch "ShopeeFood"
9 lần thuộc Ăn uống

→ suggest Ăn uống

Chỉ suggestion.
Không tự apply nếu confidence thấp. 26. AI categorization
Không thuộc V3 core.
Nếu thêm thử nghiệm AI:
opt-in
never required

Không gửi toàn bộ transaction history ra provider không cần thiết.
Không block import nếu AI unavailable.
Deterministic rule engine phải hoạt động độc lập. 27. Advanced Budgeting
Nâng budget hiện tại từ:
monthly category limit

thành:
monthly planning

Cho phép:
planned income
planned expenses
category budget
savings allocation

28. Budget rollover
    Optional V3 feature:
    Budget 3,000,000
    Spent 2,500,000
    Remaining 500,000

User chọn:
No rollover
Rollover remaining

Không mặc định rollover. 29. Overspending state
Budget states:
safe
warning
near limit
over budget

Threshold có thể:
80%
100%

hoặc user setting.
Không dùng màu làm tín hiệu duy nhất. 30. Cash-flow Planning
Tạo forecast ngắn hạn.
Ví dụ:
Expected income +
current balances
-

known recurring expenses
=

projected balance

Cho:
7 days
30 days
end of month

31. Forecast limitations
    Forecast phải phân biệt:
    confirmed
    scheduled
    estimated

Không hiển thị estimate như số dư thật.
Ví dụ:
Số dư hiện tại: 8.500.000
Dự kiến cuối tháng: 4.200.000

32. Savings Goal automation
    V1 currentAmount cập nhật thủ công.
    V3 có thể hỗ trợ:
    manual progress

và:
linked savings account

hoặc:
linked transfer transactions

Không double-count. 33. Goal allocation
Có thể tạo rule:
10% income
→ goal Quỹ dự phòng

Nhưng V3 core nên chỉ tạo recommendation/reminder.
Không tự chuyển tiền thật.
App không phải banking execution platform. 34. Notifications
V3 thêm Notification Center.
Types:
upcoming recurring transaction
budget warning
budget exceeded
savings deadline
uncategorized imported transactions
sync unresolved conflict
backup reminder

35. Notification architecture
    Phân biệt:
    In-app notifications

và:
Push notifications

In-app phải luôn hoạt động.
Push là optional enhancement. 36. Web Push / iOS
Nếu triển khai push:
phải hoạt động với constraints của installed PWA.
Không giả định browser tab luôn chạy.
Push subscription phải:
opt-in
revocable
device-specific

Không xin permission ngay khi user mở app lần đầu.
Chỉ xin khi user bật tính năng có ý nghĩa. 37. Server notification scheduler
Nếu cần push đúng thời điểm khi app đóng:
Supabase / server scheduler
→ notification jobs
→ Web Push provider

Không dùng service worker timer làm scheduler. 38. Notification privacy
Push message mặc định không nên hiện dữ liệu quá nhạy cảm.
Thay vì:
Bạn vừa vượt ngân sách Ăn uống 3.845.000đ

default nên có option:
Ngân sách của bạn cần chú ý

User có thể bật detailed notifications. 39. Financial Insights
Không bắt đầu bằng chatbot.
Trước tiên implement deterministic insight engine.
Ví dụ:
Chi tiêu tháng này tăng 18% so với tháng trước.

Ăn uống chiếm 31% tổng chi.

Ngân sách Mua sắm đã dùng 92%.

Dòng tiền trung bình 3 tháng đang âm.

40. Insight correctness
    Mỗi insight phải có:
    metric
    comparison period
    calculation source

Không kết luận nguyên nhân nếu chỉ có correlation.
Không nói:
Bạn tiêu quá nhiều vì...

nếu data không chứng minh được. 41. Insight types
V3 core:
month-over-month income change
month-over-month expense change
category concentration
budget risk
cash-flow trend
recurring expense total
savings progress
unusual expense

42. Unusual expense detection
    Dùng rule/statistics đơn giản, explainable.
    Ví dụ:
    expense > 2x median of category recent transactions

hoặc phương pháp robust tương tự.
Không cần ML model.
Phải nói:
"Cao hơn mức thường thấy"

không phải:
"giao dịch bất thường/fraud"

43. Reports V3
    Nâng Reports:
    3 / 6 / 12 month trend
    income vs expense
    category trend
    account balance history
    recurring expense share
    budget adherence
    savings rate

Không tính chart bằng floating money. 44. Net worth history
V1 chỉ có current derived balance.
V3 có thể tạo historical series bằng cách replay transactions:
initial balance +
transactions <= date

Không lưu duplicate balance snapshot trừ khi performance buộc phải cache.
Nếu cache:
cache phải derivable/rebuildable. 45. Search & Filters
Transactions V3 cần:
full date range
amount range
category
account
type
import source
recurring/generated
uncategorized

Không query Supabase trực tiếp để search.
Search local DB. 46. Tags — optional but recommended
Có thể thêm tags:
Công việc
Gia đình
Du lịch
Hoàn tiền

Một transaction có nhiều tag.
Nếu implement:
không dùng category thay cho tag.
Category = accounting purpose
Tag = flexible context

47. Debt & Credit Card scope
    Không xây hệ thống khoản vay đầy đủ ở V3 core.
    Nhưng credit account hiện tại nên có thể thêm:
    statement day
    payment due day
    credit limit

để cảnh báo.
Nếu scope phình lớn:
đưa Advanced Debt sang V3.1/V4. 48. Installments
Không bắt buộc V3.0.
Nếu triển khai:
một purchase installment phải có:
parent installment plan
generated monthly transaction

không duplicate principal. 49. Backup improvements
V3 nên bổ sung:
automatic backup reminders
backup metadata
backup history status

Không tự upload backup vào public storage. 50. Versioned restore
Consider:
backup schema V2

chỉ nếu domain contract thực sự thay đổi.
Không bump backup version chỉ vì app version = 3. 51. Cloud snapshot safety
Nếu V2 cloud sync đã ổn định, V3 có thể bổ sung server snapshot.
Ví dụ:
daily encrypted-at-rest server backup

nhưng không gọi sync history là backup.
Restore phải có dry-run preview. 52. Encryption decision
V3 không nên vừa làm automation vừa ép E2EE vào cùng release.
Client-side E2EE thay đổi sâu:
server validation
search
rules
notification content
recovery
multi-device key distribution

Vì vậy:
V3 core = no E2EE

Nếu muốn E2EE:
làm separate milestone:
V3-Security / V4

với design review riêng. 53. Local App Lock
V3 có thể thêm app-level privacy lock:
PIN / biometric capability where browser permits

Nhưng đây không phải encryption-at-rest.
Không quảng bá như encryption.
Nếu browser API không đảm bảo cross-platform, cho phép bỏ scope. 54. Performance
V3 bắt đầu có nhiều transaction hơn do import.
Phải test:
1,000
10,000
50,000 transactions

Các trang không được gọi:
load everything + recompute everything

mỗi render nếu có thể tránh. 55. IndexedDB indexes
Review index cho:
date
accountId
categoryId
type
updatedAt
importBatchId
recurringRuleId

Chỉ thêm index nếu query thực sự dùng.
Dexie schema migration mới bắt buộc. 56. Aggregate performance
Có thể sử dụng:
query-level filtering
memoized selectors
incremental aggregates

Nhưng cached aggregates phải rebuildable.
Domain records vẫn là source of truth. 57. Sync compatibility
Mọi entity mới cần xác định:
local only?
user synced?
device synced?

Ví dụ:
RecurringTransaction → synced
Template → synced
CategorizationRule → synced
ImportProfile → synced or local depending design
Notification read state → potentially device-local
PushSubscription → device-specific cloud

Không mặc định mọi table đều sync. 58. Entity sync contract
Entity synced mới phải tuân thủ V2:
UUID
user ownership
soft delete
server revision
outbox
idempotency
optimistic concurrency
conflicts
RLS

Không tạo một sync path riêng yếu hơn. 59. Recurring rule conflicts
Nếu PC sửa recurring rule và iPhone sửa offline:
phải dùng conflict system V2.
Không last-write-wins silent. 60. Bulk import + sync
Import 5,000 transaction không được gửi 5,000 network requests tuần tự.
V2 sync layer phải hỗ trợ safe batching.
Giữ:
per-mutation idempotency

nhưng transport có thể batch. 61. Import progress
UI:
Đọc file
→ 20%
Phân tích
→
Xác nhận
→
Import local
→
Đồng bộ cloud

Local import success không được bị rollback chỉ vì cloud offline.
Hiển thị:
Đã nhập trên thiết bị
Đang chờ đồng bộ

62. Accessibility
    V3 UI phải tiếp tục usable bằng:
    keyboard
    screen reader basics
    large text
    mobile touch

Budget warning không chỉ dựa vào màu. 63. iPhone UX
Kiểm tra:
390px
430px
standalone PWA
safe areas
keyboard
bottom navigation
file CSV picker
download/export
Web Push permission flow

Không coi desktop responsive mode là bằng chứng iPhone hoạt động. 64. Financial Insight architecture
Tạo abstraction riêng:
interface Insight {
id: string;
type: InsightType;
severity: 'info' | 'warning';
title: string;
description: string;
metric?: number;
generatedAt: string;
}

Insight engine đọc:
FinanceData

hoặc query service.
Không gọi Supabase. 65. No investment advice
Nếu sau này có AI insight:
không tự biến thành:
mua cổ phiếu
bán tài sản
vay tiền

V3 tập trung personal cash-flow analytics. 66. Architecture proposal
Suggested additions:
src/
├── recurring/
│ ├── recurrence.ts
│ ├── recurringService.ts
│ └── recurringTypes.ts
│
├── import/
│ ├── csvParser.ts
│ ├── mapper.ts
│ ├── duplicateDetection.ts
│ └── importService.ts
│
├── rules/
│ ├── ruleEngine.ts
│ ├── ruleService.ts
│ └── ruleTypes.ts
│
├── insights/
│ ├── insightEngine.ts
│ └── metrics.ts
│
├── notifications/
│ ├── notificationService.ts
│ └── push/
│
└── planning/
├── forecast.ts
└── budgetPlanning.ts

Exact structure may differ.
Không nhét toàn bộ vào FinanceService. 67. Milestone plan
Milestone 0 — V2 audit
Không code V3.
Xác minh:
V2 implementation exists
V2 tests pass
sync stable
security baseline passes

Milestone 1 — Schema / domain preparation
Add:
recurring rules
templates
categorization rules
optional import metadata

Design migrations carefully.
Test upgrade:
V1 → latest
V2 → latest

Milestone 2 — Recurring engine
Implement:
calendar recurrence
missed occurrences
idempotent generation
auto/manual mode

Không notification trước.
Milestone 3 — Templates + quick entry
Implement:
favorites
templates
recent selections
mobile quick-add

Milestone 4 — CSV import
Implement:
parser
mapping
profiles
preview
validation
duplicate detection
bulk local import
sync batching compatibility

Milestone 5 — Rule engine
Implement:
conditions
priority
actions
explainability
undo

Tích hợp CSV import trước.
Milestone 6 — Planning
Implement:
budget planning
rollover optional
cash-flow forecast
goal projections

Milestone 7 — Insight engine
Implement deterministic analytics.
Không AI dependency.
Milestone 8 — Notifications
Implement:
in-app first
push optional
privacy controls

Milestone 9 — Reports & performance
Add richer reports.
Optimize 10k+ datasets.
Milestone 10 — Device validation
Desktop + mobile + installed iOS PWA. 68. Required tests
Ít nhất phải có:
monthly recurrence
end-of-month recurrence
leap-year recurrence
missed occurrence generation
duplicate recurring generation prevention
recurrence after offline period
recurrence sync conflict

CSV quoted comma
CSV UTF-8 BOM
CSV invalid amount
CSV invalid date
CSV duplicate detection
CSV bulk import

rule priority
multiple matching rules
rule disabled
rule undo

budget rollover
forecast calculations
recurring expense forecast
insight month comparison

10k transaction performance smoke test

69. Critical scenario tests
    Scenario A:
    iPhone offline 7 days
    monthly recurring payment becomes due
    app reopened
    exactly one transaction generated
    later syncs to PC

Scenario B:
same CSV imported twice
exact duplicates detected
no silent duplicated balance

Scenario C:
CSV import while cloud offline
local import succeeds
pending sync visible
later sync succeeds

Scenario D:
Rule says GRAB → Di chuyển
CSV import contains GRAB
preview shows predicted category + reason
user can override

Scenario E:
PC edits recurring rule
iPhone offline edits same rule
sync
V2 conflict mechanism activates

70. Non-goals V3
    Không làm trong V3 core:
    direct banking API
    bank credential storage
    screen scraping banking apps
    payment initiation
    stock trading
    crypto portfolio
    shared family finance
    business accounting
    tax filing
    full double-entry accounting
    AI autonomous financial decisions
    client-side E2EE

71. Why no direct bank sync yet
    Không thiết kế V3 quanh việc “kết nối tài khoản ngân hàng” ngay.
    Bank integrations khác nhau theo:
    bank
    country
    API access
    licensing
    security
    availability

CSV import + rules tạo phần lớn giá trị với rủi ro thấp hơn nhiều.
Direct banking nên là project riêng sau khi đánh giá provider/API thực tế. 72. V3 Acceptance Criteria
V3 hoàn thành khi:

1. V1/V2 data survives migrations.
2. Existing sync remains correct.
3. Offline-first still works.
4. Recurring transactions never duplicate occurrences.
5. Missed recurring transactions recover after long offline periods.
6. Templates speed up manual entry.
7. CSV import supports mapping + preview.
8. Duplicate detection prevents accidental double import.
9. Bulk imports remain local-first.
10. Rules auto-categorize deterministically.
11. User can see why a rule matched.
12. Budget planning produces correct integer calculations.
13. Cash-flow forecast clearly distinguishes projected vs actual.
14. Deterministic insights are explainable.
15. Notifications respect privacy/preferences.
16. New synced entities respect RLS/conflict/idempotency.
17. 10k+ transaction datasets remain usable.
18. Existing V1/V2 tests remain green.
19. New V3 tests pass.
20. iOS PWA manual validation passes.

21. First response required from Codex
    Dán đoạn này cuối brief:
    Implement QLTaichinh V3 according to the specification above.

DO NOT MODIFY SOURCE CODE YET.

First inspect the actual current codebase.

Verify whether V2 is truly implemented. Do not assume V2 exists based
only on documentation or branch names.

Return:

1. Current implemented version: V1 / partial V2 / complete V2
2. V2 prerequisite gaps
3. Existing database versions and migration graph
4. Existing sync architecture
5. Proposed V3 entity/schema changes
6. Recurring transaction design
7. Recurrence date policy for 29/30/31 and leap years
8. CSV import architecture
9. Duplicate-detection algorithm
10. Categorization rule engine design
11. Bulk-import + sync strategy
12. Budget/forecast calculation design
13. Insight engine design
14. Notification architecture
15. Local vs synced table classification
16. Expected files/modules to change
17. Migration risks
18. Data-loss risks
19. Performance risks
20. Complete test plan

Do not begin implementation until this architecture review is complete.

If V2 is missing or incomplete, explicitly stop V3 implementation and
list the V2 prerequisites that must be finished first.

Do not perform Git push, PR, merge, branch mutation, or other remote
repository write operations unless explicitly requested.
