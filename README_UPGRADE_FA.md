# V2ray_Sub 5.2 · External Lab & Config Renamer

این نسخه، بخش منابع شخص ثالث را به یک خط پردازش دو‌مرحله‌ای تبدیل می‌کند. فایل خام هرگز جای فایل نهایی را نمی‌گیرد و `Mix.txt`، `Irancell.txt` و `Mci.txt` در این فرایند تغییر نمی‌کنند.

## خروجی‌های جدید

| فایل | نقش |
|---|---|
| `External-raw.txt` | دادهٔ خام جمع‌آوری‌شده از منابع مستقل |
| `data/external-raw-index.json` | انتساب هش هر URI خام به شناسهٔ منبع |
| `External.txt` | خروجی نهایی؛ تغییرنام‌یافته، یکتا و قابل اشتراک |
| `data/external-processed.json` | ایندکس پروتکل، کشور، Host، Port، نام جدید و منبع هر کانفیگ |
| `data/external-sources-status.json` | سلامت منابع و وضعیت آخرین پردازش |

## منطق تغییر نام

پردازش‌گر `scripts/process-external-subscriptions.mjs` منطق عملی ConfigRenamerPro را به Node منتقل می‌کند:

- پیشوند `SkyBit-` و شماره‌گذاری از صفر؛
- قالب نام `SkyBit-0_yyyy-MM-dd_HH-mm`؛
- منطقهٔ زمانی `Asia/Tehran`؛
- حفظ پرچم/کشور قابل‌تشخیص از نام قبلی کانفیگ؛
- استفاده از پرچم `🏴‍☠️` وقتی نام قبلی کشور صریحی ندارد؛
- تغییر نام VLESS، VMess، Trojan، Shadowsocks، SSR، SOCKS، Hysteria2، TUIC و WireGuard بدون بازنویسی پارامترهای اتصال؛
- برای VMess مقدار `ps` در JSON داخلی تغییر می‌کند؛ برای سایر URIها فقط Fragment نام‌گذاری می‌شود؛
- حذف تکراری بر اساس URI پیش از `#fragment`؛
- نگهداری نام اصلی، نام جدید، پروتکل، Host، Port، کشور و شناسهٔ منبع در فایل JSON.

این پردازش به‌صورت آگاهانه GeoIP را از راه دور حدس نمی‌زند. کشور تنها از پرچم یا برچسب روشن نام قبلی استخراج می‌شود؛ موارد مبهم با پرچم دزدان دریایی مشخص می‌شوند. در نتیجه فیلتر کشور دقیقاً بر اساس دادهٔ قابل‌استناد است.

## ترتیب خودکار GitHub Actions

۱. `.github/workflows/external-sources-check.yml` طبق زمان‌بندی هر شش ساعت منابع را می‌خواند و `External-raw.txt` و ایندکس خام را می‌سازد.

۲. پس از پایان موفق Workflow اول، `.github/workflows/external-renamer.yml` با رویداد `workflow_run` اجرا می‌شود؛ فایل خام را پردازش می‌کند و `External.txt`، ایندکس نهایی و وضعیت را Commit می‌کند.

۳. Workflow دوم در صورت نیاز از `workflow_dispatch` نیز قابل اجرای دستی است.

### مجوز مخزن

در GitHub به مسیر زیر برو:

`Settings → Actions → General → Workflow permissions`

گزینهٔ `Read and write permissions` را انتخاب کن. هر دو Workflow با `contents: write` کار می‌کنند.

### Secret اختیاری برای Family-Sub

منبع `Family-Sub` نیز در خروجی ادغام می‌شود. اگر مخزن `mehrdadmb2/Family-Sub` خصوصی است، یک Fine-grained Personal Access Token تازه با دسترسی فقط `Contents: Read-only` برای همان مخزن ایجاد و در Repository Secrets با نام زیر ذخیره کن:

`EXTERNAL_GITHUB_TOKEN`

بدون این Secret، سایر منابع همچنان پردازش می‌شوند و Family-Sub به شکل `unknown / requires authentication` گزارش خواهد شد. در اجرای نخست از دادهٔ قدیمی، انتساب منبع برای کانفیگ‌های تاریخی قابل بازیابی نیست؛ پس از اولین اجرای تازهٔ collector، انتساب هر URI به همهٔ منابع منتشرکننده‌اش ثبت می‌شود، حتی وقتی Fragment نام کانفیگ در هر منبع متفاوت باشد. هیچ Token را داخل URL، کد یا فایل JSON ذخیره نکن.

## صفحهٔ GitHub Pages

- نوار میانبر از داخل `main` خارج شده و به صورت `position: fixed` نسبت به viewport در پایین صفحه باقی می‌ماند؛ بنابراین به scroll container وابسته نیست.
- نوار در دسکتاپ و موبایل با عرض کم قابل اسکرول افقی است و حاشیهٔ امن پایین موبایل را رعایت می‌کند.
- فضای متفرقه تا زمان کلیک روی تب جداگانه مخفی می‌ماند.
- پس از بازکردن بخش، گزارش سلامت، `external-processed.json` و `External.txt` بارگذاری می‌شوند.
- فیلترهای پروتکل، کشور، منبع و متن؛ صفحه‌بندی ۱۰۰تایی؛ کپی همهٔ نتایج منطبق؛ دانلود فایل فیلترشده؛ نمایش نام، Host، Port، کشور، پروتکل و منبع هر کانفیگ اضافه شده‌اند.

## دستورات ربات

این دستورات عمداً به `/start`، `/help` یا منوی عمومی BotFather اضافه نشده‌اند تا لینک‌های شخص ثالث در مسیر عادی کاربر نمایش داده نشوند. کاربر فقط با واردکردن مستقیم دستور وارد بخش می‌شود:

| دستور | عملکرد |
|---|---|
| `/external` | گزارش سلامت منابع و خلاصهٔ خروجی نهایی |
| `/externalmix` | دریافت همهٔ کانفیگ‌های نهایی در TXT |
| `/externalprotocol` | انتخاب پروتکل و دریافت تمام کانفیگ‌های آن |
| `/externalcountry` | انتخاب کشور و دریافت تمام کانفیگ‌های آن |

در صفحهٔ انتخاب، دکمه‌های Inline نیز وجود دارد. اعلان‌های عادی ربات همچنان فقط به Mix اصلی مربوط می‌شوند.

## استقرار Worker

از پوشهٔ `telegram-bot`:

```bash
npm run check
npm test
npx wrangler deploy
```

فایل‌های Worker که باید جایگزین شوند:

- `telegram-bot/src/index.js`
- `telegram-bot/package.json`

`telegram-bot/wrangler.toml` را از بستهٔ جایگزینی اعمال نکن؛ شناسهٔ واقعی D1 در فایل فعلی مستقرشده را حفظ کن. فایل نمونهٔ ZIP ممکن است شناسهٔ جایگزین/Placeholder داشته باشد. نام Bindingها و متغیرهای محیطی موجود را نیز حفظ کن. Secretهای قبلی Worker مانند `TELEGRAM_BOT_TOKEN`، `TELEGRAM_WEBHOOK_SECRET`، `GITHUB_ACTION_SECRET` و `ADMIN_KEY` را حذف یا بازنویسی نکن.

## تست محلی

```bash
node --check scripts/fetch-external-sources.mjs
node --check scripts/process-external-subscriptions.mjs
node --test scripts/fetch-external-sources.test.mjs scripts/process-external-subscriptions.test.mjs
```

تست‌ها parser پروتکل‌ها، Base64، حذف تکراری، نگه‌داری پرچم، پرچم ناشناس، تغییر نام VMess و زمان تهران را پوشش می‌دهند.

## راه‌اندازی اولیه

۱. فایل‌های بسته را با حفظ مسیرهای نسبی در ریشهٔ ریپو جایگزین کن؛ فایل `telegram-bot/wrangler.toml` را نگه دار و روی آن ننویس.
۲. Workflow اول را از Actions دستی اجرا کن.
۳. پس از پایان موفق آن، منتظر شروع خودکار Workflow دوم بمان؛ یا Workflow دوم را دستی اجرا کن.
۴. در هر دو Workflow بررسی کن که Commit موفق باشد.
۵. GitHub Pages را با Hard Refresh باز کن و تب «متفرقه» را انتخاب کن.
۶. در Worker، `npm run check`، `npm test` و `npx wrangler deploy` را اجرا کن.
۷. در تلگرام ابتدا `/external`، سپس `/externalprotocol` یا `/externalcountry` را امتحان کن.

> نکتهٔ فنی: شمار URI معتبر صرفاً بررسی ساختار، مقصد و پورت است. این سیستم اتصال واقعی، TLS handshake، سرعت یا پایداری پروکسی را تست نمی‌کند. برای چنین تستی به Runnerهای اتصال واقعی و محدودیت‌های شبکهٔ جداگانه نیاز است.
