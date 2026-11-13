# راهنمای نصب ارتقای V2ray_Sub · نسخه 5.1 / External Lab

این بسته بر اساس نسخهٔ موجود ریپازیتوری `mehrdadmb2/V2ray_Sub` ساخته شده است. فایل‌های فعلی اصلی (`index.html`، `telegram-bot/src/index.js`، `assets/css/app.css` و Workflow فعلی Mix) با نسخهٔ آپلودی شما تطبیق داده شده‌اند؛ SHA فایل‌های اصلی با نسخهٔ فعلی GitHub یکسان بود. لینک ShadowProxy شمارهٔ ۲ در متن ارسالی به URL اصلی Mix چسبیده بود؛ آن را به‌عنوان دو URL مستقل تفسیر کردم و Mix تکراری را وارد فهرست متفرقه نکردم.

## نتیجهٔ بررسی لینک‌های اولیه

در ۱۳ نوامبر ۲۰۲۶:
- `Danialsamadi/v2go/AllConfigsSub.txt`: دریافت شد؛ ۶۴۴ ردیف با پیشوند URI قابل‌شناسایی در نسخهٔ بررسی‌شده.
- `igareck/vpn-configs-for-russia/BLACK_VLESS_RUS_mobile.txt`: دریافت شد؛ ۱۵۰ ردیف VLESS قابل‌شناسایی.
- `itsyebekhe/PSG/subscriptions/xray/mix`: دریافت شد؛ ۳۱۲ ردیف با پیشوند URI قابل‌شناسایی. در نمونهٔ پاسخ یک placeholder با `127.0.0.1` دیده شد؛ parser جدید آن را از خروجی معتبر حذف می‌کند.
- `Epodonios/v2ray-configs/All_Configs_Sub.txt`: مخزن/فایل با پاسخ 404 در بررسی فعلی.
- `AvenCores/goida-vpn-configs/githubmirror/1.txt`: مخزن اصلی با پاسخ 404 در بررسی فعلی.
- `mehrdadmb2/Family-Sub/Sub.text`: بدون دسترسی عمومی پاسخ 404 گرفت؛ URL در بسته بدون token قرار دارد و از token افشاشده استفاده نمی‌شود.
- پنج لینک `ShadowProxy66` و لینک `EZAccess NFZ`: ابزار بررسی این نشست درخواست به این Workerها را مسدود کرد؛ وضعیت آن‌ها «بررسی‌نشده» ثبت می‌شود، نه قطع‌شده. پس از اجرای Workflow در GitHub Actions، وضعیت واقعی دریافت، HTTP، تعداد URI، پروتکل‌ها و زمان پاسخ ثبت خواهد شد.

**محدودیت مهم:** شمارش URI و دریافت HTTP با تست اتصال واقعی V2Ray/Xray تفاوت دارد. این بسته ساختار URI و اعتبار اولیهٔ host/port را بررسی می‌کند؛ هیچ ادعایی دربارهٔ handshake، ping یا کارکرد عملی سرور نمی‌کند.

## فایل‌هایی که باید جایگزین/اضافه شوند

فایل‌های کامل را دقیقاً با مسیر زیر در ریشهٔ ریپازیتوری قرار بده:

| عملیات | مسیر |
|---|---|
| جایگزینی | `index.html` |
| اضافه‌کردن | `assets/css/external-sources.css` |
| اضافه‌کردن | `assets/js/external-sources.js` |
| اضافه‌کردن | `assets/js/theme-controller.js` |
| اضافه‌کردن | `data/external-sources.json` |
| اضافه‌کردن | `data/external-sources-status.json` |
| اضافه‌کردن | `scripts/fetch-external-sources.mjs` |
| اضافه‌کردن | `scripts/fetch-external-sources.test.mjs` |
| اضافه‌کردن | `.github/workflows/external-sources-check.yml` |
| اضافه‌کردن | `External.txt` |
| اضافه‌کردن | `Pic/GitHub Pages Guide/1.jpg` تا `4.jpg` |
| جایگزینی | `telegram-bot/src/index.js` |
| جایگزینی | `telegram-bot/package.json` |
| جایگزینی | `telegram-bot/README.md` |
| اضافه‌کردن | `telegram-bot/CHANGELOG_v5_1.md` |

فایل‌های `Mix.txt`، `Irancell.txt`، `Mci.txt`، Workflow فعلی `v2ray-sub-radar-notify.yml`، SQLهای D1، و `telegram-bot/wrangler.toml` را جایگزین نکن. این موارد برای جریان اصلی و تنظیمات مستقر شما هستند و در این ارتقا نیازی به تغییر ندارند.

## ۱. آپلود در GitHub

1. از ZIP، مسیرهای جدول بالا را در همان مسیرهای ریپازیتوری کپی کن.
2. فقط فایل‌های مشخص‌شده را commit/push کن؛ از جایگزینی کامل پوشه‌های دیگر خودداری کن.
3. در GitHub برو به **Settings → Actions → General → Workflow permissions** و برای Workflow جدید، دسترسی `Read and write permissions` را فعال کن.
4. از تب **Actions**، Workflow با نام **External Subscriptions · Health & Parser** را باز کن و `Run workflow` را بزن.
5. خروجی گزارش در `data/external-sources-status.json` و فایل جداگانهٔ ترکیبی در `External.txt` تولید می‌شود. Workflow هر ۶ ساعت نیز خودکار اجرا می‌شود.

این Workflow فقط `External.txt` و `data/external-sources-status.json` را commit می‌کند. با فایل `Mix.txt` کاری ندارد و Workflow اعلان عادی ربات را فراخوانی نمی‌کند. اگر در یک نوبت همه منابع خطا بدهند، فایل آخرین اجرای موفق حفظ می‌شود و در گزارش با وضعیت قدیمی (`stale`) مشخص خواهد شد؛ خروجی قدیمی بی‌صدا به‌عنوان تازه معرفی نمی‌شود.

## ۲. دسترسی خصوصی Family-Sub

اگر `Family-Sub` خصوصی است، یک Fine-grained Personal Access Token جدید با دسترسی فقط `Contents: Read-only` برای همان مخزن بساز و آن را در **Settings → Secrets and variables → Actions** با نام زیر ذخیره کن. در صورت وجود Secret، Workflow فایل را با GitHub Contents API دریافت می‌کند و token را فقط به `api.github.com` می‌فرستد؛ در غیر این صورت URL عمومی Raw را امتحان می‌کند:

`EXTERNAL_GITHUB_TOKEN`

توکن قدیمی که در URL پیام قبلی قرار گرفته بود افشا شده است؛ آن را در GitHub باطل کن. هیچ token را داخل URL، `data/external-sources.json`، کد جاوااسکریپت یا فایل‌های عمومی قرار نده. اگر مخزن خصوصی نیست، Secret لازم نیست.

محتوای `Family-Sub` به‌صورت پیش‌فرض وارد `External.txt` نمی‌شود (`includeInAggregate: false`) تا دادهٔ احتمالی خصوصی به خروجی عمومی منتقل نشود. فقط بعد از اطمینان از عمومی‌بودن داده و مالکیت/مجوز انتشار آن، این گزینه را آگاهانه تغییر بده.

## ۳. به‌روزرسانی Cloudflare Worker ربات

1. پیش از هر کاری از `telegram-bot/src/index.js` فعلی و `telegram-bot/wrangler.toml` نسخهٔ فعال خود پشتیبان بگیر.
2. فایل `telegram-bot/src/index.js` و `telegram-bot/package.json` را جایگزین کن.
3. `database_id` واقعی D1، Secretها و Bindingهای Worker را حفظ کن. Migration جدید لازم نیست.
4. از پوشهٔ `telegram-bot` اجرا کن:

```bash
npm install
npm run check
npm run test
npx wrangler deploy
```

5. برای ثبت دوبارهٔ فرمان‌های `/guide` و `/npvguide` در فهرست دستورات Telegram، از endpoint موجود و احراز‌شدهٔ `POST /admin/setup` استفاده کن. دو فرمان `/external` و `/externalmix` عمداً در فهرست عمومی BotFather و `/help` نمایش داده نمی‌شوند؛ فقط با تایپ مستقیم و درخواست کاربر اجرا می‌شوند.

## رفتار نهایی

- نوار میانبر سه پوستهٔ رنگی **آبی/زمردی/کهربایی** دارد؛ انتخاب کاربر در همان مرورگر ذخیره می‌شود و ظاهر کلاینت‌های قدیمی هم بدون تغییر نسخهٔ داده حفظ می‌شود.

- صفحهٔ اصلی GitHub Pages فقط همان اشتراک‌های اصلی فعلی را نشان می‌دهد. اطلاعات و URLهای ثالث در کارت یا بخش اصلی ظاهر نمی‌شوند.
- دکمهٔ کوچک **متفرقه** در نوار میانبر، یک فضای مستقل باز می‌کند. داخل آن جستجو، فیلتر نوع منبع/وضعیت، تعداد URI معتبر، URIهای ردشده، پروتکل‌ها، زمان آخرین بررسی و لینک خروجی ترکیبی وجود دارد.
- Bot در `/start` و اعلان‌های عادی هیچ لینک ثالثی ارسال نمی‌کند. در پیام به‌روزرسانی Mix، لینک اشتراک اصلی نمایش داده می‌شود.
- `/external` گزارش و لینک‌های منابع ثالث را فقط در پاسخ به درخواست مستقیم کاربر نشان می‌دهد.
- `/externalmix` فایل پردازش‌شدهٔ مستقل `External.txt` را ارسال می‌کند.
- `/guide` چهار تصویر آموزشی اختصاصی GitHub Pages را می‌فرستد: ورود به سایت، کپی اشتراک اصلی، بازکردن فضای جداگانه متفرقه و افزودن لینک در کلاینت. این تصاویر گرافیکیِ راهنما هستند، نه اسکرین‌شات زنده از دستگاه کاربر.
- `/npvguide` پنج تصویر موجود راهنمای افزودن Subscription در NPV Tunnel را به ترتیب ارسال می‌کند.
- خروجی ثالث با Mix اصلی ادغام نمی‌شود و خرابی هر منبع، بررسی منابع دیگر را متوقف نمی‌کند.

## تست محلی

در ریشهٔ پروژه:

```bash
node --check scripts/fetch-external-sources.mjs
node --test scripts/fetch-external-sources.test.mjs
node --check assets/js/external-sources.js
node --check telegram-bot/src/index.js
```

این تست‌ها parsing، حذف placeholder محلی، تشخیص duplicate و decode اشتراک Base64 را پوشش می‌دهند.
