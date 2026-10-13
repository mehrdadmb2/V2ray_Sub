# V2ray Sub Radar v5

## Fixes
- Broadcast now selects all active subscribers with notifications enabled, independent of the previous global row cursor.
- A per-recipient D1 delivery ledger prevents a single recipient's temporary error from halting delivery to all subsequent subscribers.
- Retry is limited per recipient; permanent Telegram rejections are marked blocked/inactive and delivery continues for everyone else.
- Admin status reports sent/retry/failed/blocked delivery counts.
- Automatic update broadcasts send only the source file represented by the pending update (Mix updates send Mix only), never all three subscription files by default.
- Subscriber identity fields are updated from Telegram `message.from`; `/adminusers` can inspect the stored records.
- Admin-only in-bot panel: `/admin`, `/adminusers`, `/adminstatus`, `/adminretry`.

## New D1 migration
Run `database/upgrade_003_broadcast_delivery.sql` against the existing D1 before deploying this Worker. Do not recreate D1 or rerun the initial schema.
