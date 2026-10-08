# QLTaichinh V3 — đánh giá kiến trúc cập nhật

Cập nhật 08/10/2026, thay hiện trạng V1 trong report cũ ngoài repo. Đây là thiết kế dự kiến, không phải tính năng V3 đã triển khai. Theo brief, V3 dừng ở Milestone 0 đến khi V2 đạt nghiệm thu đầy đủ.

## 1. Phiên bản thực tế

**V2 đã có implementation, chưa hoàn tất nghiệm thu thực tế (partial V2 theo điều kiện hoàn thành).** Source có `src/auth`, `src/sync`, Supabase SDK, database riêng theo user, outbox/conflict và migration PostgreSQL. `package.json` vẫn ghi 1.0.0; tên version package không phải bằng chứng về phạm vi tính năng.

TypeScript, 49 unit tests, 6 cloud mock E2E và SQL PostgreSQL đã chạy lại đạt. Lượt biểu đồ có 8 E2E UI/PWA đạt. Kiểm tra bổ sung `test:http` dùng PostgreSQL + PostgREST thật kiểm chứng JWT/RLS và protocol RPC; JWT tự ký dành riêng cho test. Xem [VALIDATION](../VALIDATION.md) để phân biệt lần chạy, mock, HTTP thật cục bộ và production chưa kiểm chứng.

## 2. Prerequisite V2 còn thiếu

Auth, database theo user, outbox nguyên tử, idempotency, incremental pull, soft-delete sync, conflict, RLS, backup và PWA offline đều có mã cùng kiểm thử. Không còn kết luận rằng V2 chỉ là tài liệu.

Môi trường thiếu public URL/key Supabase và quyền quản trị Supabase/Cloudflare. Chưa có xác nhận project Supabase, Auth/email/PostgREST production hoặc đồng bộ PC–điện thoại thật. Chủ app mới xác nhận mở và dùng web. Không có quyền truy cập iPhone để tự kiểm chứng standalone/suspend/foreground. Chi tiết các bước còn thiếu ở [READINESS](READINESS.md) và [SETUP](../v2/SETUP.md).

## 3. Version database và migration graph

Đã tồn tại Dexie version 1: accounts, categories, transactions, budgets, savingsGoals, settings. Version 2 giữ nguyên domain và thêm syncQueue, syncRemoteMeta, syncState, syncConflicts. Guest và profile cloud tách biệt. Graph hiện tại: database mới → schema 2; database V1 → schema 2. Schema 1 không được sửa lại.

V3 dự kiến thêm version kế tiếp (schema 3 nếu không phát sinh migration trung gian), kiểm tra cả V1 → latest và V2 → latest có pending/conflict/tombstones. SQL hiện có `202610080001_v2.sql`; V3 phải có migration mới, không sửa lại migration đã triển khai. Backup hiện là format 1 với whitelist domain/settings, không gồm auth/outbox; khi thêm domain cần format mới và reader tương thích format 1.

## 4. Kiến trúc sync hiện có

UI đọc local snapshot từ service của profile hiện tại. FinanceService ghi domain + outbox trong cùng transaction Dexie. SyncCoordinator kích hoạt qua startup/online/foreground/manual, retry có giới hạn; SyncEngine push bản mutation bất biến, ACK/pull áp dụng nguyên tử và kiểm tra phiên bản. SupabaseRemoteSyncRepository dùng token của session đã xác minh, tránh gửi payload user A dưới token B khi đổi tài khoản.

Server có RPC sync_push (CAS/receipt idempotency), sync_pull (journal phân trang và revision), sync_stage/sync_initialize (bootstrap staging rồi publish nguyên tử). RPC writer không sở hữu bảng, không bypass RLS; khóa hàng user clock giữ thứ tự commit. Conflict giữ hai phiên bản để giải quyết rõ ràng. Bootstrap không tự gộp sổ theo tên. Backup không chứa metadata sync; full restore bị chặn trong profile cloud.

Các entity V3 phải mở rộng cùng writer/outbox, registry payload, constraints, RLS, backup và protocol. Trước entity mới cần cơ chế nhận biết client cũ vì Zod/registry V2 hiện từ chối entity/field chưa biết; không được bỏ qua rồi tiến cursor.

## 5. Entity/schema V3 dự kiến

| Thành phần             | Domain bổ sung                                                                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| recurringRules         | type, integer amount, tài khoản nguồn/đích, category, note, frequency, interval, start/end date, day/month selector, automatic/reminder mode, thời gian nhắc; UUID/metadata/soft delete |
| transactionTemplates   | name, type, tài khoản, category, amount/note tùy chọn, favorite, thứ tự; không phải giao dịch                                                                                           |
| categorizationRules    | name, enabled, priority, conditions/actions có enum và schema rõ ràng                                                                                                                   |
| importProfiles         | parser/encoding/delimiter/date-money format/column mapping/source namespace; không lưu secret hoặc toàn bộ CSV                                                                          |
| importBatches          | identity nguồn, số lượng, thời gian xác nhận và provenance tối thiểu; file gốc/preview tạm không sync                                                                                   |
| monthlyPlans           | planned income, expense, savings allocation bằng integer; phần phân bổ category không cộng trùng ngân sách tổng                                                                         |
| transactions           | source, externalReference, importBatchId, importRowKey, recurringRuleId, scheduledDate, rule provenance khi áp dụng                                                                     |
| localNotificationState | notification key, read/dismiss/snooze; riêng thiết bị/profile                                                                                                                           |

Mọi entity sync có ownership, server version, outbox và conflict theo V2. Parent-delete/reference validation phải mở rộng tới recurring/template/rule, không chỉ transaction và budget. Schema SQL/Zod/Dexie/backup/adapter phải thay đổi đồng bộ.

`lastGeneratedDate`/`nextOccurrenceDate` là trạng thái tính được hoặc gợi ý local, không dùng một cursor chung trên cloud để quyết định bỏ qua lần sinh giao dịch trên các máy khác. Tags, credit enhancements, linked-goal automation, rollover và push tách milestone tùy chọn; không đưa thêm mặc định vào core.

## 6. Thiết kế recurring và chống trùng nhiều thiết bị

Tách pure recurrence calculator, recurringService và giao diện quản lý. Calculator trả các calendar occurrence; service kiểm tra account/category/rule còn hợp lệ trước khi tạo qua domain writer có outbox.

Occurrence key là `(user, recurringRuleId, scheduledDate)`. Dùng UUID xác định bằng thư viện UUID chuẩn cho generated transaction; thêm uniqueness local và PostgreSQL cho rule/date, bao gồm cả transaction tombstone. Mở lại app hoặc xóa giao dịch đã sinh không tự sinh lại lần đó.

Đúng UUID thôi chưa đủ: hai thiết bị có thể cùng gửi insert với mutation ID khác nhau. Server cần xử lý create-occurrence qua cùng protocol V2: nếu đã có cùng provenance và cùng nội dung sinh ban đầu thì trả bản canonical; nếu rule revision/nội dung khác hoặc người dùng đã sửa thì dùng conflict, không blind upsert. Pending manual edit không được xóa chỉ vì server báo occurrence tồn tại.

Lưu rule revision/provenance đã dùng để tạo transaction. Sửa rule áp dụng từ effective date xác định và không viết lại các giao dịch đã có. Conflict của rule chưa giải quyết thì tạm ngừng auto-generate phần bị ảnh hưởng, hiển thị việc cần xử lý.

Automatic sinh các lần đã tới hạn khi mở/foreground; reminder mode chỉ tạo khi người dùng xác nhận. Catch-up chia lô để UI phản hồi, progress chỉ tăng sau commit; dừng giữa chừng có thể tiếp tục an toàn. Không dựa vào background iOS.

## 7. Policy lịch ngày 29/30/31 và năm nhuận

Chọn policy “clamp vào ngày cuối tháng đích nhưng giữ anchor gốc”. Ví dụ anchor 31 → 31/01, 28 hoặc 29/02, 31/03. Ngày 29/02 hằng năm → 28/02 năm không nhuận, trở lại 29/02 năm nhuận. Không để việc clamp làm anchor tháng sau bị đổi thành 28.

Dùng phép toán calendar trên YYYY-MM-DD, không cộng 30 × 24 giờ. Weekly định nghĩa ISO weekday thứ Hai=1 tới Chủ nhật=7; interval tính từ start date/chu kỳ anchor. EndDate bao gồm ngày kết thúc nếu trùng occurrence. Kiểm tra interval nguyên dương, tổ hợp selector hợp lệ và start ≤ end.

“Today” được tính theo lịch địa phương khi app foreground; scheduledDate không chuyển thành ngày khác qua UTC/DST. Hai thiết bị khác timezone có thể nhận ra ngày đến hạn khác thời điểm, nhưng cùng scheduledDate vẫn có chung identity. Nếu cần một timezone lập lịch cố định, thêm lựa chọn IANA rõ ràng sau này; không ngầm đổi ý nghĩa ngày V1.

## 8. Kiến trúc CSV import

Dùng parser đã được duy trì như Papa Parse; không split theo dòng/dấu phẩy. Parse/normalize trong worker khi file lớn, bên ngoài transaction IndexedDB.

Pipeline: chọn file → đọc BOM/encoding → gợi ý delimiter/encoding → preview → map cột → chọn rõ date/money format → validate → duplicate check → rules/explanation → user override → confirm → atomic local import → pending cloud sync.

UTF-8/BOM là mặc định. Encoding khác cần decoder được hỗ trợ và preview để người dùng xác nhận; không giả định đoán encoding luôn đúng. Hỗ trợ comma/semicolon/tab, quoted comma/newline, blank row, CRLF và lỗi parser. Không thực thi formula hoặc nội dung CSV như HTML/code.

Signed amount: dương=income, âm=expense theo mapping đã xác nhận. Debit/credit: một phía dương; cả hai có giá trị, zero hoặc format mơ hồ phải báo lỗi. Không tự suy ra transfer chỉ từ dấu tiền. Parse money bằng chuỗi/integers theo format xác định; không dùng parseFloat rồi làm tròn số tiền sai.

Giới hạn ban đầu đề xuất 20 MB/50.000 dòng, hiển thị lỗi vượt giới hạn trước khi commit. Preview phải chỉ rõ dòng hợp lệ/lỗi/exact/probable duplicate và số lượng sẽ nhận; không tự nhập lúc chọn file.

## 9. Phát hiện duplicate

Phân ba nhóm:

- Exact: cùng stable external ID có contract duy nhất trong namespace nguồn/tài khoản; hoặc cùng file/mapping provenance và original row identity đã nhập.
- Probable: fingerprint từ ngày chuẩn hóa, integer amount, direction, account, mô tả/reference chuẩn hóa khớp nhưng không có ID nguồn đủ mạnh.
- New: không có match theo các tiêu chí đó.

Không dùng riêng date+amount. Reference bất kỳ không mặc nhiên là unique ID. Hai dòng cùng ngày/tiền/mô tả có thể là hai giao dịch thật; giữ row ordinal để không gộp mất một dòng trong cùng file.

File fingerprint + row identity giúp phát hiện nhập lại cùng file; nếu file được reorder/re-export hoặc mapping đổi, dùng reference và probable matching, không tuyên bố exact thiếu căn cứ. So với cả dữ liệu đã sync, pending local và tombstone; gặp tombstone phải cho biết đã xóa, không tự phục hồi.

Preview luôn cho biết sẽ bỏ/nhận những dòng nào. Probable duplicate cần quyết định của user. Provenance sync và uniqueness server xử lý race khi hai máy nhập cùng nguồn; không để dedup chỉ tồn tại trong bộ nhớ của một tab.

## 10. Rule engine

Pure deterministic function, không Supabase/script/AI. Điều kiện giới hạn: description contains/startsWith/equals, amount >/<, account, transaction type. Chuẩn hóa text có hợp đồng rõ ràng; không bỏ dấu hoặc biến đổi quá mức một cách ngầm định.

Sắp `priority ASC`, tie-break UUID để hai thiết bị cho cùng kết quả. Core dùng first-match-wins; nhóm điều kiện ALL/ANY được định nghĩa rõ. Rule disabled hoặc soft-deleted không chạy. Category action phải đúng income/expense; transfer không được gán category.

Action core chỉ set category; không thay amount/type/tài khoản. Lưu applied rule ID/revision và giá trị category trước đó. Preview hiển thị lý do; user override thắng kết quả tự động. Undo đi qua writer/outbox và phải kiểm tra giao dịch chưa bị sửa tiếp theo cách khiến undo ghi đè ý định mới.

Tích hợp import trước, sau đó hỗ trợ gợi ý lúc nhập tay. Rule thay đổi giữa preview và confirm phải được phát hiện; không tự áp rule mới mà user chưa review.

## 11. Bulk local import và sync batching

Bổ sung bulk API ở tầng service. Parse và chuẩn bị dữ liệu ở ngoài transaction; khi confirm, kiểm tra lại references/dedup/rule revisions và ghi tất cả accepted rows + provenance + outbox trong một Dexie transaction. Domain/queue lỗi thì toàn bộ lô rollback. Không gọi bulkAdd trực tiếp từ UI.

Đọc/preview có thể hủy; sau khi commit bắt đầu, hiển thị trạng thái rõ thay vì báo hủy khi dữ liệu thực tế đã ghi. Thành công local không rollback vì mạng lỗi; ghi đúng “đã nhập trên thiết bị, chờ đồng bộ”.

Transport sync dùng batch có giới hạn số mutation/kích thước, ví dụ 100 mutation/request. Giữ mutationId/baseVersion và kết quả riêng từng mutation. Dependencies parent trước child; ACK chỉ sau server commit. Response-lost retry dùng lại các UUID; server receipts ngăn áp dụng lần hai. Validation/conflict của một record không làm client xóa các pending record chưa được ACK.

Cần bổ sung batch transport vào V2 đã ổn định và chạy lại toàn bộ kiểm thử concurrency/security, không giảm idempotency hoặc RLS để tối ưu tốc độ.

## 12. Budget và forecast

Monthly plan tách planned income/expense/savings khỏi giao dịch đã xác nhận. Category budgets là phân bổ của tổng, không cộng thêm lần nữa. Savings allocation là kế hoạch, không tự thay số dư hoặc tạo chi phí.

Budget có nhãn chữ và phần trăm: safe (<80%), warning (80–<95%), near limit (95–100%), over (>100%). Threshold có thể cấu hình sau nhưng không chỉ dùng màu. Rollover là opt-in; chọn carry phần dương, phần vượt không tự thành nợ kỳ sau. Tính được từ lịch sử, không tự sửa số dư hoặc tạo giao dịch.

Forecast 7/30 ngày/cuối tháng: số dư hiện tại + thu dự kiến chưa ghi nhận − chi dự kiến chưa ghi nhận. Loại trừ recurring occurrence đã có transaction, không trừ transfer nội bộ khỏi tổng tài sản. Hạch toán riêng ảnh hưởng transfer khi forecast từng tài khoản. Future-dated confirmed transaction cần được phân loại rõ để không vừa nằm trong base vừa cộng lần nữa.

Hiển thị ba nhóm confirmed/scheduled/estimated; giữ tiền nguyên. Tỷ lệ phân bổ dùng phép toán integer/basis points với quy tắc làm tròn được document. Goal manual progress không tự cộng vào tài sản; linked goal là tùy chọn và cần quy tắc tránh phân bổ cùng một khoản cho nhiều mục tiêu.

Lịch sử tài sản cần lưu ý V1 không có openingBalanceDate. Không tự dùng createdAt làm ngày bắt đầu tài chính cho dữ liệu được nhập hồi tố. Khi chưa biết ngày gốc, giới hạn/ghi rõ giả định của historical series hoặc yêu cầu bổ sung trước khi trình bày như số dư lịch sử xác nhận.

## 13. Insight engine

InsightEngine đọc local query service, có metric, source/window, comparison period, sample size và explanation; không chỉ title/description. Mỗi insight có deterministic key để cập nhật/dismiss nhất quán.

Core: thay đổi thu/chi tháng, tỷ trọng category, budget risk, dòng tiền 3 tháng, recurring expense total, savings progress và khoản chi cao hơn mức thường thấy. Khi so tháng chưa kết thúc, dùng MTD với cùng cửa sổ kỳ so sánh hoặc ghi rõ; không so tháng dở với tháng đầy đủ rồi kết luận tăng/giảm thiếu ngữ cảnh.

Mẫu số 0 → mô tả “kỳ trước chưa có chi tiêu”, không hiển thị vô cực. Unusual expense dùng median của các giao dịch trước đó trong cùng category, cửa sổ và số mẫu tối thiểu được document; loại chính giao dịch đang đánh giá. So sánh integer/rational an toàn, không lưu median lẻ như số tiền giao dịch. Dùng câu “cao hơn mức thường thấy”, không kết luận fraud hoặc nguyên nhân.

Không AI dependency, không tư vấn mua/bán tài sản hoặc thực hiện giao dịch ngân hàng.

## 14. Notification architecture

Notification Center local-first, derive từ recurring/budget/goal/unclassified import/conflict/backup age. Key ổn định theo loại + entity + kỳ/occurrence + threshold để không nhắc trùng mỗi lần render. Read/dismiss/snooze thuộc từng thiết bị/profile. Có empty/error/loading và liên kết hành động phù hợp.

Đánh giá khi mở/foreground/sau mutation; không hứa nhắc đúng giờ khi app đóng. In-app hoạt động không cần notification permission. Push là milestone tùy chọn: server scheduler, device subscription có opt-in/revoke, ownership/cleanup khi logout, nội dung mặc định kín đáo. Không dùng service worker timer làm scheduler.

## 15. Local/synced/device-specific

| Dữ liệu                                                                   | Phân loại dự kiến                         |
| ------------------------------------------------------------------------- | ----------------------------------------- |
| Recurring rules, templates/favorites, categorization rules, monthly plans | User-synced qua V2                        |
| Transaction provenance và import batches tối thiểu                        | User-synced để dedup nhiều máy            |
| Import profile không chứa file gốc                                        | User-synced trong thiết kế này            |
| Parser worker state, CSV file/preview tạm, UI filters                     | Local, không sync                         |
| Recurrence evaluation cursor / aggregate cache                            | Local, rebuildable                        |
| Notification read/dismiss/snooze                                          | Device-local trong user profile           |
| Push subscription nếu triển khai                                          | Device-specific cloud, có RLS             |
| Settings hệ thống, auth session, queue/cursor/conflicts                   | Theo biên V2, không đưa vào backup domain |

Không tự đồng bộ mọi bảng. Backend/domain schema mới phải áp cùng server revision, RLS, ownership FK, mutation receipts và conflict; metadata local không đi theo đường đó.

## 16. Module dự kiến

Thêm `src/recurring/`, `src/templates/`, `src/import/`, `src/rules/`, `src/planning/`, `src/insights/`, `src/notifications/` theo responsibility. Bổ sung query service phân trang/selectors và màn hình nhỏ tương ứng, không gom logic vào FinanceService hoặc App.

Mở rộng models, Dexie migrations, repository registry/domain writer, backup schemas, adapter/RPC registry/migrations của V2, Settings, Reports, Transactions filters và quick add. Rule engine/recurrence/forecast/insight phải có pure-function tests. Cập nhật tài liệu contract/upgrade và test data không chứa thông tin cá nhân.

Các đường dẫn auth/sync/SQL đã tồn tại ở V2; V3 mở rộng registry và migration hiện tại, không tạo đường đồng bộ thứ hai.

## 17. Rủi ro migration

- V2 đã có schema 2 và metadata pending/conflict; migration kế tiếp phải giữ nguyên queue, cursor, receipts và dữ liệu chưa gửi.
- Zod V1 strict sẽ từ chối payload có field V3; cần converter/reader versioned và kiểm tra backward compatibility.
- Domain mới thực sự thay đổi backup contract: có thể cần backup schema 2, vẫn đọc backup schema 1; không bump lên 3 chỉ vì app V3.
- Unique occurrence/import indexes cần tiền kiểm tra dữ liệu, không drop record để làm migration qua.
- Old PWA client có thể chưa hiểu entity/field mới. Cần negotiation protocol/minimum client version; không cho full-record update của client cũ xóa field mới, không cho client bỏ qua unknown entity rồi tăng cursor.
- Registry sync, SQL/RLS/constraints, local stores, serializers và backup phải được cập nhật cùng milestone; seed không lặp lại mỗi thiết bị.

## 18. Rủi ro mất dữ liệu / sai số dư

Các tình huống phải chặn: recurring sinh trùng ở hai máy; xóa tombstone làm occurrence bị sinh lại; dedup nhầm hai khoản thật; import một phần nhưng UI báo toàn bộ; queue thiếu record import; rule undo ghi đè chỉnh tay; đổi rule viết lại lịch sử; forecast cộng khoản đã ghi nhận hai lần; rollover/linked goals cộng trùng; restore lúc sync hoạt động; ACK thuộc user cũ cập nhật user mới.

File và draft import phải gắn profile/user identity tại thời điểm chọn. Nếu logout/đổi account trước confirm, hủy khả năng commit draft cũ, không import vào user mới. Không tự upload file ngân hàng lên cloud hoặc log dòng CSV/transaction payload. Backup và bản local chưa sync phải được giữ khi lỗi mạng/auth.

## 19. Hiệu năng

Snapshot hiện tại đọc toàn bộ bảng, tính totals/filter trên arrays và TransactionList render toàn bộ kết quả. Không phù hợp 50.000 transaction nếu giữ nguyên cho mọi render.

V3 cần indexed date/account/category query có giới hạn, pagination/virtualized list, debounce search, memoized selectors và worker parse/rules. Chỉ thêm index thực sự dùng: ví dụ source/importBatchId/recurringRuleId và compound occurrence uniqueness; đo query plan/access pattern trước khi thêm hàng loạt compound index.

Aggregate cache chỉ là dữ liệu tính lại được; cập nhật/invalidated đúng khi edit/delete/restore/remote apply, không là source of truth. Benchmark fixture 1k/10k/50k, đo thời gian mở trang, filter, render, import, memory và số query; chưa có kết quả performance V3 để tuyên bố đạt. Không mở rộng toàn bộ snapshot chỉ để Notifications/Insights chạy lại mỗi lần gõ.

## 20. Kế hoạch kiểm thử đầy đủ

Trước V3: toàn bộ V2 regression/security phải thực thi được và đạt, gồm A–G của brief V2. FakeRemote không thay kiểm thử SQL/RLS thật. Xác nhận user A/B, offline reopen, lost ACK, conflicts, stale callbacks, nhiều tab và bootstrap concurrent.

Sau khi đủ điều kiện, mỗi milestone typecheck + relevant tests + build; E2E cho thay đổi UI/PWA. Giữ nguyên test V1 và V2.

| Nhóm                | Kịch bản bắt buộc                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration           | V1 → latest, V2 → latest với pending/conflicts/tombstones; backup 1 → new reader; old client protocol guard                                 |
| Calendar            | Daily/weekly/monthly/yearly interval; 29/30/31; Feb leap/non-leap/century; start/end; DST/timezone; không trôi anchor                       |
| Recurring           | App offline 7 ngày rồi mở; catch-up; hai tab/hai thiết bị; xóa generated record không tái sinh; rule edit/conflict; auto và confirm         |
| CSV parser          | BOM, UTF-8, encoding được hỗ trợ, comma/semicolon/quoted newline, CRLF, blank rows, file quá lớn, lỗi dòng                                  |
| Normalization       | Date format mơ hồ; số âm/debit-credit; zero/fraction/out-of-range; không dùng float để normalize tiền                                       |
| Duplicates          | Nhập cùng file hai lần; reorder/re-export; external ref; hai khoản thật giống ngày/tiền/mô tả; tombstone; race hai máy                      |
| Atomicity           | Inject lỗi giữa domain/outbox/provenance để toàn lô rollback; offline local success; cancel trước commit; draft user A không ghi vào B      |
| Sync batching       | 5k rows dùng bounded batches; response lost; per-mutation retry/conflict/validation; không mất ACK/pending; cross-user isolation            |
| Rules               | Priority/tie-break, nhiều match, disabled, ALL/ANY, type phù hợp, explanation, manual override, undo sau edit, rule đổi lúc preview         |
| Planning            | Integer sums, actual/scheduled/estimated, recurrence already generated, transfer neutral, future dates, zero denominator, goal double-count |
| Rollover nếu làm    | Off mặc định; carry dương; tháng vượt; edit/delete quá khứ; không biến carry thành tiền tài khoản                                           |
| Insights            | Full-month/MTD windows, không có kỳ trước, category share, median với đủ/thiếu mẫu, giải thích và nguồn dữ liệu                             |
| Notifications       | Key không trùng, threshold bằng chữ, dismiss/snooze, logout isolation, backup reminder; permission/revoke nếu thêm push                     |
| Reports/performance | 3/6/12 months, replay đúng date, openingBalanceDate thiếu; 1k/10k/50k query/render/import, cache rebuild sau remote apply                   |
| Devices             | Desktop keyboard/screen-reader basics; 390/430px; iPhone Safari/PWA thật, safe area, keyboard, CSV picker, export, foreground/reconnect     |

Năm scenario A–E của brief V3 được bao phủ: recurring offline chỉ một lần rồi sync; nhập cùng CSV không double balance; import offline giữ pending; GRAB preview có lý do và override; sửa recurring rule ở hai máy tạo conflict V2.

**Điểm dừng hiện tại:** review kiến trúc đã cập nhật; chưa triển khai tính năng V3. V2 có mã và kiểm thử tự động đạt, nhưng còn thiếu cấu hình dịch vụ thật và nghiệm thu đa thiết bị/iPhone theo brief. API cục bộ không thay thế các điều kiện đó.
