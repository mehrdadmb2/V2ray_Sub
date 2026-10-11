# راه‌اندازی v4 از PowerShell — بدون اجرای هیچ فایل ps1

> **برای Bot فعلی:** دیتابیس جدید نساز، توکن تلگرام فعلی را عوض نکن و Migration اولیه `0001_initial.sql` را اجرا نکن. فقط Migration افزایشی را روی همان D1 اجرا کن.

## 0) بکاپ و پوشه کاری

از فایل‌های فعلی `src/index.js` و `wrangler.toml` کپی پشتیبان بگیر. محتویات پوشه `telegram-bot` این بسته را در پوشه محلی پروژه Worker قرار بده. `database_id` داخل `wrangler.toml` باید UUID همان D1 فعلی باشد، نه placeholder.

```powershell
cd C:\V2raySubRadar\telegram-bot
node -v
npx wrangler --version
npx wrangler whoami
```

اگر هنوز وارد Cloudflare نشده‌ای:

```powershell
npx wrangler login
```

## 1) اجرای Migration افزایشی آرشیو

ابتدا در `wrangler.toml` بررسی کن `database_name` دقیقاً نام دیتابیس فعلی تو است. در نسخه قبلی نام `v2ray-sub-radar` بود. سپس:

```powershell
npx wrangler d1 execute v2ray-sub-radar --remote --file=./database/upgrade_002_archive.sql
```

اگر نام D1 در تنظیمات تو متفاوت است، همان نام واقعی را جایگزین کن. این فایل فقط جدول‌های آرشیو را با `CREATE TABLE IF NOT EXISTS` اضافه می‌کند؛ مشترکان و `bot_state` فعلی پاک نمی‌شوند.

برای بررسی جدول‌ها:

```powershell
npx wrangler d1 execute v2ray-sub-radar --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

باید `subscription_snapshots`، `archived_configs` و `text_delivery_jobs` را ببینی.

## 2) Secret جدید برای فراخوانی Worker از GitHub Actions

یک مقدار تصادفی بساز:

```powershell
$ActionSecret = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
Write-Host $ActionSecret
```

مقدار نمایش داده‌شده را موقتاً کپی کن. سپس:

```powershell
npx wrangler secret put GITHUB_ACTION_SECRET
```

همان مقدار را Paste کن. Secretهای فعلی `TELEGRAM_BOT_TOKEN`، `TELEGRAM_WEBHOOK_SECRET` و `ADMIN_KEY` را دوباره نساز و حذف نکن.

## 3) Deploy Worker بدون Cron

```powershell
npx wrangler deploy
```

`wrangler.toml` این بسته عمداً بخش `triggers.crons` ندارد؛ منبع اصلی Sync، GitHub Actions است.

Health را بررسی کن:

```powershell
$WorkerUrl = "https://YOUR-EXISTING-WORKER.workers.dev"
Invoke-RestMethod -Uri "$WorkerUrl/health"
```

آدرس را با URL واقعی Worker جایگزین کن.

## 4) Telegram Webhook را حفظ/تأیید کن

با `ADMIN_KEY` فعلی:

```powershell
$AdminKey = Read-Host "Paste your existing ADMIN_KEY"
Invoke-RestMethod -Method Post -Uri "$WorkerUrl/admin/setup" -Headers @{ "X-Admin-Key" = $AdminKey }
```

## 5) GitHub Repository Secrets

در مخزن `mehrdadmb2/V2ray_Sub` برو به:

`Settings → Secrets and variables → Actions → New repository secret`

دو Secret اضافه کن:

- `V2RAY_RADAR_WORKER_URL` = URL پایه Worker، مثلاً `https://v2ray-sub-radar-bot.<account>.workers.dev`، بدون `/github/action` و بدون اسلش انتهایی.
- `V2RAY_RADAR_ACTION_SECRET` = دقیقاً همان مقداری که برای `GITHUB_ACTION_SECRET` به Cloudflare دادی.

## 6) فایل Workflow را به ریپو اضافه کن

از بسته، فایل:

`/.github/workflows/v2ray-sub-radar-notify.yml`

را به همین مسیر در ریشه مخزن GitHub کپی کن. اگر پوشه `.github/workflows` وجود ندارد، آن را بساز. Commit کن.

این Workflow روی `push` شاخه `main` فقط وقتی `Mix.txt` تغییر کرده باشد اجرا می‌شود. همچنین `workflow_dispatch` دارد تا از تب Actions دستی هم بتوانی اجرا کنی.

### اگر فایل Mix.txt با یک Workflow دیگر ساخته می‌شود

اگر Workflow تولیدکننده با `GITHUB_TOKEN` فایل را commit/push می‌کند، GitHub عمداً یک Workflow دوم را به‌صورت خودکار از آن push اجرا نمی‌کند. در آن صورت محتوای فایل `GITHUB_ACTION_INLINE_STEP.yml` را در همان Workflow تولیدکننده، به‌عنوان آخرین Step بعد از ایجاد و Push فایل قرار بده. آن Step از همان Workflow مستقیماً Worker را خبر می‌کند.

## 7) آزمایش دستی Worker → Telegram

```powershell
$ActionSecret = Read-Host "Paste GITHUB_ACTION_SECRET"
$Payload = @{ ref = "refs/heads/main"; sha = "manual-test"; repository = "mehrdadmb2/V2ray_Sub"; source = "manual-test" } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri "$WorkerUrl/github/action" -Headers @{ "X-V2SR-Action-Secret" = $ActionSecret } -ContentType "application/json" -Body $Payload
```

پاسخ `queued` یعنی درخواست پذیرفته شده است. سپس وضعیت Worker را نگاه کن:

```powershell
Invoke-RestMethod -Uri "$WorkerUrl/admin/status" -Headers @{ "X-Admin-Key" = $AdminKey }
Invoke-RestMethod -Uri "$WorkerUrl/admin/live-debug" -Headers @{ "X-Admin-Key" = $AdminKey }
```

یا Sync دستی مستقیم:

```powershell
Invoke-RestMethod -Method Post -Uri "$WorkerUrl/admin/sync" -Headers @{ "X-Admin-Key" = $AdminKey }
```

## 8) فرمان‌های جدید در تلگرام

- `/text` — همه کانفیگ‌های نسخه جاری را در چند پیام متن monospace می‌فرستد.
- `/history` — انتخاب Snapshot تاریخی ذخیره‌شده.
- `/country` یا `/country US` — انتخاب کشور یا مستقیم کشور موردنظر.
- `/protocol` یا `/protocol VLESS` — انتخاب/فیلتر پروتکل.
- `/latest` — فایل کامل Mix فعلی.
- `/stats`, `/countries`, `/protocols` — آمار.

برای نسخه‌های قدیمی، از `/history` یک Snapshot را انتخاب کن و بعد «کانفیگ‌ها به‌صورت متن»، «دریافت فایل» یا فیلتر کشور/پروتکل را انتخاب کن.

## 9) بررسی اجرای خودکار

1. `Mix.txt` را با commit عادی تغییر بده.
2. تب Actions را باز کن و اجرای `V2ray Sub Radar — notify Cloudflare Worker` را بررسی کن.
3. در Telegram باید فقط در صورت تغییر واقعی مجموعه کانفیگ‌ها اعلان دریافت شود.
4. در صورت عدم ارسال، خروجی‌های `admin/status` و `admin/live-debug` را بررسی کن؛ tokenها و Admin Key را داخل Issue یا پیام عمومی نفرست.
