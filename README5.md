# V2ray Sub Radar v5

Patch for the deployed Cloudflare Worker + existing D1.

## What's fixed
- Every active subscriber with notifications enabled is eligible for broadcasts; no global cursor can permanently skip users.
- Per-recipient delivery ledger in D1; one user failing delivery won't block the rest. Retry up to 3 attempts per user; blocked/deactivated users are recorded separately.
- `/admin`, `/adminusers`, `/adminstatus`, and `/adminretry` are available only to `ADMIN_TELEGRAM_IDS`. User ID in the user list links to Telegram profile when Telegram permits it.
- Automatic update sends only the updated source represented by the pending job. A Mix update sends `Mix.txt` only. `/files` remains available for manual request of all files.

## Files
- `telegram-bot/src/index.js`: complete Worker.
- `telegram-bot/database/upgrade_003_broadcast_delivery.sql`: additive D1 migration.
- `telegram-bot/wrangler.toml`: conservative defaults; keep the real existing `database_id`.
- `telegram-bot/WINDOWS_STEPS_FA.md`: step-by-step PowerShell steps.
- `.github/workflows/v2ray-sub-radar-notify.yml`: same workflow file included as reference; it does not need to change for this Worker patch if the current one already succeeds.

## Deployment order
1. Backup the current Worker.
2. Replace `src/index.js`.
3. Apply only the new migration: `npx wrangler d1 execute v2ray-sub-radar --remote --file=./database/upgrade_003_broadcast_delivery.sql`.
4. Set the admin secret: `npx wrangler secret put ADMIN_TELEGRAM_IDS` and enter the numeric Telegram User ID(s), comma-separated.
5. Keep all existing secrets and the current D1 ID; deploy with `npx wrangler deploy`.
6. Test `/adminusers` and `/adminstatus` in Telegram.

No Cron is required. The existing GitHub Actions trigger remains the primary automation path.
