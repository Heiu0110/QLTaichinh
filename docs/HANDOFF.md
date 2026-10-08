# Handoff cho các phiên Codex tiếp theo

## Đã xây dựng

V1 local-first với 8 trang responsive, các form dữ liệu thật, database Dexie version 1, repository abstraction, business service, backup/restore và PWA offline. Không có backend/auth/cloud sync. Đọc README.md, AGENTS.md và docs/V1-SPEC.md để giữ quy tắc dữ liệu.

## Chạy và kiểm tra

Node 24; `npm ci`, `npm test`, `npm run build`. Khi đổi UI/PWA: build lại trước `npm run test:e2e`. Môi trường có Chromium hệ thống dùng `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. Không đưa file backup cá nhân vào repo. `npm run dev` chỉ dành cho phát triển; điện thoại dùng Cloudflare production URL.

## Việc còn lại cần quyền bên ngoài

Chủ tài khoản Cloudflare đã có tài khoản nhưng môi trường chưa được cấp quyền triển khai. Kết nối repo GitHub với Cloudflare Pages, build `npm run build`, output `dist`, branch `main`, Node 24. Hướng dẫn tại docs/DEPLOY.md. Sau khi có URL, ghi lại URL và kiểm tra HTTPS headers/manifest/offline, rồi kiểm tra iPhone thật. Không ghi rằng V1 đạt toàn bộ điều kiện production/iPhone trước khi có bằng chứng.

## Các phiên làm việc song song

Mỗi phiên bắt đầu từ nhánh/ref mới nhất của GitHub. Dùng nhánh riêng/PR khi nhiều phiên cùng sửa; không force-push để thay đổi lịch sử main. Cloud task có checkout cô lập sẵn, không tạo thêm worktree trừ khi được yêu cầu. GitHub đồng bộ code; dữ liệu tài chính vẫn riêng từng thiết bị. V2/V3 chỉ triển khai khi người dùng cung cấp/yêu cầu phạm vi tương ứng.
