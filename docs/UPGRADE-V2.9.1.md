# V2.9.1 — Deployment Lockfile Fix

Lỗi tái hiện trên source V2.9.0: npm ci báo EUSAGE và Missing: tslib@2.9.1 from lock file. @swc/helpers yêu cầu tslib ^2.9.0 nhưng lockfile cũ chỉ có bản 2.8.1 ở cấp gốc. Các bản ghi dependency đóng gói trong nhánh WASM cũng thiếu.

Đã dùng npm install --package-lock-only --ignore-scripts để npm tạo lại lockfile theo metadata registry, rồi npm ci từ thư mục chưa có node_modules. Giữ nguyên dependency trực tiếp và installCommand npm ci; không đổi sang npm install để che lỗi.

Kiểm tra: npm ci cài thành công 103 package; production webpack build và TypeScript đạt; npm test đạt 83/83. Chưa deploy lên dự án Vercel của Boss.

Triển khai: thay source trên GitHub bằng source bản này, gồm cả package-lock.json. Giữ Node 24.x, Install Command npm ci, Build Command npm run build và các biến Supabase hiện có. Redeploy bản commit mới; ở lần xác minh này bỏ chọn Use existing Build Cache. Root Directory phải trỏ tới thư mục có package.json và vercel.json.

Không cần chạy migration mới. App 2.9.1; database vẫn 2.9.0. Nếu đã chạy SQL quỹ V2.9.0 thì không chạy lại. Nếu chưa chạy, hoàn tất migration V2.9.0 theo hướng dẫn của bản trước.

Phiên bản tiếp theo vẫn là đề xuất V2.10.0 — Travel Readiness & Reminders.
