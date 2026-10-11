# Changelog v4

- اضافه شدن `/text`, `/alltext`, `/configs` برای ارسال multi-message monospace.
- اضافه شدن Snapshot archive، فیلتر کشور/پروتکل و مرور تاریخچه.
- اضافه شدن migration افزایشی D1؛ دیتابیس فعلی و Subscriberها حفظ می‌شوند.
- انتقال زمان‌بندی اصلی Sync به GitHub Actions؛ Cron در کانفیگ پیش‌فرض حذف شده است.
- اضافه شدن Worker action endpoint با header secret.
- اضافه شدن مسیر inline برای Workflowهای تولیدکننده که با GITHUB_TOKEN فایل Mix.txt را push می‌کنند.
- اصلاح double lock release و مدیریت شمارنده retry در Broadcast.
- سیاست نگهداری FIFO: حذف آرشیو قدیمی پیش از نسخه تازه، و محافظت از Snapshotهای در حال استفاده.
