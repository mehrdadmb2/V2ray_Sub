# راهنمای ارتقای V2ray Sub Radar v5 — PowerShell مستقیم

این نسخه برای Worker فعلی است؛ دیتابیس جدید نساز و `TELEGRAM_BOT_TOKEN`، `TELEGRAM_WEBHOOK_SECRET`، `ADMIN_KEY`، `GITHUB_ACTION_SECRET` را عوض نکن.

## 1) Backup
از `src/index.js` و `wrangler.toml` فعلی کپی پشتیبان بگیر. فایل `src/index.js` را با نسخه این بسته جایگزین کن. در `wrangler.toml` حتماً همان `database_id` واقعی D1 فعلی را نگه دار؛ شناسه placeholder را Deploy نکن.

## 2) Migration افزایشی جدید
از پوشه Worker در PowerShell اجرا کن:

```powershell
npx wrangler d1 execute v2ray-sub-radar --remote --file=./database/upgrade_003_broadcast_delivery.sql
```

اگر نام دیتابیس تو متفاوت است، نام واقعی را جایگزین کن. Migration قبلی `upgrade_002_archive.sql` را دوباره لازم نیست اجرا کنی.

## 3) تعیین ادمین تلگرام
در Telegram به ربات برو و `/id` را بزن. `User ID` عددی خودت را یادداشت کن. سپس در پوشه Worker اجرا کن:

```powershell
npx wrangler secret put ADMIN_TELEGRAM_IDS
```

مقدار Secret را به صورت فهرست ID عددی، با کاما جدا کن. مثال ساختگی: `123456789,987654321`. فقط ID خودت/مدیرهای مطمئن را وارد کن. این مقدار را داخل سورس یا GitHub نگذار.

## 4) Deploy

```powershell
npx wrangler deploy
```

هیچ Secret موجودی را حذف نکن. Workflow GitHub Actions فعلی‌ات هم حفظ می‌شود.

## 5) بررسی D1 و ادمین

```powershell
npx wrangler d1 execute v2ray-sub-radar --remote --command="SELECT name FROM sqlite_master WHERE type='table' AND name='broadcast_delivery';"
```

در Telegram اجرا کن: `/admin`، `/adminusers`، `/adminstatus`. برای مشاهده پروفایل روی ID لینک‌شده کلیک کن؛ اگر کاربر تنظیمات حریم خصوصی خاصی داشته باشد، Telegram ممکن است بازکردن پروفایل را محدود کند.

## 6) بررسی تحویل همه مشترکان
`/adminstatus` شمارنده‌های `sent`, `retry`, `failed`, `blocked` را نشان می‌دهد. `failed`ها پس از حداکثر 3 تلاش برای همان کاربر از صف اصلی کنار گذاشته می‌شوند تا خرابی یک مقصد بقیه مشترکان را متوقف نکند. با `/adminretry` می‌توانی ارسال‌های ناموفق همان Digest را دوباره امتحان کنی؛ کسانی که دریافت موفق ثبت کرده‌اند دوباره پیام نمی‌گیرند.

## نکته اعلان‌ها
فقط کاربرانی دریافت خودکار دارند که در D1 `active=1` و `notifications=1` داشته باشند. کاربر باید در چت خصوصی ربات `/start` یا `/unmute` را اجرا کرده باشد. اگر `/adminusers` نشان داد اعلان دوستت خاموش است، او باید `/unmute` بزند. اگر غیرفعال شده، با `/start` دوباره فعال می‌شود.

## فقط فایل تغییرکرده
برای رویداد فعلی `Mix.txt`، ربات فقط `Mix.txt` را برای مشترکان ارسال می‌کند. `/files` همچنان برای دریافت دستی هر سه فایل وجود دارد.
