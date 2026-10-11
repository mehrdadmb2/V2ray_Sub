# V2ray Sub Radar — Worker + Telegram + D1 Archive

نسخه ارتقای Worker برای `@V2raySubRadarBot`.

## چه چیزهایی اضافه شده؟

- `/text`: ارسال همه کانفیگ‌های Mix به‌صورت متن؛ هر پیام شامل یک بلوک HTML `<pre>` است تا در Telegram با فونت monospace نمایش داده شود و به‌صورت یک بلوک قابل Copy باشد. ارسال در بخش‌های متعدد ادامه پیدا می‌کند تا همه موارد برسند.
- `/history`: انتخاب Snapshotهای ذخیره‌شده قبلی و دریافت فایل کامل یا کانفیگ‌های همان Snapshot.
- `/country` و `/protocol`: انتخاب و دریافت کانفیگ‌ها بر اساس کشور یا پروتکل؛ مثال `/country US` و `/protocol VLESS`.
- آرشیو D1 برای نسخه‌ها و کانفیگ‌های هر Snapshot.
- پاک‌سازی FIFO: قدیمی‌ترین Snapshotهای تاریخی حذف می‌شوند؛ Snapshot آخر هرگز برای آزادسازی فضا حذف نمی‌شود. Snapshotهایی که یک job ارسال متنی فعال استفاده می‌کند هم موقتاً محافظت می‌شوند.
- Sync خودکار با GitHub Actions به جای وابستگی به Cron. این پکیج عمداً Cron را فعال نمی‌کند.
- راهکار برای دو حالت بروزرسانی GitHub: یک Workflow جدا برای Push عادی و یک Step که باید در همان Workflow تولیدکننده Mix.txt قرار بگیرد، اگر آن Workflow با `GITHUB_TOKEN` فایل را Push می‌کند.
- Admin endpoints برای Health، Sync، Status، بررسی SHAها و Telegram webhook.

## ساختار

- `src/index.js`: کد Worker.
- `database/0001_initial.sql`: ساختار اولیه برای نصب کاملاً جدید؛ برای Worker فعلی اجرا نکن مگر واقعاً DB تازه ساخته باشی.
- `database/upgrade_002_archive.sql`: Migration افزایشیِ امن برای D1 فعلی. فقط همین فایل را در DB فعلی اجرا کن.
- `wrangler.toml`: تنظیمات Worker؛ قبل از Deploy مقدار `database_id` را با شناسه فعلی D1 خودت جایگزین کن.
- `../.github/workflows/v2ray-sub-radar-notify.yml`: فایل Workflow که باید در ریشه ریپوی GitHub قرار بگیرد.
- `../GITHUB_ACTION_INLINE_STEP.yml`: Step اختیاری برای اضافه کردن به Workflow موجودی که Mix.txt را با GITHUB_TOKEN می‌سازد و Push می‌کند.

## Secretهای Cloudflare Worker

Secretهای قبلی را نگه دار:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `ADMIN_KEY`

فقط این Secret جدید لازم است:

- `GITHUB_ACTION_SECRET`

مقدار این Secret باید دقیقاً با GitHub Actions Secret به نام `V2RAY_RADAR_ACTION_SECRET` یکسان باشد.

## Secrets در GitHub

در `Settings → Secrets and variables → Actions` این دو Repository Secret را اضافه کن:

- `V2RAY_RADAR_WORKER_URL`: URL پایه Worker، مانند `https://v2ray-sub-radar-bot.<account>.workers.dev`؛ مسیر `/github/action` را اضافه نکن.
- `V2RAY_RADAR_ACTION_SECRET`: همان مقدار `GITHUB_ACTION_SECRET` در Cloudflare.

## محدودیت آرشیو

مقادیر پیش‌فرض نگهداری:

- حداکثر 250 Snapshot.
- حداکثر 25,000 ردیف کانفیگ آرشیوشده.
- حداکثر 300,000,000 بایت برآوردی برای داده‌های آرشیو.

این اعداد guardrail هستند، نه اندازه‌گیری دقیق فایل SQLite روی دیسک. D1 Free سقف 500 MB برای هر دیتابیس دارد؛ برای باقی جدول‌ها و ایندکس‌ها حاشیه می‌گذاریم. اگر هرکدام از سقف‌ها رد شود، قدیمی‌ترین Snapshotها اول حذف می‌شوند؛ Snapshot تازه حفظ می‌شود. Snapshotهای قبل از نصب آرشیو که ذخیره نشده‌اند قابل بازیابی از D1 نیستند، مگر اینکه جداگانه از تاریخچه GitHub بازسازی شوند.

## Worker endpoints

- `GET /health`
- `POST /github/action` — فقط با `X-V2SR-Action-Secret`
- `POST /admin/setup` — با `X-Admin-Key`
- `POST /admin/sync` — با `X-Admin-Key`
- `GET /admin/status` — با `X-Admin-Key`
- `GET /admin/live-debug` — با `X-Admin-Key`

## نکته مهم برای Actionهای داخلی GitHub

GitHub طبق سیاست امنیتی خود، Pushهایی که با built-in `GITHUB_TOKEN` انجام می‌شوند معمولاً Workflow دیگری با رویداد `push` را فعال نمی‌کنند. اگر Workflow شما خودِ `Mix.txt` را تولید و با `GITHUB_TOKEN` Push می‌کند، Step فایل `GITHUB_ACTION_INLINE_STEP.yml` را در همان Workflow و بعد از مرحله‌ای که commit/push را انجام می‌دهد قرار بده. Workflow جدا برای Pushهای عادیِ دستی یا pushهایی که با توکن/کاربر دیگری انجام می‌شوند کار می‌کند.
