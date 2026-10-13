# راهنمای سریع v5

1. از فایل‌های Worker فعلی Backup بگیر.
2. `telegram-bot/src/index.js` را جایگزین کن.
3. همان `database_id` دیتابیس فعلی را نگه دار.
4. Migration جدید را اجرا کن:

```powershell
npx wrangler d1 execute v2ray-sub-radar --remote --file=./database/upgrade_003_broadcast_delivery.sql
```

5. `/id` را در ربات بزن، سپس در PowerShell:

```powershell
npx wrangler secret put ADMIN_TELEGRAM_IDS
```

ID عددی خودت را وارد کن؛ برای چند ادمین، IDها را با کاما جدا کن.
6. Deploy:

```powershell
npx wrangler deploy
```

7. در Telegram `/adminusers` و `/adminstatus` را تست کن. اگر اعلان برای دوستی خاموش باشد، باید `/unmute` بزند؛ اگر غیرفعال شده باشد، `/start` آن را فعال می‌کند.
