# V2ray Sub Radar v5 — Cloudflare Worker + D1

This upgrade targets the currently deployed `@V2raySubRadarBot` and the existing D1 database. It does not require Cron and must not create a new D1 database.

## v5 changes

- Broadcast selects every active subscriber with notifications enabled. A historical cursor can no longer permanently skip later users.
- A `broadcast_delivery` row tracks each recipient and digest independently. One user's send failure does not stop delivery to the rest.
- Non-blocking delivery failures are retried up to three times per recipient. Telegram-blocked/deactivated users are marked blocked/inactive; other recipients still receive the update.
- `/admin`, `/adminusers`, `/adminstatus`, and `/adminretry` provide admin-only tools. Admin identity comes from the Cloudflare secret `ADMIN_TELEGRAM_IDS`.
- A `Mix.txt` change sends only `Mix.txt`; the three-file `/files` command remains available for manual requests.
- Admin user list includes name, username when present, numeric Telegram ID, active/notification state, join time, last activity, and last successful update delivery. The ID is a `tg://user?id=...` link; whether Telegram can open the profile may depend on privacy/client settings.

## Deploy safely

1. Back up the current `src/index.js` and `wrangler.toml`.
2. Replace `src/index.js` with the v5 file. Keep your actual current `database_id` and all existing secrets.
3. Apply the additive migration to the existing D1:

   ```powershell
   npx wrangler d1 execute v2ray-sub-radar --remote --file=./database/upgrade_003_broadcast_delivery.sql
   ```

   If your D1 is named differently, use its real name. Do not rerun the initial schema or create a new database.
4. In Telegram, run `/id` and note your numeric `User ID`. In PowerShell, run:

   ```powershell
   npx wrangler secret put ADMIN_TELEGRAM_IDS
   ```

   Enter numeric admin IDs separated by commas, such as `123456789,987654321` (example IDs only).
5. Deploy the Worker:

   ```powershell
   npx wrangler deploy
   ```

6. In Telegram test `/admin`, `/adminusers`, `/adminstatus`, and `/adminretry`.

## Diagnosing a friend who did not receive updates

- `/adminusers` shows whether the friend is actually present in D1 and whether `active` and `notifications` are enabled.
- If notification state is off, the person should send `/unmute`.
- If the subscriber was deactivated after Telegram rejected a delivery, the person should send `/start` again.
- `/adminstatus` reports counts of successful, retry, failed, and blocked deliveries for the latest/current digest.
- `/adminretry` retries failed recipients for that digest, without resending to users already recorded as delivered.

## Automatic update behavior

The existing GitHub Action is still the source of update signals, and no Cron trigger is needed. Its current path filter watches `Mix.txt`. When Mix changes, the Worker broadcasts the Mix update and Mix file only. Irancell/MCI remain accessible through `/irancell`, `/mci`, and `/files` for manual download.
