# V2ray Sub Radar v4 — فایل‌های کامل و مراحل ارتقا

این بسته برای **Worker فعلی** `@V2raySubRadarBot` است و آرشیو را به **همان D1 موجود** اضافه می‌کند. دیتابیس تازه نساز؛ توکن Telegram و `ADMIN_KEY` فعلی را نگه دار.

## اجزای بسته

```text
V2raySubRadarPro_v4/
├── .github/workflows/v2ray-sub-radar-notify.yml  ← کپی به ریشه ریپو V2ray_Sub
├── GITHUB_ACTION_INLINE_STEP.yml                ← Step جایگزین برای Workflow تولیدکننده
└── telegram-bot/
    ├── src/index.js                             ← Worker کامل
    ├── wrangler.toml                            ← تنظیمات، بدون Cron
    ├── database/0001_initial.sql                ← فقط برای نصب تازه
    ├── database/upgrade_002_archive.sql         ← Migration افزایشی D1 فعلی
    ├── README.md
    ├── WINDOWS_STEPS_FA.md
    ├── CHANGELOG_v4.md
    └── docs/MESSAGE_PREVIEW.md
```

## خلاصه مراحل PowerShell

1. یک Backup از `src/index.js` و `wrangler.toml` فعلی بگیر.
2. فایل‌های داخل `telegram-bot` بسته را در پوشه محلی پروژه Worker جایگزین کن.
3. در `wrangler.toml` شناسه D1 را با UUID واقعی **همان دیتابیس فعلی** نگه دار/وارد کن. مقادیر placeholder را Deploy نکن.
4. از داخل پوشه `telegram-bot` این Migration را اجرا کن:

```powershell
npx wrangler d1 execute v2ray-sub-radar --remote --file=./database/upgrade_002_archive.sql
```

اگر نام D1 در تنظیماتت متفاوت است، نام واقعی را جایگزین کن. **Migration اولیه را روی دیتابیس کارا اجرا نکن.**

5. Secret تازه بساز:

```powershell
npx wrangler secret put GITHUB_ACTION_SECRET
```

مقدار را خودت انتخاب کن؛ همان مقدار باید در GitHub با نام `V2RAY_RADAR_ACTION_SECRET` ثبت شود.

6. Deploy:

```powershell
npx wrangler deploy
```

7. در مخزن GitHub به `Settings → Secrets and variables → Actions` برو و دو Repository Secret بساز:
   - `V2RAY_RADAR_WORKER_URL` = URL پایه Worker بدون مسیر `/github/action`.
   - `V2RAY_RADAR_ACTION_SECRET` = دقیقاً همان `GITHUB_ACTION_SECRET`.
8. فایل `.github/workflows/v2ray-sub-radar-notify.yml` این بسته را به همان مسیر در ریشه ریپوی `mehrdadmb2/V2ray_Sub` کپی و Commit کن.
9. اگر Workflow دیگری خودش `Mix.txt` را با built-in `GITHUB_TOKEN` می‌سازد/Push می‌کند، GitHub برای جلوگیری از چرخه عمداً Workflow دوم را از آن Push اجرا نمی‌کند. در این حالت `GITHUB_ACTION_INLINE_STEP.yml` را به‌عنوان آخرین Step در همان Workflow تولیدکننده اضافه کن.
10. تست دستی در Telegram: `/text`, `/history`, `/country`, `/protocol`.

## تست Worker با PowerShell

```powershell
$WorkerUrl = "https://YOUR-EXISTING-WORKER.workers.dev"
Invoke-RestMethod -Uri "$WorkerUrl/health"
```

و برای وضعیت آرشیو (با Admin Key فعلی):

```powershell
$AdminKey = Read-Host "Existing ADMIN_KEY"
Invoke-RestMethod -Uri "$WorkerUrl/admin/status" -Headers @{ "X-Admin-Key" = $AdminKey }
```

برای Sync دستی:

```powershell
Invoke-RestMethod -Method Post -Uri "$WorkerUrl/admin/sync" -Headers @{ "X-Admin-Key" = $AdminKey }
```

برای جزئیات واقعی فایل از Raw GitHub و GitHub Commit:

```powershell
Invoke-RestMethod -Uri "$WorkerUrl/admin/live-debug" -Headers @{ "X-Admin-Key" = $AdminKey }
```

## آرشیو و فضای D1

پیش‌فرض: 250 Snapshot، 25,000 ردیف کانفیگ و 300,000,000 بایت برآوردی. این مرزها حاشیه‌ای برای سقف D1 Free (500 MB برای هر دیتابیس) باقی می‌گذارند. با نزدیک شدن به مرز، قدیمی‌ترین Snapshotها حذف می‌شوند؛ **جدیدترین Snapshot حذف نمی‌شود** و Snapshot فعال در ارسال متنی نیز محافظت می‌شود. تاریخچه قبل از فعال‌شدن آرشیو، در D1 موجود نبوده و از این Migration قابل بازیابی نیست.

## اتوماسیون پایدار

- `push` عادی که `Mix.txt` را تغییر دهد → فایل Workflow جدا، Worker را خبر می‌کند.
- Workflow داخلی‌ای که با `GITHUB_TOKEN` فایل را Push کند → باید inline step را خودش اجرا کند.
- Cron در فایل Wrangler خاموش/حذف شده است؛ عملیات روزمره به آن وابسته نیست.
