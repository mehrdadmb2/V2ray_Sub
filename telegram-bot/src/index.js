/**
 * V2ray Sub Radar — Telegram Bot for Cloudflare Workers + D1
 *
 * Architecture
 *   GitHub Actions (push on Mix.txt) -> signed Worker endpoint -> GitHub Raw -> diff/archive -> Telegram
 *   Telegram Webhook -> Worker -> D1 -> text delivery queue / historical snapshots
 *
 * Cron remains implemented as an optional fallback, but is not required. The supplied Wrangler
 * config intentionally has no Cron trigger because the repository's GitHub Actions workflow is
 * the primary update signal. Archive retention is deliberately below the D1 Free per-database cap.
 * The Telegram bot token is stored only as a Cloudflare Worker secret.
 */

const APP = {
  name: 'V2ray Sub Radar',
  username: '@V2raySubRadarBot',
  version: '5.0.0',
  siteUrl: 'https://mehrdadmb2.github.io/V2ray_Sub/',
  repoUrl: 'https://github.com/mehrdadmb2/V2ray_Sub',
  repoApi: 'https://api.github.com/repos/mehrdadmb2/V2ray_Sub',
  webhookPath: '/telegram/webhook',
  adminPrefix: '/admin',
  maxTelegramText: 3900,
  maxPreEscapedChars: 3150,
  textBatchMessages: 7,
  maxArchiveLinesPerSnapshot: 8000,
  maxDocumentBytes: 50 * 1024 * 1024,
  defaultBroadcastBatch: 2,
  maxBroadcastAttemptsPerUser: 3,
  adminUserPageSize: 5,
  githubApiVersion: '2026-03-10',
  rawRetryDelaysMs: [0, 1200, 3000],
  fetchTimeoutMs: 20000,
  githubTimeoutMs: 12000,
  lockSeconds: 50,
};

const SOURCES = [
  {
    key: 'mix',
    label: 'Mix',
    fileName: 'Mix.txt',
    url: 'https://raw.githubusercontent.com/mehrdadmb2/V2ray_Sub/refs/heads/main/Mix.txt',
    active: true,
  },
  {
    key: 'irancell',
    label: 'Irancell',
    fileName: 'Irancell.txt',
    url: 'https://raw.githubusercontent.com/mehrdadmb2/V2ray_Sub/refs/heads/main/Irancell.txt',
    active: false,
  },
  {
    key: 'mci',
    label: 'MCI',
    fileName: 'Mci.txt',
    url: 'https://raw.githubusercontent.com/mehrdadmb2/V2ray_Sub/refs/heads/main/Mci.txt',
    active: false,
  },
];

const COUNTRY_NAMES = {
  AF: 'افغانستان', AL: 'آلبانی', AM: 'ارمنستان', AR: 'آرژانتین', AT: 'اتریش', AU: 'استرالیا',
  AZ: 'آذربایجان', BA: 'بوسنی و هرزگوین', BE: 'بلژیک', BG: 'بلغارستان', BH: 'بحرین', BY: 'بلاروس',
  BR: 'برزیل', CA: 'کانادا', CH: 'سوئیس', CL: 'شیلی', CN: 'چین', CO: 'کلمبیا', CR: 'کاستاریکا',
  CY: 'قبرس', CZ: 'چک', DE: 'آلمان', DK: 'دانمارک', DO: 'جمهوری دومینیکن', DZ: 'الجزایر',
  EE: 'استونی', EG: 'مصر', ES: 'اسپانیا', FI: 'فنلاند', FR: 'فرانسه', GB: 'بریتانیا', GE: 'گرجستان',
  GR: 'یونان', HK: 'هنگ‌کنگ', HR: 'کرواسی', HU: 'مجارستان', ID: 'اندونزی', IE: 'ایرلند', IL: 'اسرائیل',
  IN: 'هند', IQ: 'عراق', IR: 'ایران', IS: 'ایسلند', IT: 'ایتالیا', JP: 'ژاپن', JO: 'اردن', KE: 'کنیا',
  KH: 'کامبوج', KR: 'کره‌جنوبی', KW: 'کویت', KZ: 'قزاقستان', LA: 'لائوس', LB: 'لبنان',
  LI: 'لیختن‌اشتاین', LK: 'سریلانکا', LT: 'لیتوانی', LU: 'لوکزامبورگ', LV: 'لتونی', MA: 'مراکش',
  MD: 'مولداوی', ME: 'مونته‌نگرو', MK: 'مقدونیه شمالی', MN: 'مغولستان', MX: 'مکزیک', MY: 'مالزی',
  NG: 'نیجریه', NL: 'هلند', NO: 'نروژ', NP: 'نپال', NZ: 'نیوزیلند', OM: 'عمان', PA: 'پاناما',
  PE: 'پرو', PH: 'فیلیپین', PK: 'پاکستان', PL: 'لهستان', PT: 'پرتغال', QA: 'قطر', RO: 'رومانی',
  RS: 'صربستان', RU: 'روسیه', SA: 'عربستان', SE: 'سوئد', SG: 'سنگاپور', SI: 'اسلوونی', SK: 'اسلواکی',
  TH: 'تایلند', TR: 'ترکیه', TW: 'تایوان', UA: 'اوکراین', US: 'آمریکا', UY: 'اروگوئه', UZ: 'ازبکستان',
  VE: 'ونزوئلا', VN: 'ویتنام', XK: 'کوزوو', ZA: 'آفریقای جنوبی', AE: 'امارات',
};

const COMMANDS = [
  { command: 'start', description: '🚀 شروع و دریافت آخرین نسخه' },
  { command: 'latest', description: '🆕 آخرین نسخه + جزئیات' },
  { command: 'text', description: '📋 همه کانفیگ‌ها به‌صورت متن قابل کپی' },
  { command: 'history', description: '🗃 انتخاب نسخه‌های قدیمی‌تر' },
  { command: 'country', description: '🌍 دریافت کانفیگ‌های یک کشور' },
  { command: 'protocol', description: '🔌 دریافت کانفیگ‌های یک پروتکل' },
  { command: 'stats', description: '📊 آمار کامل کانفیگ‌ها' },
  { command: 'countries', description: '🌍 آمار کشورها + فیلتر' },
  { command: 'protocols', description: '🔌 آمار پروتکل‌ها + فیلتر' },
  { command: 'files', description: '📦 دریافت هر ۳ فایل' },
  { command: 'mix', description: '🚀 دریافت Mix.txt' },
  { command: 'irancell', description: '📱 دریافت Irancell.txt' },
  { command: 'mci', description: '📡 دریافت Mci.txt' },
  { command: 'mute', description: '🔕 خاموش‌کردن اعلان‌ها' },
  { command: 'unmute', description: '🔔 روشن‌کردن اعلان‌ها' },
  { command: 'help', description: '❓ راهنمای ربات' },
  { command: 'id', description: '🆔 نمایش شناسه چت' },
];

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function envBool(value, fallback = false) {
  if (value == null) return fallback;
  return !['0', 'false', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

function parseLocalDateTime(local, timezone = 'Asia/Tehran') {
  const match = String(local || '').match(/^(20\d{2})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const parts = {};
    for (const part of formatter.formatToParts(new Date(guess))) {
      if (part.type !== 'literal') parts[part.type] = Number(part.value);
    }
    // Interpret the requested wall-clock time as UTC once, then subtract the
    // timezone offset observed at that instant. One correction is enough here
    // and avoids the oscillation that multi-pass correction can cause.
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const offset = asUtc - guess;
    guess -= offset;
    return new Date(guess).toISOString();
  } catch {
    if (timezone === 'Asia/Tehran') {
      return new Date(Date.UTC(year, month - 1, day, hour, minute - 210, second)).toISOString();
    }
    return null;
  }
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

function textResponse(text, status = 200) {
  return new Response(text, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function isConfigCandidate(line) {
  const l = line.toLowerCase();
  return /^(?:vless|vmess|trojan|ss|socks|http):\/\//.test(l);
}

function normalizeLine(line) {
  return String(line ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .trim();
}

function normalizeConfigBody(text) {
  return String(text ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(normalizeLine)
    .filter(Boolean)
    .join('\n') + '\n';
}

function tryDecodeBase64(text) {
  const compact = String(text).replace(/\s+/g, '');
  if (!compact || compact.length < 8 || compact.length % 4 === 1) return null;
  if (!/^[A-Za-z0-9+/_=-]+$/.test(compact)) return null;
  try {
    const binary = atob(compact.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function extractConfigLines(text) {
  const normalized = normalizeConfigBody(text);
  const direct = normalized
    .split('\n')
    .map(normalizeLine)
    .filter(line => line && !line.startsWith('#') && !line.startsWith('//'));

  const directConfigs = direct.filter(isConfigCandidate);
  if (directConfigs.length > 0) return directConfigs;

  const decoded = tryDecodeBase64(normalized);
  if (!decoded) return direct;
  const decodedLines = decoded
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(line => line && !line.startsWith('#') && !line.startsWith('//'));
  return decodedLines.length ? decodedLines : direct;
}

function protocolOf(line) {
  const m = String(line).match(/^([a-z][a-z0-9+.-]*):\/\//i);
  return (m?.[1] || 'UNKNOWN').toUpperCase();
}

function extractName(line) {
  const raw = String(line);
  const idx = raw.indexOf('#');
  if (idx < 0 || idx === raw.length - 1) return 'بدون نام';
  try {
    return decodeURIComponent(raw.slice(idx + 1)).replace(/\+/g, ' ').trim() || 'بدون نام';
  } catch {
    return raw.slice(idx + 1).trim() || 'بدون نام';
  }
}

function flagToIso(flag) {
  const chars = [...String(flag || '')];
  if (chars.length !== 2) return null;
  const a = chars[0].codePointAt(0);
  const b = chars[1].codePointAt(0);
  if (a < 0x1F1E6 || a > 0x1F1FF || b < 0x1F1E6 || b > 0x1F1FF) return null;
  return String.fromCharCode(a - 0x1F1E6 + 65, b - 0x1F1E6 + 65);
}

function isoToFlag(iso) {
  if (!/^[A-Z]{2}$/.test(String(iso || ''))) return '🏳️';
  return [...iso].map(ch => String.fromCodePoint(0x1F1E6 + ch.charCodeAt(0) - 65)).join('');
}

function countryFromText(text) {
  const flagMatch = String(text).match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
  if (flagMatch) {
    const code = flagToIso(flagMatch[0]);
    return { code, flag: flagMatch[0], name: code ? (COUNTRY_NAMES[code] || code) : 'نامشخص' };
  }

  const upper = String(text).toUpperCase();
  const countryCodes = Object.keys(COUNTRY_NAMES).sort((a, b) => b.length - a.length);
  for (const code of countryCodes) {
    const re = new RegExp(`(?:^|[\\W_])${code}(?:$|[\\W_])`, 'u');
    if (re.test(upper)) return { code, flag: isoToFlag(code), name: COUNTRY_NAMES[code] };
  }
  return { code: null, flag: '🏳️', name: 'نامشخص' };
}

function tryDecodeVmess(line) {
  if (!/^vmess:\/\//i.test(line)) return null;
  try {
    let payload = line.slice(8).trim();
    const pad = payload.length % 4;
    if (pad) payload += '='.repeat(4 - pad);
    return JSON.parse(tryDecodeBase64(payload) || '{}');
  } catch {
    return null;
  }
}

function logicalCanonical(line) {
  const raw = normalizeLine(line);
  const protocol = protocolOf(raw).toLowerCase();
  if (protocol === 'vmess') {
    const vm = tryDecodeVmess(raw);
    if (vm && typeof vm === 'object' && Object.keys(vm).length) {
      const clone = { ...vm };
      delete clone.ps;
      delete clone.remarks;
      delete clone.remark;
      return `${protocol}://${stableStringify(clone)}`;
    }
  }
  const withoutFragment = raw.split('#')[0];
  return withoutFragment;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

function extractEmbeddedTimestamps(lines, timezone = 'Asia/Tehran') {
  const found = [];
  const re = /(20\d{2}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/g;
  for (const line of lines) {
    const name = extractName(line);
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(name))) {
      const local = `${match[1]}T${match[2]}`;
      const iso = parseLocalDateTime(local, timezone);
      if (iso) found.push({ raw: local, iso, epoch: new Date(iso).getTime(), timezone });
    }
  }
  if (!found.length) return { count: 0, earliest: null, latest: null, earliestIso: null, latestIso: null, timezone };
  found.sort((a, b) => a.epoch - b.epoch);
  return {
    count: found.length,
    earliest: found[0].raw,
    latest: found.at(-1).raw,
    earliestIso: found[0].iso,
    latestIso: found.at(-1).iso,
    timezone,
  };
}

function configSummaryItems(lines) {
  const protocols = new Map();
  const countries = new Map();
  const names = [];
  for (const line of lines) {
    const protocol = protocolOf(line);
    protocols.set(protocol, (protocols.get(protocol) || 0) + 1);
    const c = countryFromText(`${line}\n${extractName(line)}`);
    const countryKey = c.code || 'UNKNOWN';
    const current = countries.get(countryKey) || { code: c.code, flag: c.flag, name: c.name, count: 0 };
    current.count += 1;
    countries.set(countryKey, current);
    names.push(extractName(line));
  }
  return {
    protocols: [...protocols.entries()].sort((a, b) => b[1] - a[1]),
    countries: [...countries.values()].sort((a, b) => b.count - a.count),
  };
}

async function sha256Hex(input) {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashMany(values, batchSize = 40) {
  const output = [];
  for (let i = 0; i < values.length; i += batchSize) {
    const batch = values.slice(i, i + batchSize);
    const hashes = await Promise.all(batch.map(sha256Hex));
    output.push(...hashes);
  }
  return output;
}

async function buildStats(text, env) {
  const lines = extractConfigLines(text);
  const exactUnique = [...new Set(lines)];
  const logicalCanonicalValues = exactUnique.map(logicalCanonical);
  const logicalUniqueValues = [...new Set(logicalCanonicalValues)];
  const logicalIds = await hashMany(logicalUniqueValues);
  const { protocols, countries } = configSummaryItems(exactUnique);
  const timestamps = extractEmbeddedTimestamps(exactUnique, env?.CONFIG_TIMESTAMP_TIMEZONE || 'Asia/Tehran');
  return {
    totalLines: lines.length,
    exactUniqueCount: exactUnique.length,
    exactDuplicates: Math.max(0, lines.length - exactUnique.length),
    logicalUniqueCount: logicalUniqueValues.length,
    logicalDuplicateCount: Math.max(0, exactUnique.length - logicalUniqueValues.length),
    protocols,
    countries,
    embeddedTimestamps: timestamps,
    logicalIds,
  };
}

function formatNumber(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTehran(iso, timezone = 'Asia/Tehran') {
  if (!iso) return 'نامشخص';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().replace('T', ' ').replace('Z', ' UTC');
  }
}

function formatElapsed(fromIso, toIso = nowIso()) {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 'نامشخص';
  let seconds = Math.max(0, Math.floor((to - from) / 1000));
  const days = Math.floor(seconds / 86400); seconds %= 86400;
  const hours = Math.floor(seconds / 3600); seconds %= 3600;
  const minutes = Math.floor(seconds / 60); seconds %= 60;
  return `${days} روز، ${hours} ساعت، ${minutes} دقیقه`;
}

function formatChange(change, firstRun = false) {
  if (firstRun) return `🆕 اولین دریافت: ${formatNumber(change.added)} کانفیگ منطقی شناسایی شد.`;
  return `➕ اضافه‌شده: ${formatNumber(change.added)}\n➖ حذف‌شده: ${formatNumber(change.removed)}\n🔁 بدون تغییر منطقی: ${formatNumber(change.unchanged)}`;
}

function sourceStatsText(stats, maxCountries = 18) {
  const proto = stats.protocols.map(([name, count]) => `🔌 ${name}: ${formatNumber(count)}`).join('\n') || '—';
  const countries = stats.countries.slice(0, maxCountries).map(c => `${c.flag} ${c.name}: ${formatNumber(c.count)}`).join('\n') || '—';
  return { proto, countries };
}

function formatDateBasis(snapshot) {
  const map = {
    'github-commit': 'Commit واقعی GitHub',
    'github-last-modified': 'هدر Last-Modified گیت‌هاب',
    'config-embedded-timestamp': 'Timestamp درج‌شده داخل کانفیگ‌ها',
    'worker-time': 'زمان Worker (fallback)',
  };
  return map[snapshot.sourceDateBasis] || 'نامشخص';
}

function buildDetailedSections(snapshot, change, sendTimeIso, eventLabel = 'آخرین وضعیت') {
  const protoLines = snapshot.stats.protocols.length
    ? snapshot.stats.protocols.map(([name, count]) => `│ ${String(name).padEnd(10, ' ')} : ${formatNumber(count)}`)
    : ['│ —'];
  const countryLines = snapshot.stats.countries.length
    ? snapshot.stats.countries.slice(0, 24).map(c => `│ ${String(c.flag).padEnd(2, ' ')} ${c.name} : ${formatNumber(c.count)}`)
    : ['│ —'];
  const embedded = snapshot.stats.embeddedTimestamps;

  const header = `<blockquote>🚀 <b>${escapeHtml(APP.name)}</b>
📦 <b>${escapeHtml(eventLabel)} · ${escapeHtml(snapshot.label)}</b></blockquote>`;
  const githubDate = snapshot.githubMetaOk && snapshot.githubCommitDate ? formatTehran(snapshot.githubCommitDate) : 'در دسترس نیست';
  const timing = `<pre>╭─[ 🕒 زمان‌بندی ]\n│ 📅 زمان مبنا      : ${escapeHtml(formatTehran(snapshot.sourceUpdatedAt))}\n│ 🧭 مبنای تاریخ    : ${escapeHtml(formatDateBasis(snapshot))}\n│ 📅 Commit GitHub  : ${escapeHtml(githubDate)}\n│ ⏱ سن تا ارسال     : ${escapeHtml(formatElapsed(snapshot.sourceUpdatedAt, sendTimeIso))}\n│ 🕒 زمان ارسال      : ${escapeHtml(formatTehran(sendTimeIso))}\n│ 🧭 داخل کانفیگ    : ${escapeHtml(embedded?.latest || 'پیدا نشد')}\n╰────────────────────────</pre>`;
  const summary = `<pre>╭─[ 📊 خلاصه فایل ]
│ 📏 حجم فایل       : ${escapeHtml(formatBytes(snapshot.fileBytes))}
│ 🧾 خطوط کانفیگ    : ${formatNumber(snapshot.stats.totalLines)}
│ 📦 یکتای دقیق     : ${formatNumber(snapshot.stats.exactUniqueCount)}
│ 🔁 Duplicate دقیق : ${formatNumber(snapshot.stats.exactDuplicates)}
│ 🧩 یکتای منطقی    : ${formatNumber(snapshot.stats.logicalUniqueCount)}
│ 🔁 Duplicate منطقی: ${formatNumber(snapshot.stats.logicalDuplicateCount)}
╰────────────────────────</pre>`;
  const changes = `<pre>╭─[ 🔄 تغییرات نسبت به نسخه قبل ]
│ ➕ اضافه‌شده      : ${formatNumber(change?.added || 0)}
│ ➖ حذف‌شده        : ${formatNumber(change?.removed || 0)}
│ ✅ بدون تغییر     : ${formatNumber(change?.unchanged || 0)}
│ 🧭 وضعیت          : ${change?.firstRun ? 'Snapshot اولیه' : ((change?.added || change?.removed) ? 'تغییر شناسایی شد' : 'بدون تغییر منطقی')}
╰────────────────────────</pre>`;
  const protocols = `<pre>╭─[ 🔌 توزیع پروتکل‌ها ]
${protoLines.join('\n')}
╰────────────────────────</pre>`;
  const countryExtra = snapshot.stats.countries.length > 24 ? `
│ … و ${formatNumber(snapshot.stats.countries.length - 24)} مورد دیگر` : '';
  const countries = `<pre>╭─[ 🌍 توزیع کشورها ]
${countryLines.join('\n')}${countryExtra}
╰────────────────────────</pre>`;
  const hashes = `<pre>╭─[ 🔐 شناسه نسخه ]
│ SHA-256 فایل  : ${escapeHtml(snapshot.rawSha256)}
│ SHA-256 منطقی : ${escapeHtml(snapshot.configSha256)}
${snapshot.githubCommitSha ? `│ Commit        : ${escapeHtml(snapshot.githubCommitSha.slice(0, 12))}` : '│ Commit        : نامشخص'}
╰────────────────────────</pre>`;
  const links = `<blockquote>🔗 <a href="${escapeHtml(snapshot.url)}">دانلود ${escapeHtml(snapshot.fileName)}</a>
🌐 <a href="${escapeHtml(APP.siteUrl)}">V2ray_Sub · GitHub Pages</a>${snapshot.githubCommitUrl ? `
🧾 <a href="${escapeHtml(snapshot.githubCommitUrl)}">مشاهده Commit</a>` : ''}</blockquote>`;
  // Keep the update readable without flooding the chat: three logical messages.
  return [
    [header, timing, summary, changes].join('\n\n'),
    [protocols, countries].join('\n\n'),
    [hashes, links].join('\n\n'),
  ];
}

function shortDocumentCaption(snapshot, sendTimeIso, statusText = '') {
  const caption = [
    `📎 <b>${escapeHtml(snapshot.fileName)}</b>`,
    `📅 مبنای زمان: <code>${escapeHtml(formatTehran(snapshot.sourceUpdatedAt))}</code>`,
    `⏱ سن فایل تا ارسال: <code>${escapeHtml(formatElapsed(snapshot.sourceUpdatedAt, sendTimeIso))}</code>`,
    `📦 <code>${formatNumber(snapshot.stats.logicalUniqueCount)}</code> کانفیگ منطقی · 🔁 <code>${formatNumber(snapshot.stats.exactDuplicates)}</code> Duplicate`,
    statusText ? escapeHtml(statusText) : '',
  ].filter(Boolean).join('\n');
  return caption.slice(0, 1024);
}

async function sendHtmlMessage(env, chatId, html, markup) {
  return sendTelegram(env, 'sendMessage', {
    chat_id: String(chatId),
    text: String(html || '').slice(0, APP.maxTelegramText),
    parse_mode: 'HTML',
    ...(markup ? { reply_markup: markup } : {}),
  });
}

async function sendHtmlSections(env, chatId, sections, markup) {
  let result = null;
  for (let i = 0; i < sections.length; i += 1) {
    result = await sendTelegram(env, 'sendMessage', {
      chat_id: String(chatId),
      text: sections[i],
      parse_mode: 'HTML',
      ...(i === sections.length - 1 && markup ? { reply_markup: markup } : {}),
    });
    if (i < sections.length - 1) await sleep(1050);
  }
  return result;
}

function mainKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🆕 آخرین نسخه', callback_data: 'latest' },
        { text: '📋 کانفیگ‌ها به‌صورت متن', callback_data: 'text:latest' },
      ],
      [
        { text: '🗃 نسخه‌های قبلی', callback_data: 'history' },
        { text: '🌍 فیلتر کشور', callback_data: 'countrylist:latest' },
      ],
      [
        { text: '🔌 فیلتر پروتکل', callback_data: 'protolist:latest' },
        { text: '📊 آمار', callback_data: 'stats' },
      ],
      [
        { text: '🌐 وب‌سایت', url: APP.siteUrl },
        { text: '🛠 راهنما', callback_data: 'help' },
      ],
      [
        { text: '📦 فایل‌های Subscription', callback_data: 'files' },
        { text: '🔔 وضعیت اعلان‌ها', callback_data: 'notify' },
      ],
    ],
  };
}

function splitMessage(text) {
  const input = String(text ?? '');
  if (input.length <= APP.maxTelegramText) return [input];
  const chunks = [];
  let remaining = input;
  while (remaining.length > APP.maxTelegramText) {
    let cut = remaining.lastIndexOf('\n', APP.maxTelegramText);
    if (cut < 500) cut = APP.maxTelegramText;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^\n+/, '');
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function fetchWithTimeout(url, init = {}, timeoutMs = APP.fetchTimeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    return await fetch(url, { redirect: 'follow', ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSource(source, options = {}) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const url = source.url.includes('?') ? `${source.url}&__v2sr=${stamp}` : `${source.url}?__v2sr=${stamp}`;
  let lastError = null;

  for (let attempt = 0; attempt < APP.rawRetryDelaysMs.length; attempt += 1) {
    if (APP.rawRetryDelaysMs[attempt] > 0) await sleep(APP.rawRetryDelaysMs[attempt]);
    try {
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          accept: 'text/plain,*/*',
          'cache-control': 'no-cache, no-store, max-age=0',
          pragma: 'no-cache',
          'user-agent': `${APP.name}/${APP.version}`,
        },
      });
      if (!response.ok) throw new Error(`${source.label}: GitHub HTTP ${response.status}`);
      const text = await response.text();
      if (!text.trim()) throw new Error(`${source.label}: فایل خالی است`);
      return {
        text,
        normalized: normalizeConfigBody(text),
        bytes: new TextEncoder().encode(text).byteLength,
        etag: response.headers.get('etag') || null,
        lastModified: response.headers.get('last-modified') || null,
        fetchedAt: nowIso(),
        requestUrl: url,
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`${source.label}: دریافت ناموفق بود`);
}

async function fetchGithubCommitMeta(fileName, env) {
  const branch = env?.REPO_BRANCH || 'main';
  const params = new URLSearchParams({ path: fileName, sha: branch, per_page: '1', page: '1' });
  const url = `${APP.repoApi}/commits?${params.toString()}&__v2sr=${Date.now()}`;
  try {
    const headers = {
      accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': APP.githubApiVersion,
      'user-agent': `${APP.name}/${APP.version}`,
      'cache-control': 'no-cache',
    };
    if (env?.GITHUB_TOKEN) headers.authorization = `Bearer ${env.GITHUB_TOKEN}`;
    const response = await fetchWithTimeout(url, { headers }, APP.githubTimeoutMs);
    if (!response.ok) return { ok: false, status: response.status, retryAfter: response.headers.get('retry-after') || null };
    const data = await response.json();
    const commit = data?.[0];
    if (!commit) return { ok: false, status: 404 };
    return {
      ok: true,
      sha: commit.sha || null,
      message: commit.commit?.message || '',
      authorDate: commit.commit?.author?.date || null,
      committerDate: commit.commit?.committer?.date || null,
      htmlUrl: commit.html_url || null,
    };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

async function getState(env) {
  const row = await env.DB.prepare('SELECT value FROM bot_state WHERE id = 1').first();
  if (!row?.value) return null;
  try { return JSON.parse(row.value); } catch { return null; }
}

async function putState(env, state) {
  await env.DB.prepare(`
    INSERT INTO bot_state(id, value, updated_at)
    VALUES (1, ?1, ?2)
    ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).bind(JSON.stringify(state), nowIso()).run();
}

async function acquireLock(env, holder) {
  const now = Date.now();
  const until = new Date(now + APP.lockSeconds * 1000).toISOString();
  await env.DB.prepare(`
    INSERT OR IGNORE INTO worker_lock(id, holder, lease_until) VALUES (1, '', '1970-01-01T00:00:00.000Z')
  `).run();
  const result = await env.DB.prepare(`
    UPDATE worker_lock
    SET holder = ?1, lease_until = ?2
    WHERE id = 1 AND (lease_until < ?3 OR holder = ?1)
  `).bind(holder, until, new Date(now).toISOString()).run();
  return Number(result?.meta?.changes || 0) > 0;
}

async function releaseLock(env, holder) {
  await env.DB.prepare(`UPDATE worker_lock SET holder = '', lease_until = '1970-01-01T00:00:00.000Z' WHERE id = 1 AND holder = ?1`).bind(holder).run();
}

async function upsertSubscriber(env, chat, fromUser = null) {
  const now = nowIso();
  const actor = fromUser || chat || {};
  const chatId = String(chat?.id ?? actor.id ?? '');
  const userId = String(actor.id ?? chat?.id ?? '');
  if (!chatId || !userId) throw new Error('شناسه کاربر/چت Telegram نامعتبر است.');
  await env.DB.prepare(`
    INSERT INTO subscribers(
      chat_id, user_id, username, first_name, last_name,
      active, notifications, last_sent_digest, last_sent_at,
      created_at, updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, 1, 1, NULL, NULL, ?6, ?6)
    ON CONFLICT(chat_id) DO UPDATE SET
      user_id = excluded.user_id,
      username = COALESCE(excluded.username, subscribers.username),
      first_name = COALESCE(excluded.first_name, subscribers.first_name),
      last_name = COALESCE(excluded.last_name, subscribers.last_name),
      active = 1,
      updated_at = excluded.updated_at
  `).bind(
    chatId,
    userId,
    actor.username || chat?.username || null,
    actor.first_name || chat?.first_name || null,
    actor.last_name || chat?.last_name || null,
    now,
  ).run();
}

async function setNotifications(env, chatId, enabled) {
  await env.DB.prepare('UPDATE subscribers SET notifications = ?1, updated_at = ?2 WHERE chat_id = ?3')
    .bind(enabled ? 1 : 0, nowIso(), String(chatId)).run();
}

async function markSubscriberSent(env, chatId, digest) {
  const now = nowIso();
  await env.DB.prepare('UPDATE subscribers SET last_sent_digest = ?1, last_sent_at = ?2, updated_at = ?2 WHERE chat_id = ?3')
    .bind(digest, now, String(chatId)).run();
}

function isBlockedTelegramError(description) {
  return /bot was blocked by the user|blocked by the user|user is deactivated|chat not found|bot can.t initiate conversation with a user|bot was kicked|chat_write_forbidden|user is inaccessible|bot was kicked from/i.test(String(description || ''));
}

async function deactivateSubscriber(env, chatId) {
  await env.DB.prepare('UPDATE subscribers SET active = 0, notifications = 0, updated_at = ?1 WHERE chat_id = ?2')
    .bind(nowIso(), String(chatId)).run();
}

async function sendTelegram(env, method, payload, form = false) {
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN تنظیم نشده است.');
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
  const init = { method: 'POST' };
  if (form) {
    init.body = payload;
  } else {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(payload);
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetchWithTimeout(url, init, 30000);
    let data;
    try { data = await response.json(); } catch { data = { ok: false, description: `HTTP ${response.status}` }; }
    if (response.ok && data.ok) return data.result;
    const error = new Error(data?.description || `Telegram HTTP ${response.status}`);
    error.telegram = data;
    const retryAfter = Number(data?.parameters?.retry_after || 0);
    if (response.status === 429 && retryAfter > 0 && attempt < 2) {
      await sleep(Math.min(retryAfter, 5) * 1000 + 150);
      continue;
    }
    throw error;
  }
  throw new Error('Telegram API: retry limit reached');
}

async function sendMessage(env, chatId, message, markup) {
  const chunks = splitMessage(message);
  let result = null;
  for (let i = 0; i < chunks.length; i++) {
    result = await sendTelegram(env, 'sendMessage', {
      chat_id: String(chatId),
      text: chunks[i],
      ...(i === chunks.length - 1 && markup ? { reply_markup: markup } : {}),
    });
  }
  return result;
}

async function sendDocument(env, chatId, text, fileName, caption, markup) {
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > APP.maxDocumentBytes) throw new Error(`فایل ${fileName} بزرگ‌تر از سقف فعلی Telegram Bot API است.`);
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('document', new Blob([text], { type: 'text/plain; charset=utf-8' }), fileName);
  form.append('caption', String(caption || '').slice(0, 1024));
  form.append('parse_mode', 'HTML');
  if (markup) form.append('reply_markup', JSON.stringify(markup));
  return sendTelegram(env, 'sendDocument', form, true);
}

async function createSnapshot(env, source, fetched, previousState = null) {
  const rawSha256 = await sha256Hex(fetched.text);
  const normalizedSha256 = await sha256Hex(fetched.normalized);
  const stats = await buildStats(fetched.text, env);
  const configDigest = await sha256Hex(stats.logicalIds.join('\n'));
  const githubMeta = await fetchGithubCommitMeta(source.fileName, env);
  const embeddedIso = stats.embeddedTimestamps?.latestIso || null;
  const githubIso = githubMeta?.ok ? (githubMeta.committerDate || githubMeta.authorDate || null) : null;
  const lastModifiedIso = fetched.lastModified ? (new Date(fetched.lastModified).toISOString()) : null;
  const candidates = [
    githubIso ? { iso: githubIso, basis: 'github-commit' } : null,
    lastModifiedIso ? { iso: lastModifiedIso, basis: 'github-last-modified' } : null,
    embeddedIso ? { iso: embeddedIso, basis: 'config-embedded-timestamp' } : null,
  ].filter(Boolean);
  candidates.sort((a, b) => new Date(b.iso).getTime() - new Date(a.iso).getTime());
  const effective = candidates[0] || { iso: nowIso(), basis: 'worker-time' };

  return {
    schema: 3,
    key: source.key,
    label: source.label,
    url: source.url,
    fileName: source.fileName,
    fileBytes: fetched.bytes,
    fetchedAt: fetched.fetchedAt || nowIso(),
    etag: fetched.etag || null,
    lastModified: fetched.lastModified || null,
    rawSha256,
    normalizedSha256,
    configSha256: configDigest,
    sourceUpdatedAt: effective.iso,
    sourceDateBasis: effective.basis,
    githubCommitSha: githubMeta?.ok ? githubMeta.sha : (previousState?.githubCommitSha || null),
    githubCommitMessage: githubMeta?.ok ? githubMeta.message : (previousState?.githubCommitMessage || null),
    githubCommitUrl: githubMeta?.ok ? githubMeta.htmlUrl : (previousState?.githubCommitUrl || null),
    githubCommitDate: githubMeta?.ok ? (githubMeta.committerDate || githubMeta.authorDate || null) : (previousState?.githubCommitDate || null),
    githubMetaOk: Boolean(githubMeta?.ok),
    githubMetaStatus: githubMeta?.status || null,
    githubMetaError: githubMeta?.error || null,
    stats,
    firstSeen: !previousState,
    previousDigest: previousState?.configSha256 || null,
  };
}

function diffSnapshots(previous, current) {
  if (!previous) {
    return {
      added: current.stats.logicalUniqueCount,
      removed: 0,
      unchanged: 0,
      firstRun: true,
    };
  }
  const oldSet = new Set(previous.stats.logicalIds || []);
  const newSet = new Set(current.stats.logicalIds || []);
  let added = 0;
  let removed = 0;
  for (const id of newSet) if (!oldSet.has(id)) added++;
  for (const id of oldSet) if (!newSet.has(id)) removed++;
  return {
    added,
    removed,
    unchanged: Math.max(0, newSet.size - added),
    firstRun: false,
  };
}

function archiveLimits(env) {
  // D1 Free databases currently max out at 500 MB. Keep this archive's estimated usage
  // intentionally lower to leave room for subscriber/state tables and SQLite indexes.
  return {
    maxSnapshots: Math.max(5, Math.min(Number(env.ARCHIVE_MAX_SNAPSHOTS || 250), 300)),
    maxConfigRows: Math.max(500, Math.min(Number(env.ARCHIVE_MAX_CONFIG_ROWS || 25000), 100000)),
    maxBytes: Math.max(10_000_000, Math.min(Number(env.ARCHIVE_MAX_BYTES || 300_000_000), 350_000_000)),
  };
}

function extractTimestampInName(line, timezone = 'Asia/Tehran') {
  const name = extractName(line);
  const match = name.match(/(20\d{2}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  return match ? parseLocalDateTime(`${match[1]}T${match[2]}`, timezone) : null;
}

async function archiveSnapshotIfMissing(env, snapshot, text) {
  const existing = await env.DB.prepare(`
    SELECT id FROM subscription_snapshots
    WHERE source_key = ?1 AND normalized_sha256 = ?2
    LIMIT 1
  `).bind(snapshot.key || 'mix', snapshot.normalizedSha256).first();
  if (existing?.id) {
    const hasAnyConfigs = await env.DB.prepare('SELECT 1 AS ok FROM archived_configs WHERE snapshot_id = ?1 LIMIT 1').bind(Number(existing.id)).first();
    // If a previous invocation failed mid-archive, finish populating this Snapshot instead of
    // treating an incomplete archive as complete. A populated archive remains idempotent.
    if (hasAnyConfigs) return Number(existing.id);
  }

  const timezone = env.CONFIG_TIMESTAMP_TIMEZONE || env.TIMEZONE || 'Asia/Tehran';
  const allLines = extractConfigLines(text);
  const uniqueLines = [...new Set(allLines)].slice(0, APP.maxArchiveLinesPerSnapshot);
  const now = nowIso();
  const estimatedFileStorage = new TextEncoder().encode(text).byteLength;
  // D1's maximum row size is 2 MB. Archive the exact file text only when safely under that limit.
  const fileTextStored = estimatedFileStorage <= 1_500_000 ? String(text) : '';
  const insertSnapshot = await env.DB.prepare(`
    INSERT OR IGNORE INTO subscription_snapshots(
      source_key, file_name, source_updated_at, source_date_basis, captured_at,
      github_commit_sha, github_commit_url, raw_sha256, normalized_sha256, config_sha256,
      file_bytes, line_count, config_count, logical_count, embedded_timestamp,
      file_text, estimated_bytes
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
  `).bind(
    snapshot.key || 'mix', snapshot.fileName || 'Mix.txt', snapshot.sourceUpdatedAt || now,
    snapshot.sourceDateBasis || 'worker-time', now, snapshot.githubCommitSha || null,
    snapshot.githubCommitUrl || null, snapshot.rawSha256, snapshot.normalizedSha256,
    snapshot.configSha256, Number(snapshot.fileBytes || estimatedFileStorage),
    Number(snapshot.stats?.totalLines || allLines.length),
    uniqueLines.length, Number(snapshot.stats?.logicalUniqueCount || uniqueLines.length),
    snapshot.stats?.embeddedTimestamps?.latest || null, fileTextStored,
    estimatedFileStorage + 512,
  ).run();

  const row = await env.DB.prepare(`
    SELECT id FROM subscription_snapshots
    WHERE source_key = ?1 AND normalized_sha256 = ?2
    LIMIT 1
  `).bind(snapshot.key || 'mix', snapshot.normalizedSha256).first();
  if (!row?.id) throw new Error('ذخیره نسخه آرشیو در D1 انجام نشد.');
  const snapshotId = Number(row.id);

  // A duplicate concurrent insert may have won the unique-key race; do not duplicate config rows.
  const alreadyHasConfigs = await env.DB.prepare('SELECT 1 AS ok FROM archived_configs WHERE snapshot_id = ?1 LIMIT 1').bind(snapshotId).first();
  if (!alreadyHasConfigs && uniqueLines.length) {
    const metas = await Promise.all(uniqueLines.map(async (line, index) => {
      const country = countryFromText(`${line}\n${extractName(line)}`);
      const embedded = extractTimestampInName(line, timezone);
      const logicalId = await sha256Hex(logicalCanonical(line));
      const encodedBytes = new TextEncoder().encode(line).byteLength;
      return {
        lineNo: index + 1, line, logicalId, protocol: protocolOf(line),
        countryCode: country.code || 'XX', countryName: country.name,
        countryFlag: country.flag, name: extractName(line), embedded,
        estimatedBytes: encodedBytes + 220,
      };
    }));
    for (let i = 0; i < metas.length; i += 80) {
      const statements = metas.slice(i, i + 80).map(item => env.DB.prepare(`
        INSERT INTO archived_configs(
          snapshot_id, source_key, line_no, raw_line, logical_id, protocol,
          country_code, country_name, country_flag, config_name, embedded_timestamp, estimated_bytes
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
      `).bind(
        snapshotId, snapshot.key || 'mix', item.lineNo, item.line, item.logicalId,
        item.protocol, item.countryCode, item.countryName, item.countryFlag,
        item.name, item.embedded, item.estimatedBytes,
      ));
      await env.DB.batch(statements);
    }
  }

  await pruneArchive(env);
  return snapshotId;
}

async function pruneArchive(env) {
  const limits = archiveLimits(env);
  for (let pass = 0; pass < 40; pass += 1) {
    const counts = await env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM subscription_snapshots) AS snapshots,
        (SELECT COUNT(*) FROM archived_configs) AS configs,
        (SELECT COALESCE(SUM(estimated_bytes), 0) FROM subscription_snapshots) +
        (SELECT COALESCE(SUM(estimated_bytes), 0) FROM archived_configs) AS estimate_bytes
    `).first();
    const tooManySnapshots = Number(counts?.snapshots || 0) > limits.maxSnapshots;
    const tooManyConfigs = Number(counts?.configs || 0) > limits.maxConfigRows;
    const tooLarge = Number(counts?.estimate_bytes || 0) > limits.maxBytes;
    if (!tooManySnapshots && !tooManyConfigs && !tooLarge) break;

    // Always preserve the newest snapshot and any snapshot used by an active text-delivery job.
    const oldest = await env.DB.prepare(`
      SELECT s.id FROM subscription_snapshots s
      WHERE s.id < (SELECT COALESCE(MAX(id), 0) FROM subscription_snapshots)
        AND s.id NOT IN (
          SELECT snapshot_id FROM text_delivery_jobs WHERE status IN ('queued', 'running')
        )
      ORDER BY s.id ASC LIMIT 1
    `).first();
    if (!oldest?.id) break;
    const id = Number(oldest.id);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM archived_configs WHERE snapshot_id = ?1').bind(id),
      env.DB.prepare('DELETE FROM subscription_snapshots WHERE id = ?1').bind(id),
      env.DB.prepare('DELETE FROM text_delivery_jobs WHERE snapshot_id = ?1 AND status IN (\'done\', \'failed\')').bind(id),
    ]);
  }
  // Compact abandoned jobs; active jobs are protected.
  await env.DB.prepare(`DELETE FROM text_delivery_jobs WHERE status IN ('done', 'failed') AND created_at < datetime('now', '-14 days')`).run();
}

async function getArchiveIdByDigest(env, normalizedSha256) {
  const row = await env.DB.prepare(`
    SELECT id FROM subscription_snapshots WHERE source_key = 'mix' AND normalized_sha256 = ?1 LIMIT 1
  `).bind(normalizedSha256).first();
  return row?.id ? Number(row.id) : null;
}

async function getArchiveSnapshot(env, snapshotId) {
  return env.DB.prepare('SELECT * FROM subscription_snapshots WHERE id = ?1').bind(Number(snapshotId)).first();
}

function filterSql(job, start = 2) {
  let sql = '';
  const params = [];
  let index = start;
  if (job.filter_country) { sql += ` AND country_code = ?${index++}`; params.push(job.filter_country); }
  if (job.filter_protocol) { sql += ` AND UPPER(protocol) = ?${index++}`; params.push(job.filter_protocol.toUpperCase()); }
  return { sql, params, nextIndex: index };
}

async function countArchivedConfigs(env, snapshotId, country = null, protocol = null) {
  let sql = 'SELECT COUNT(*) AS count FROM archived_configs WHERE snapshot_id = ?1';
  const params = [Number(snapshotId)];
  if (country) { params.push(country); sql += ` AND country_code = ?${params.length}`; }
  if (protocol) { params.push(protocol.toUpperCase()); sql += ` AND UPPER(protocol) = ?${params.length}`; }
  const row = await env.DB.prepare(sql).bind(...params).first();
  return Number(row?.count || 0);
}

async function createTextDeliveryJob(env, chatId, snapshotId, filters, origin) {
  const snapshot = await getArchiveSnapshot(env, snapshotId);
  if (!snapshot) throw new Error('نسخه انتخاب‌شده در آرشیو وجود ندارد یا برای آزادشدن فضا حذف شده است.');
  const country = filters?.country || null;
  const protocol = filters?.protocol ? String(filters.protocol).toUpperCase() : null;
  const total = await countArchivedConfigs(env, snapshotId, country, protocol);
  if (!total) {
    await sendMessage(env, chatId, '🔎 در این نسخه کانفیگی با فیلتر انتخاب‌شده پیدا نشد.', mainKeyboard());
    return null;
  }
  const active = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM text_delivery_jobs
    WHERE chat_id = ?1 AND status IN ('queued', 'running')
  `).bind(String(chatId)).first();
  if (Number(active?.count || 0) >= 2) {
    await sendMessage(env, chatId, '⏳ دو ارسال متنی برای این چت در صف هستند. ابتدا بگذار ارسال فعلی تمام شود.', mainKeyboard());
    return null;
  }

  const jobId = crypto.randomUUID();
  const filterLabel = [
    country ? `کشور ${country}` : null,
    protocol ? `پروتکل ${protocol}` : null,
  ].filter(Boolean).join(' · ') || 'همه کانفیگ‌ها';
  await env.DB.prepare(`
    INSERT INTO text_delivery_jobs(
      job_id, chat_id, snapshot_id, filter_country, filter_protocol, filter_label,
      last_config_id, part_no, total_count, status, created_at, updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, 0, ?7, 'queued', ?8, ?8)
  `).bind(jobId, String(chatId), Number(snapshotId), country, protocol, filterLabel, total, nowIso()).run();
  await sendHtmlMessage(env, chatId,
    `📋 <b>ارسال متنی کانفیگ‌ها آماده شد</b>\n\n` +
    `🗃 نسخه: <code>#${Number(snapshotId)}</code>\n` +
    `🔎 فیلتر: <b>${escapeHtml(filterLabel)}</b>\n` +
    `📦 تعداد کانفیگ: <code>${formatNumber(total)}</code>\n\n` +
    'هر پیام یک بلوک <code>monospace</code> جدا دارد؛ روی بلوک بزن و گزینه Copy را انتخاب کن.\n' +
    'ارسال در چند بخش ادامه پیدا می‌کند تا همه کانفیگ‌های منطبق برسند.', mainKeyboard());
  try {
    await processTextDeliveryBatch(env, jobId, origin);
  } catch (error) {
    await env.DB.prepare(`UPDATE text_delivery_jobs SET status = 'failed', updated_at = ?1 WHERE job_id = ?2`).bind(nowIso(), jobId).run();
    console.error('initial text delivery failed', jobId, error?.stack || error);
    await sendMessage(env, chatId, '⚠️ ارسال متنی متوقف شد. چند لحظه بعد دوباره /text را اجرا کن؛ Snapshot آرشیو حذف نشده است.', mainKeyboard());
  }
  return jobId;
}

function makeTextChunks(rows, filterLabel, startingPart) {
  const chunks = [];
  let current = [];
  let escapedLength = 0;
  let lastId = 0;
  const flush = () => {
    if (!current.length) return;
    chunks.push({
      rows: current,
      lastId,
      body: current.map(row => escapeHtml(row.raw_line)).join('\n'),
    });
    current = [];
    escapedLength = 0;
  };
  for (const row of rows) {
    const escaped = escapeHtml(row.raw_line);
    if (escaped.length > 3800) {
      // A single URI longer than Telegram's message limit cannot fit in one copyable message.
      // Keep it intact in a document rather than silently truncating it.
      if (current.length) flush();
      chunks.push({ rows: [row], lastId: Number(row.id), oversized: true, body: '' });
      continue;
    }
    const addition = escaped.length + (current.length ? 1 : 0);
    if (current.length && escapedLength + addition > APP.maxPreEscapedChars) flush();
    current.push(row);
    escapedLength += escaped.length + (current.length > 1 ? 1 : 0);
    lastId = Number(row.id);
  }
  flush();
  return chunks.map((chunk, i) => ({ ...chunk, partNo: startingPart + i + 1, filterLabel }));
}

async function processTextDeliveryBatch(env, jobId, origin) {
  const job = await env.DB.prepare(`SELECT * FROM text_delivery_jobs WHERE job_id = ?1`).bind(jobId).first();
  if (!job || !['queued', 'running'].includes(job.status)) return { done: true, missing: !job };
  await env.DB.prepare(`UPDATE text_delivery_jobs SET status = 'running', updated_at = ?1 WHERE job_id = ?2`).bind(nowIso(), jobId).run();

  const built = filterSql(job, 3);
  const sql = `SELECT id, raw_line FROM archived_configs
    WHERE snapshot_id = ?1 AND id > ?2${built.sql}
    ORDER BY id ASC LIMIT 180`;
  const rows = await env.DB.prepare(sql).bind(Number(job.snapshot_id), Number(job.last_config_id || 0), ...built.params).all();
  const configs = rows.results || [];
  if (!configs.length) {
    await env.DB.prepare(`UPDATE text_delivery_jobs SET status = 'done', updated_at = ?1 WHERE job_id = ?2`).bind(nowIso(), jobId).run();
    try {
      await sendHtmlMessage(env, job.chat_id,
        `✅ <b>ارسال کانفیگ‌ها کامل شد</b>\n📦 تعداد کانفیگ‌ها: <code>${formatNumber(job.total_count)}</code>\n🧩 نسخه آرشیو: <code>#${job.snapshot_id}</code>`, mainKeyboard());
    } catch (error) { console.error('text job completion message failed', error?.message || error); }
    return { done: true };
  }

  const chunks = makeTextChunks(configs, job.filter_label || 'کانفیگ‌ها', Number(job.part_no || 0));
  let delivered = 0;
  let cursor = Number(job.last_config_id || 0);
  let partNo = Number(job.part_no || 0);
  for (const chunk of chunks) {
    if (delivered >= APP.textBatchMessages) break;
    if (chunk.oversized) {
      // Send the original long URI as a document, preserving it exactly instead of truncating.
      await sendDocument(env, job.chat_id, chunk.rows[0].raw_line + '\n', `V2raySub_config_${chunk.rows[0].id}.txt`,
        `📎 کانفیگ طولانی‌تر از محدودیت متن قابل‌کپی · نسخه #${job.snapshot_id}`, undefined);
    } else {
      const title = `📋 <b>${escapeHtml(job.filter_label || 'کانفیگ‌ها')}</b> · <code>بخش ${chunk.partNo}</code>\n`;
      const html = `${title}<pre>${chunk.body}</pre>`;
      await sendTelegram(env, 'sendMessage', { chat_id: String(job.chat_id), text: html, parse_mode: 'HTML' });
    }
    cursor = Number(chunk.lastId);
    partNo = Number(chunk.partNo);
    await env.DB.prepare(`UPDATE text_delivery_jobs SET last_config_id = ?1, part_no = ?2, updated_at = ?3 WHERE job_id = ?4`)
      .bind(cursor, partNo, nowIso(), jobId).run();
    delivered += 1;
    if (delivered < APP.textBatchMessages) await sleep(1050);
  }

  const next = await env.DB.prepare(`
    SELECT 1 AS found FROM archived_configs WHERE snapshot_id = ?1 AND id > ?2${built.sql} LIMIT 1
  `).bind(Number(job.snapshot_id), cursor, ...built.params).first();
  if (next?.found) {
    // A chained, authenticated internal invocation keeps each Worker invocation under free-tier subrequest limits.
    const internalUrl = `${origin.replace(/\/$/, '')}/internal/process-text-job`;
    const response = await fetchWithTimeout(internalUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Text-Queue-Key': String(env.ADMIN_KEY || '') },
      body: JSON.stringify({ job_id: jobId }),
    }, 10000);
    if (!response.ok) {
      console.error('could not continue text job', jobId, response.status);
      await env.DB.prepare(`UPDATE text_delivery_jobs SET status = 'failed', updated_at = ?1 WHERE job_id = ?2`).bind(nowIso(), jobId).run();
      try { await sendMessage(env, job.chat_id, '⚠️ ادامه ارسال متن به مشکل خورد. دوباره /text را بزن تا ارسال تازه شروع شود.', mainKeyboard()); } catch {}
      return { done: false, failed: true };
    }
    return { done: false, chained: true, sentMessages: delivered, cursor };
  }

  await env.DB.prepare(`UPDATE text_delivery_jobs SET status = 'done', updated_at = ?1 WHERE job_id = ?2`).bind(nowIso(), jobId).run();
  try {
    await sendHtmlMessage(env, job.chat_id,
      `✅ <b>ارسال کانفیگ‌ها کامل شد</b>\n📦 تعداد کانفیگ‌ها: <code>${formatNumber(job.total_count)}</code>\n🧩 نسخه آرشیو: <code>#${job.snapshot_id}</code>`, mainKeyboard());
  } catch (error) { console.error('text job completion message failed', error?.message || error); }
  return { done: true, sentMessages: delivered };
}

async function startTextForSnapshot(env, chatId, snapshotId, filters, origin) {
  await createTextDeliveryJob(env, chatId, snapshotId, filters || {}, origin);
}

async function ensureLatestArchive(env, sync) {
  if (!sync?.snapshot) throw new Error('Snapshot فعلی در دسترس نیست.');
  if (!sync.snapshot.archiveId) {
    const text = sync.fetched?.text || (await fetchSource(SOURCES[0], { cacheBust: true })).text;
    sync.snapshot.archiveId = await archiveSnapshotIfMissing(env, sync.snapshot, text);
  }
  return Number(sync.snapshot.archiveId);
}

async function archiveHistoryKeyboard(env, snapshotId, offset = 0) {
  const pageSize = 8;
  const [result, totalRow] = await Promise.all([
    env.DB.prepare(`
      SELECT id, source_updated_at, captured_at, config_count, config_sha256
      FROM subscription_snapshots WHERE source_key = 'mix' ORDER BY id DESC LIMIT ?1 OFFSET ?2
    `).bind(pageSize, Number(offset)).all(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM subscription_snapshots WHERE source_key = 'mix'`).first(),
  ]);
  const rows = result.results || [];
  const total = Number(totalRow?.count || 0);
  const keyboard = [];
  for (let i = 0; i < rows.length; i += 2) {
    const pair = rows.slice(i, i + 2).map(row => ({
      text: `${Number(row.id) === Number(snapshotId) ? '🟢 ' : '🗃 ' }#${row.id} · ${formatTehran(row.source_updated_at || row.captured_at).slice(0, 16)} · ${row.config_count}`,
      callback_data: `hist|${row.id}`,
    }));
    keyboard.push(pair);
  }
  const nav = [];
  if (offset > 0) nav.push({ text: '⬅️ جدیدتر', callback_data: `histpage|${Math.max(0, offset - pageSize)}` });
  if (offset + pageSize < total) nav.push({ text: 'قدیمی‌تر ➡️', callback_data: `histpage|${offset + pageSize}` });
  if (nav.length) keyboard.push(nav);
  keyboard.push([{ text: '⬅️ منوی اصلی', callback_data: 'menu' }]);
  return { inline_keyboard: keyboard };
}

async function sendHistoryList(env, chatId, offset = 0) {
  const sync = await runSync(env, { broadcast: false });
  if (sync.locked) throw new Error('در حال بررسی آخرین نسخه است؛ چند لحظه بعد دوباره تلاش کنید.');
  const latestId = await ensureLatestArchive(env, sync);
  const keyboard = await archiveHistoryKeyboard(env, latestId, offset);
  await sendHtmlMessage(env, chatId,
    '<blockquote>🗃 <b>آرشیو نسخه‌های Mix</b>\nنسخه‌ای را انتخاب کن تا کانفیگ‌های همان لحظه را دریافت کنی.</blockquote>\n' +
    '<i>نسخه‌های قدیمی‌تر به‌ترتیب FIFO حذف می‌شوند تا فضای دیتابیس آزاد بماند؛ جدیدترین نسخه همیشه حفظ می‌شود.</i>', keyboard);
}

async function sendArchiveDetails(env, chatId, snapshotId, origin) {
  const row = await getArchiveSnapshot(env, snapshotId);
  if (!row) throw new Error('این نسخه دیگر در آرشیو نیست؛ احتمالاً برای آزادسازی فضا پاک شده است.');
  const available = await countArchivedConfigs(env, snapshotId);
  const keyboard = {
    inline_keyboard: [
      [{ text: '📋 تمام کانفیگ‌ها به‌صورت متن', callback_data: `text|${snapshotId}` }],
      [{ text: '🌍 انتخاب کشور', callback_data: `cl|${snapshotId}` }, { text: '🔌 انتخاب پروتکل', callback_data: `pl|${snapshotId}` }],
      [{ text: '📎 فایل دقیق همین نسخه', callback_data: `file|${snapshotId}` }],
      [{ text: '⬅️ بازگشت به آرشیو', callback_data: 'history' }],
    ],
  };
  await sendHtmlMessage(env, chatId,
    `<blockquote>🗃 <b>نسخه آرشیو #${row.id}</b></blockquote>\n` +
    `<pre>╭─[ 📅 زمان نسخه ]\n│ زمان منبع : ${escapeHtml(formatTehran(row.source_updated_at))}\n│ زمان ذخیره: ${escapeHtml(formatTehran(row.captured_at))}\n│ کانفیگ‌ها : ${formatNumber(row.config_count)}\n│ اندازه فایل: ${escapeHtml(formatBytes(row.file_bytes))}\n│ مبنا       : ${escapeHtml(row.source_date_basis || 'نامشخص')}\n╰────────────────────</pre>\n` +
    `<code>SHA-256: ${escapeHtml(String(row.raw_sha256 || '').slice(0, 24))}…</code>\n` +
    `📋 کانفیگ‌های قابل فیلتر در این نسخه: <b>${formatNumber(available)}</b>`, keyboard);
}

async function sendCountryPicker(env, chatId, snapshotId) {
  const rows = await env.DB.prepare(`
    SELECT country_code, country_name, country_flag, COUNT(*) AS count
    FROM archived_configs WHERE snapshot_id = ?1
    GROUP BY country_code, country_name, country_flag ORDER BY count DESC LIMIT 40
  `).bind(Number(snapshotId)).all();
  const countries = rows.results || [];
  if (!countries.length) return sendMessage(env, chatId, '🌍 برای این نسخه آمار کشور ندارم.', mainKeyboard());
  const keyboard = [];
  for (let i = 0; i < countries.length; i += 2) {
    keyboard.push(countries.slice(i, i + 2).map(c => ({
      text: `${c.country_flag || '🏳️'} ${c.country_name} · ${c.count}`,
      callback_data: `country|${snapshotId}|${String(c.country_code || 'XX').slice(0, 2)}`,
    })));
  }
  keyboard.push([{ text: '📋 همه کشورها / بازگشت', callback_data: `hist|${snapshotId}` }]);
  await sendHtmlMessage(env, chatId, `<blockquote>🌍 <b>انتخاب کشور · نسخه #${snapshotId}</b>\nکانفیگ‌های کشور موردنظر را به‌صورت متن قابل کپی می‌فرستم.</blockquote>`, { inline_keyboard: keyboard });
}

async function sendProtocolPicker(env, chatId, snapshotId) {
  const rows = await env.DB.prepare(`
    SELECT UPPER(protocol) AS protocol, COUNT(*) AS count
    FROM archived_configs WHERE snapshot_id = ?1 GROUP BY UPPER(protocol) ORDER BY count DESC LIMIT 30
  `).bind(Number(snapshotId)).all();
  const protocols = rows.results || [];
  if (!protocols.length) return sendMessage(env, chatId, '🔌 برای این نسخه آمار پروتکل ندارم.', mainKeyboard());
  const keyboard = [];
  for (let i = 0; i < protocols.length; i += 2) {
    keyboard.push(protocols.slice(i, i + 2).map(p => ({
      text: `🔌 ${p.protocol} · ${p.count}`,
      callback_data: `protocol|${snapshotId}|${String(p.protocol).slice(0, 12)}`,
    })));
  }
  keyboard.push([{ text: '⬅️ بازگشت', callback_data: `hist|${snapshotId}` }]);
  await sendHtmlMessage(env, chatId, `<blockquote>🔌 <b>انتخاب پروتکل · نسخه #${snapshotId}</b></blockquote>`, { inline_keyboard: keyboard });
}

async function sendArchivedFile(env, chatId, snapshotId) {
  const row = await getArchiveSnapshot(env, snapshotId);
  if (!row) throw new Error('این نسخه از آرشیو حذف شده است.');
  if (!row.file_text) {
    await sendMessage(env, chatId, '⚠️ متن اصلی این نسخه از سقف اندازه هر ردیف D1 بزرگ‌تر بوده و ذخیره نشده است؛ کانفیگ‌های آن نسخه همچنان از گزینه «تمام کانفیگ‌ها به‌صورت متن» قابل دریافت‌اند.', mainKeyboard());
    return;
  }
  const snap = {
    fileName: row.file_name || 'Mix.txt', fileBytes: Number(row.file_bytes || 0),
    stats: { logicalUniqueCount: Number(row.logical_count || row.config_count || 0), exactDuplicates: 0 },
    sourceUpdatedAt: row.source_updated_at, rawSha256: row.raw_sha256,
  };
  const sendTime = nowIso();
  await sendDocument(env, chatId, row.file_text, `V2ray_Sub_Mix_history_${row.id}.txt`, shortDocumentCaption(snap, sendTime, `🗃 نسخه آرشیو #${row.id}`), mainKeyboard());
}

async function fetchAndSnapshot(env) {
  const source = SOURCES[0];
  const fetched = await fetchSource(source, { cacheBust: true });
  const state = await getState(env);
  const previous = state?.snapshot || null;
  const quickRawSha = await sha256Hex(fetched.text);
  const quickNormalizedSha = await sha256Hex(fetched.normalized);

  // IMPORTANT: compare normalized-to-normalized. The old code compared a normalized
  // hash with rawSha256, which made every poll look changed and made metadata stale.
  if (previous?.normalizedSha256 === quickNormalizedSha) {
    const currentStats = await buildStats(fetched.text, env);
    const currentEmbeddedIso = currentStats.embeddedTimestamps?.latestIso || null;
    const embeddedNewer = Boolean(currentEmbeddedIso && (!previous.sourceUpdatedAt || new Date(currentEmbeddedIso) > new Date(previous.sourceUpdatedAt)));
    const rawChanged = previous.rawSha256 !== quickRawSha;

    if (rawChanged || embeddedNewer) {
      const refreshed = await createSnapshot(env, source, fetched, previous);
      refreshed.firstSeen = false;
      refreshed.lastChange = previous.lastChange || { added: 0, removed: 0, unchanged: refreshed.stats.logicalUniqueCount, firstRun: false };
      return { changed: false, metadataChanged: true, meaningfulChange: false, fetched, snapshot: refreshed, previous, change: refreshed.lastChange };
    }

    return {
      changed: false,
      metadataChanged: false,
      meaningfulChange: false,
      fetched,
      snapshot: previous,
      previous,
      change: previous.lastChange || { added: 0, removed: 0, unchanged: previous.stats?.logicalUniqueCount || 0, firstRun: false },
    };
  }

  const snapshot = await createSnapshot(env, source, fetched, previous);
  const change = diffSnapshots(previous, snapshot);
  const meaningfulChange = !previous || previous.configSha256 !== snapshot.configSha256;
  snapshot.firstSeen = !previous;
  snapshot.lastChange = change;
  return { changed: true, metadataChanged: true, meaningfulChange, fetched, snapshot, previous, change };
}

async function runSync(env, { broadcast = true, forceBroadcast = false, origin = null } = {}) {
  const holder = crypto.randomUUID();
  if (!await acquireLock(env, holder)) return { locked: true, changed: false, meaningfulChange: false };

  try {
    const result = await fetchAndSnapshot(env);
    // Archive the current version before updating state or broadcasting. The unique index makes this idempotent.
    if (result.snapshot && result.fetched) {
      result.snapshot.archiveId = await archiveSnapshotIfMissing(env, result.snapshot, result.fetched.text);
    }
    const state = await getState(env);
    const checkedAt = nowIso();
    const nextState = {
      ...(state || {}),
      updatedAt: checkedAt,
      monitor: {
        ...(state?.monitor || {}),
        lastCheckAt: checkedAt,
        lastCheckOk: true,
        lastError: null,
        lastMeaningfulChangeAt: result.meaningfulChange ? checkedAt : (state?.monitor?.lastMeaningfulChangeAt || null),
        lastCronAt: state?.monitor?.lastCronAt || null,
      },
    };

    if (result.snapshot) nextState.snapshot = result.snapshot;

    if (result.changed) {
      nextState.pending = result.meaningfulChange
        ? meaningfulPendingPayload(result.snapshot, result.change, true)
        : (state?.pending || null);
      if (result.snapshot.firstSeen && !forceBroadcast) nextState.pending = null;
      await putState(env, nextState);
      if (broadcast && result.meaningfulChange) await processPendingBroadcast(env, origin);
    } else if (result.metadataChanged) {
      nextState.snapshot = result.snapshot;
      await putState(env, nextState);
      if (broadcast) await processPendingBroadcast(env, origin);
    } else {
      await putState(env, nextState);
      if (broadcast) await processPendingBroadcast(env, origin);
    }

    return { ...result, pending: nextState.pending };
  } catch (error) {
    const state = await getState(env);
    try {
      const failedAt = nowIso();
      await putState(env, {
        ...(state || {}),
        updatedAt: failedAt,
        monitor: { ...(state?.monitor || {}), lastCheckAt: failedAt, lastCheckOk: false, lastError: error?.message || String(error) },
      });
    } catch {}
    throw error;
  } finally {
    await releaseLock(env, holder);
  }
}

function meaningfulPendingPayload(snapshot, change, enabled) {
  if (!enabled) return null;
  return {
    digest: snapshot.configSha256,
    sourceKey: snapshot.key || 'mix',
    sourceFileName: snapshot.fileName || 'Mix.txt',
    rawSha256: snapshot.rawSha256,
    cursor: 0,
    createdAt: nowIso(),
    change,
  };
}

async function recordBroadcastDelivery(env, digest, chatId, sourceKey, status, attempts, error = null) {
  const now = nowIso();
  await env.DB.prepare(`
    INSERT INTO broadcast_delivery(digest, chat_id, source_key, status, attempts, last_error, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
    ON CONFLICT(digest, chat_id, source_key) DO UPDATE SET
      status = excluded.status,
      attempts = excluded.attempts,
      last_error = excluded.last_error,
      updated_at = excluded.updated_at
  `).bind(String(digest), String(chatId), String(sourceKey || 'mix'), String(status), Number(attempts || 0), error ? String(error).slice(0, 500) : null, now).run();
}

async function processPendingBroadcast(env, origin = null) {
  const state = await getState(env);
  const pending = state?.pending;
  const snapshot = state?.snapshot;
  if (!pending || !snapshot) return { sent: 0, pending: 0, done: true };

  const sourceKey = String(pending.sourceKey || snapshot.key || 'mix');
  const source = SOURCES.find(item => item.key === sourceKey) || SOURCES[0];
  const fetched = await fetchSource(source, { cacheBust: true });
  const currentRawSha = await sha256Hex(fetched.text);
  const currentNormalizedSha = await sha256Hex(fetched.normalized);
  if (currentRawSha !== snapshot.rawSha256 || (snapshot.normalizedSha256 && currentNormalizedSha !== snapshot.normalizedSha256)) {
    const retryCount = Number(pending.retryCount || 0) + 1;
    const latestState = await getState(env);
    if (latestState?.pending?.digest === pending.digest) {
      latestState.pending.retryCount = retryCount;
      latestState.pending.lastError = 'Raw GitHub هنوز با Snapshot آماده ارسال همگام نیست.';
      await putState(env, latestState);
    }
    if (origin && retryCount <= 5) {
      const internalUrl = `${origin.replace(/\/$/, '')}/internal/process-broadcast`;
      await fetchWithTimeout(internalUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Text-Queue-Key': String(env.ADMIN_KEY || '') },
        body: JSON.stringify({ digest: pending.digest, retry_count: retryCount }),
      }, 10000).catch(error => console.error('could not retry stale-source broadcast', error?.message || error));
    }
    return { sent: 0, pending: -1, done: false, warning: 'منبع هنوز با Snapshot آماده ارسال همگام نیست.' };
  }

  const batchSize = Math.max(1, Math.min(Number(env.BROADCAST_BATCH || APP.defaultBroadcastBatch), 8));
  const maxAttempts = APP.maxBroadcastAttemptsPerUser;
  // Deliberately do not use pending.cursor as a filter: a prior interrupted/retried campaign
  // must be able to discover every still-unsent subscriber, including rows beyond an old cursor.
  const rows = await env.DB.prepare(`
    SELECT s.rowid AS db_rowid, s.chat_id, COALESCE(d.attempts, 0) AS attempts
    FROM subscribers s
    LEFT JOIN broadcast_delivery d
      ON d.digest = ?1 AND d.chat_id = s.chat_id AND d.source_key = ?2
    WHERE s.active = 1 AND s.notifications = 1
      AND (s.last_sent_digest IS NULL OR s.last_sent_digest != ?1)
      AND (d.status IS NULL OR d.status IN ('pending', 'retry', 'sending'))
      AND COALESCE(d.attempts, 0) < ?3
    ORDER BY s.rowid ASC
    LIMIT ?4
  `).bind(pending.digest, sourceKey, maxAttempts, batchSize).all();

  const users = rows.results || [];
  if (!users.length) {
    const deliveryCounts = await env.DB.prepare(`
      SELECT
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN status = 'retry' THEN 1 ELSE 0 END) AS retry,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked,
        SUM(CASE WHEN status = 'sending' THEN 1 ELSE 0 END) AS sending
      FROM broadcast_delivery WHERE digest = ?1 AND source_key = ?2
    `).bind(pending.digest, sourceKey).first();
    const latestState = await getState(env);
    if (latestState?.pending?.digest === pending.digest) {
      latestState.pending = null;
      latestState.lastBroadcast = {
        digest: pending.digest, sourceKey, finishedAt: nowIso(),
        sent: Number(deliveryCounts?.sent || 0), retry: Number(deliveryCounts?.retry || 0),
        failed: Number(deliveryCounts?.failed || 0), blocked: Number(deliveryCounts?.blocked || 0),
      };
      await putState(env, latestState);
    }
    console.log('Broadcast completed:', JSON.stringify({ digest: pending.digest, sourceKey, ...deliveryCounts }));
    return { sent: 0, pending: 0, done: true, deliveryCounts };
  }

  const sendTime = nowIso();
  const fullMessageSections = buildDetailedSections(snapshot, pending.change, sendTime, 'بروزرسانی جدید');
  // IMPORTANT: an update of Mix.txt sends Mix.txt only. Do not read/send archived sources.
  const documentSource = source;
  let sentThisBatch = 0;
  let attemptedThisBatch = 0;
  let failedThisBatch = 0;
  let blockedThisBatch = 0;
  let lastHandledRowId = Number(pending.cursor || 0);

  for (const row of users) {
    const attemptNo = Number(row.attempts || 0) + 1;
    attemptedThisBatch++;
    try {
      await recordBroadcastDelivery(env, pending.digest, row.chat_id, sourceKey, 'sending', attemptNo, null);
      await sendHtmlSections(env, row.chat_id, fullMessageSections, mainKeyboard());
      await sendDocument(
        env,
        row.chat_id,
        fetched.text,
        `V2ray_Sub_${documentSource.fileName.replace(/\.txt$/i, '')}_${snapshot.rawSha256.slice(0, 12)}.txt`,
        shortDocumentCaption(snapshot, sendTime, '🔄 بروزرسانی همین فایل'),
        mainKeyboard(),
      );
      await markSubscriberSent(env, row.chat_id, pending.digest);
      await recordBroadcastDelivery(env, pending.digest, row.chat_id, sourceKey, 'sent', attemptNo, null);
      sentThisBatch++;
      lastHandledRowId = Math.max(lastHandledRowId, Number(row.db_rowid));
    } catch (error) {
      const description = error?.telegram?.description || error?.message || String(error || 'unknown error');
      const blocked = isBlockedTelegramError(description);
      if (blocked) {
        await deactivateSubscriber(env, row.chat_id);
        await recordBroadcastDelivery(env, pending.digest, row.chat_id, sourceKey, 'blocked', attemptNo, description);
        blockedThisBatch++;
        console.warn('Broadcast recipient deactivated after Telegram rejected delivery:', JSON.stringify({ chatId: String(row.chat_id), attempt: attemptNo, error: description.slice(0, 300) }));
      } else {
        const status = attemptNo >= maxAttempts ? 'failed' : 'retry';
        await recordBroadcastDelivery(env, pending.digest, row.chat_id, sourceKey, status, attemptNo, description);
        failedThisBatch++;
        console.error('Broadcast recipient delivery failed:', JSON.stringify({ chatId: String(row.chat_id), attempt: attemptNo, maxAttempts, status, error: description.slice(0, 400) }));
      }
      // Do not stop the campaign on one user's transient error. Continue to other subscribers;
      // the failed recipient remains independently retryable up to maxAttempts.
      lastHandledRowId = Math.max(lastHandledRowId, Number(row.db_rowid));
    }
    await sleep(450);
  }

  const latestState = await getState(env);
  if (latestState?.pending?.digest === pending.digest) {
    latestState.pending.cursor = Math.max(Number(latestState.pending.cursor || 0), lastHandledRowId);
    latestState.pending.lastBatchAt = sendTime;
    latestState.pending.lastBatchSent = sentThisBatch;
    latestState.pending.lastBatchAttempted = attemptedThisBatch;
    latestState.pending.lastBatchFailed = failedThisBatch;
    latestState.pending.lastBatchBlocked = blockedThisBatch;
    latestState.pending.retryCount = 0;
    delete latestState.pending.lastError;
    await putState(env, latestState);
  }

  const nextUser = await env.DB.prepare(`
    SELECT s.rowid AS db_rowid FROM subscribers s
    LEFT JOIN broadcast_delivery d
      ON d.digest = ?1 AND d.chat_id = s.chat_id AND d.source_key = ?2
    WHERE s.active = 1 AND s.notifications = 1
      AND (s.last_sent_digest IS NULL OR s.last_sent_digest != ?1)
      AND (d.status IS NULL OR d.status IN ('pending', 'retry', 'sending'))
      AND COALESCE(d.attempts, 0) < ?3
    ORDER BY s.rowid ASC LIMIT 1
  `).bind(pending.digest, sourceKey, maxAttempts).first();

  if (!nextUser) {
    // Finalize in this same invocation when there is no next recipient; a subsequent chain
    // can finish after the last batch when the prior function has released its execution slot.
    const latest = await getState(env);
    if (latest?.pending?.digest === pending.digest) {
      const count = await env.DB.prepare(`
        SELECT
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
          SUM(CASE WHEN status = 'retry' THEN 1 ELSE 0 END) AS retry,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
          SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked
        FROM broadcast_delivery WHERE digest = ?1 AND source_key = ?2
      `).bind(pending.digest, sourceKey).first();
      latest.pending = null;
      latest.lastBroadcast = { digest: pending.digest, sourceKey, finishedAt: nowIso(), sent: Number(count?.sent || 0), retry: Number(count?.retry || 0), failed: Number(count?.failed || 0), blocked: Number(count?.blocked || 0) };
      latest.monitor = { ...(latest.monitor || {}), lastBroadcastAt: latest.lastBroadcast.finishedAt, lastBroadcastDigest: pending.digest, lastBroadcastSent: latest.lastBroadcast.sent, lastBroadcastFailed: latest.lastBroadcast.failed };
      await putState(env, latest);
    }
    return { sent: sentThisBatch, attempted: attemptedThisBatch, failed: failedThisBatch, blocked: blockedThisBatch, pending: 0, done: true, cursor: lastHandledRowId };
  }

  // Queue the next small batch. Recipient delivery state is stored per digest/chat, not only
  // in a fragile global cursor, so an interruption cannot permanently skip later subscribers.
  if (origin) {
    const url = `${origin.replace(/\/$/, '')}/internal/process-broadcast`;
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Text-Queue-Key': String(env.ADMIN_KEY || '') },
      body: JSON.stringify({ digest: pending.digest, source_key: sourceKey }),
    }, 10000);
    if (!response.ok) console.error('Broadcast continuation enqueue failed:', JSON.stringify({ status: response.status, digest: pending.digest, sourceKey }));
  }
  return { sent: sentThisBatch, attempted: attemptedThisBatch, failed: failedThisBatch, blocked: blockedThisBatch, pending: true, done: false, cursor: lastHandledRowId };
}


async function getMixForUser(env, chatId) {
  const sync = await runSync(env, { broadcast: false });
  if (sync.locked) throw new Error('یک بروزرسانی دیگر در حال اجرا است؛ چند ثانیه بعد دوباره تلاش کنید.');
  const snapshot = sync.snapshot;
  const sendTime = nowIso();
  await sendHtmlSections(env, chatId, buildDetailedSections(snapshot, snapshot.lastChange || { added: 0, removed: 0, unchanged: snapshot.stats.logicalUniqueCount }, sendTime, 'آخرین وضعیت'), mainKeyboard());
  const fetched = sync.fetched || await fetchSource(SOURCES[0], { cacheBust: true });
  await sendDocument(env, chatId, fetched.text, `V2ray_Sub_Mix_${snapshot.rawSha256.slice(0, 12)}.txt`, shortDocumentCaption(snapshot, sendTime, snapshot.firstSeen ? '🆕 Snapshot اولیه' : '✅ آخرین فایل'), mainKeyboard());
}

async function sendLatestText(env, chatId, origin, filters = {}) {
  const sync = await runSync(env, { broadcast: false });
  if (sync.locked) throw new Error('یک Sync دیگر در حال اجراست؛ چند لحظه بعد دوباره تلاش کن.');
  const snapshotId = await ensureLatestArchive(env, sync);
  await startTextForSnapshot(env, chatId, snapshotId, filters, origin);
}

async function sendCurrentFileFromArchive(env, chatId, snapshotId) {
  const row = await getArchiveSnapshot(env, snapshotId);
  if (!row) throw new Error('نسخه پیدا نشد.');
  return sendArchivedFile(env, chatId, snapshotId);
}

async function findCountryCode(env, snapshotId, query) {
  const term = String(query || '').trim();
  if (!term) return null;
  const code = term.toUpperCase();
  const row = await env.DB.prepare(`
    SELECT country_code FROM archived_configs
    WHERE snapshot_id = ?1 AND (UPPER(country_code) = ?2 OR country_name LIKE ?3)
    GROUP BY country_code ORDER BY COUNT(*) DESC LIMIT 1
  `).bind(Number(snapshotId), code, `%${term}%`).first();
  return row?.country_code || null;
}

async function sendSingleSource(env, chatId, source) {
  const fetched = await fetchSource(source, { cacheBust: true });
  const snapshot = await createSnapshot(env, source, fetched, null);
  const sendTime = nowIso();
  await sendHtmlSections(env, chatId, buildDetailedSections(snapshot, { added: snapshot.stats.logicalUniqueCount, removed: 0, unchanged: 0, firstRun: true }, sendTime, `دریافت دستی · ${source.label}`), mainKeyboard());
  await sendDocument(env, chatId, fetched.text, `V2ray_Sub_${source.fileName}`, shortDocumentCaption(snapshot, sendTime, source.active ? '🟢 فعال' : '🗂 آرشیوی'), mainKeyboard());
}

async function sendAllFiles(env, chatId) {
  await sendHtmlSections(env, chatId, [
    `<blockquote>📦 <b>V2ray_Sub · بسته کامل فایل‌ها</b>
فایل‌های واقعی مخزن در ادامه، کامل و بدون تغییر ارسال می‌شوند.</blockquote>`,
    `<pre>╭─[ 📁 منابع ]
│ 🚀 Mix.txt      : فعال
│ 📱 Irancell.txt : آرشیوی
│ 📡 Mci.txt      : آرشیوی
╰────────────────────────</pre>`,
  ]);
  for (const source of SOURCES) await sendSingleSource(env, chatId, source);
}

async function replyStats(env, chatId) {
  const sync = await runSync(env, { broadcast: false });
  if (sync.locked) throw new Error('Sync در حال اجراست؛ دوباره تلاش کنید.');
  const s = sync.snapshot;
  const sendTime = nowIso();
  await sendHtmlSections(env, chatId, buildDetailedSections(s, s.lastChange || { added: 0, removed: 0, unchanged: s.stats.logicalUniqueCount }, sendTime, 'آمار کامل'), mainKeyboard());
}

async function replyCountries(env, chatId) {
  const sync = await runSync(env, { broadcast: false });
  if (sync.locked) throw new Error('Sync در حال اجراست؛ دوباره تلاش کنید.');
  const lines = sync.snapshot.stats.countries.map(c => `│ ${c.flag} ${escapeHtml(c.name)} : ${formatNumber(c.count)}`).join('\n') || '│ —';
  const archiveId = await ensureLatestArchive(env, sync);
  await sendHtmlSections(env, chatId, [
    `<blockquote>🌍 <b>توزیع کشورها · Mix</b></blockquote>`,
    `<pre>╭─[ 🌍 کشورها ]\n${lines}\n╰────────────────────────</pre>`,
  ], { inline_keyboard: [[{ text: '🌍 دریافت کانفیگ‌های یک کشور', callback_data: `cl|${archiveId}` }], ...mainKeyboard().inline_keyboard] });
}

async function replyProtocols(env, chatId) {
  const sync = await runSync(env, { broadcast: false });
  if (sync.locked) throw new Error('Sync در حال اجراست؛ دوباره تلاش کنید.');
  const lines = sync.snapshot.stats.protocols.map(([p, count]) => `│ ${escapeHtml(p)} : ${formatNumber(count)}`).join('\n') || '│ —';
  const archiveId = await ensureLatestArchive(env, sync);
  await sendHtmlSections(env, chatId, [
    `<blockquote>🔌 <b>توزیع پروتکل‌ها · Mix</b></blockquote>`,
    `<pre>╭─[ 🔌 پروتکل‌ها ]\n${lines}\n╰────────────────────────</pre>`,
  ], { inline_keyboard: [[{ text: '🔌 دریافت کانفیگ‌های یک پروتکل', callback_data: `pl|${archiveId}` }], ...mainKeyboard().inline_keyboard] });
}

async function replyHelp(env, chatId) {
  const commands = COMMANDS.filter(c => c.command !== 'id').map(c => `/${c.command} — ${c.description}`).join('\n');
  await sendHtmlSections(env, chatId, [
    `<blockquote>🤖 <b>${escapeHtml(APP.name)}</b>
دریافت Subscriptionهای واقعی V2ray_Sub با جزئیات بروزرسانی، آمار و فایل کامل.</blockquote>`,
    `<pre>╭─[ 📖 دستورات ]\n${escapeHtml(commands)}\n╰────────────────────────</pre>`,
    `<blockquote>🔔 اعلان خودکار فقط هنگام تغییر واقعی کانفیگ‌ها ارسال می‌شود.

🌐 <a href="${escapeHtml(APP.siteUrl)}">وب‌سایت V2ray_Sub</a>
📦 <a href="${escapeHtml(APP.repoUrl)}">مخزن GitHub</a></blockquote>`,
  ], mainKeyboard());
}

async function handleCommand(env, message, rawCommand, fullText = '', request = null) {
  const chat = message.chat;
  await upsertSubscriber(env, chat, message.from || null);
  const command = String(rawCommand || '').split('@')[0].toLowerCase();
  const args = String(fullText || '').trim().split(/\s+/).slice(1).join(' ').trim();
  const origin = request ? new URL(request.url).origin : 'https://v2ray-sub-radar-bot.workers.dev';
  switch (command) {
    case '/start':
      await setNotifications(env, chat.id, true);
      await sendMessage(env, chat.id,
        `🚀 سلام! به ${APP.name} خوش آمدی.\n\n` +
        '✅ دریافت آخرین Mix.txt\n📋 ارسال همه کانفیگ‌ها به‌صورت متن monospace و قابل کپی\n🗃 انتخاب نسخه‌های قبلی از آرشیو\n🌍 فیلتر بر اساس کشور\n🔌 فیلتر بر اساس پروتکل\n🔔 اعلان خودکار از طریق GitHub Actions', mainKeyboard());
      await getMixForUser(env, chat.id);
      return;
    case '/latest':
    case '/mix':
      await getMixForUser(env, chat.id);
      return;
    case '/text':
    case '/alltext':
    case '/configs':
      await sendLatestText(env, chat.id, origin);
      return;
    case '/history':
    case '/old':
      await sendHistoryList(env, chat.id);
      return;
    case '/country': {
      const sync = await runSync(env, { broadcast: false });
      if (sync.locked) throw new Error('در حال بررسی آخرین نسخه است؛ دوباره تلاش کن.');
      const id = await ensureLatestArchive(env, sync);
      if (!args) return sendCountryPicker(env, chat.id, id);
      const code = await findCountryCode(env, id, args);
      if (!code) return sendHtmlMessage(env, chat.id, `⚠️ کشور «${escapeHtml(args)}» پیدا نشد. از دکمه‌ها انتخاب کن.`, { inline_keyboard: [[{ text: '🌍 انتخاب کشور', callback_data: `cl|${id}` }], ...mainKeyboard().inline_keyboard] });
      return sendLatestText(env, chat.id, origin, { country: code });
    }
    case '/protocol': {
      const sync = await runSync(env, { broadcast: false });
      if (sync.locked) throw new Error('در حال بررسی آخرین نسخه است؛ دوباره تلاش کن.');
      const id = await ensureLatestArchive(env, sync);
      if (!args) return sendProtocolPicker(env, chat.id, id);
      const protocol = args.toUpperCase();
      const exists = await env.DB.prepare('SELECT 1 AS ok FROM archived_configs WHERE snapshot_id = ?1 AND UPPER(protocol) = ?2 LIMIT 1').bind(id, protocol).first();
      if (!exists) return sendHtmlMessage(env, chat.id, `⚠️ پروتکل «${escapeHtml(protocol)}» در این نسخه پیدا نشد. از دکمه‌ها انتخاب کن.`, { inline_keyboard: [[{ text: '🔌 انتخاب پروتکل', callback_data: `pl|${id}` }], ...mainKeyboard().inline_keyboard] });
      return sendLatestText(env, chat.id, origin, { protocol });
    }
    case '/stats':
      await replyStats(env, chat.id);
      return;
    case '/countries':
      await replyCountries(env, chat.id);
      return;
    case '/protocols':
      await replyProtocols(env, chat.id);
      return;
    case '/files':
      await sendAllFiles(env, chat.id);
      return;
    case '/irancell':
      await sendSingleSource(env, chat.id, SOURCES[1]);
      return;
    case '/mci':
      await sendSingleSource(env, chat.id, SOURCES[2]);
      return;
    case '/mute':
      await setNotifications(env, chat.id, false);
      await sendMessage(env, chat.id, '🔕 اعلان‌های بروزرسانی برای این چت خاموش شد.\n\nبرای فعال‌سازی: /unmute', mainKeyboard());
      return;
    case '/unmute':
      await setNotifications(env, chat.id, true);
      await sendMessage(env, chat.id, '🔔 اعلان‌های بروزرسانی دوباره فعال شد.', mainKeyboard());
      return;
    case '/admin':
      if (chat.type !== 'private' || !isTelegramAdmin(env, message.from?.id ?? chat.id)) {
        await sendMessage(env, chat.id, '⛔ این بخش فقط در چت خصوصی مدیر ربات فعال است.', mainKeyboard());
        return;
      }
      await sendAdminPanel(env, chat.id);
      return;
    case '/adminusers':
      if (chat.type !== 'private' || !isTelegramAdmin(env, message.from?.id ?? chat.id)) {
        await sendMessage(env, chat.id, '⛔ این بخش فقط در چت خصوصی مدیر ربات فعال است.', mainKeyboard());
        return;
      }
      await sendAdminUsers(env, chat.id, Math.max(0, Number.parseInt(args || '0', 10) || 0));
      return;
    case '/adminstatus':
      if (chat.type !== 'private' || !isTelegramAdmin(env, message.from?.id ?? chat.id)) {
        await sendMessage(env, chat.id, '⛔ این بخش فقط در چت خصوصی مدیر ربات فعال است.', mainKeyboard());
        return;
      }
      await sendAdminStatusMessage(env, chat.id);
      return;
    case '/adminretry':
      if (chat.type !== 'private' || !isTelegramAdmin(env, message.from?.id ?? chat.id)) {
        await sendMessage(env, chat.id, '⛔ این بخش فقط در چت خصوصی مدیر ربات فعال است.', mainKeyboard());
        return;
      }
      await retryPendingBroadcast(env, new URL(request?.url || 'https://v2ray-sub-radar-bot.game-developer-mb.workers.dev').origin, chat.id);
      return;
    case '/id':
      await sendMessage(env, chat.id, `🆔 Chat ID این چت:\n${chat.id}\n🆔 User ID: ${message.from?.id ?? chat.id}`, mainKeyboard());
      return;
    case '/help':
      await replyHelp(env, chat.id);
      return;
    default:
      await sendMessage(env, chat.id, '⚠️ دستور شناخته نشد. /help را بزن.', mainKeyboard());
  }
}

async function handleCallback(env, callback, request, ctx) {
  await sendTelegram(env, 'answerCallbackQuery', { callback_query_id: callback.id });
  const chatId = callback.message?.chat?.id;
  if (!chatId) return;
  const data = String(callback.data || '');
  const origin = new URL(request.url).origin;
  if (data === 'latest') return getMixForUser(env, chatId);
  if (data === 'text:latest') return sendLatestText(env, chatId, origin);
  if (data === 'history') return sendHistoryList(env, chatId);
  if (data.startsWith('histpage|')) return sendHistoryList(env, chatId, Math.max(0, Math.min(100000, Number(data.split('|')[1]) || 0)));
  if (data === 'countrylist:latest' || data === 'protolist:latest') {
    const sync = await runSync(env, { broadcast: false });
    if (sync.locked) throw new Error('در حال بررسی آخرین نسخه است؛ دوباره تلاش کن.');
    const archiveId = await ensureLatestArchive(env, sync);
    return data.startsWith('countrylist:') ? sendCountryPicker(env, chatId, archiveId) : sendProtocolPicker(env, chatId, archiveId);
  }
  if (data === 'stats') return replyStats(env, chatId);
  if (data === 'countries') return replyCountries(env, chatId);
  if (data === 'protocols') return replyProtocols(env, chatId);
  if (data === 'files') return sendAllFiles(env, chatId);
  if (data === 'help') return replyHelp(env, chatId);
  if (data === 'menu') return sendMessage(env, chatId, '🏠 منوی اصلی V2ray Sub Radar', mainKeyboard());
  if (data === 'notify') {
    await setNotifications(env, chatId, true);
    return sendMessage(env, chatId, '🔔 اعلان‌ها فعال هستند.', mainKeyboard());
  }
  if (data === 'adminpanel' || data.startsWith('adminusers|') || data === 'adminstatus' || data === 'adminretry') {
    if (callback.message?.chat?.type !== 'private' || !isTelegramAdmin(env, callback.from?.id)) {
      return sendMessage(env, chatId, '⛔ این گزینه فقط در چت خصوصی مدیر ربات فعال است.');
    }
    if (data === 'adminpanel') return sendAdminPanel(env, chatId);
    if (data === 'adminstatus') return sendAdminStatusMessage(env, chatId);
    if (data === 'adminretry') return retryPendingBroadcast(env, origin, chatId);
    const offset = Math.max(0, Number.parseInt(data.split('|')[1] || '0', 10) || 0);
    return sendAdminUsers(env, chatId, offset);
  }
  const [action, idPart, value] = data.split('|');
  const snapshotId = Number(idPart);
  if (action === 'hist' && Number.isInteger(snapshotId)) return sendArchiveDetails(env, chatId, snapshotId, origin);
  if (action === 'text' && Number.isInteger(snapshotId)) return startTextForSnapshot(env, chatId, snapshotId, {}, origin);
  if (action === 'file' && Number.isInteger(snapshotId)) return sendCurrentFileFromArchive(env, chatId, snapshotId);
  if (action === 'cl' && Number.isInteger(snapshotId)) return sendCountryPicker(env, chatId, snapshotId);
  if (action === 'pl' && Number.isInteger(snapshotId)) return sendProtocolPicker(env, chatId, snapshotId);
  if (action === 'country' && Number.isInteger(snapshotId) && value) return startTextForSnapshot(env, chatId, snapshotId, { country: value }, origin);
  if (action === 'protocol' && Number.isInteger(snapshotId) && value) return startTextForSnapshot(env, chatId, snapshotId, { protocol: value }, origin);
}

function telegramAdminIds(env) {
  return String(env.ADMIN_TELEGRAM_IDS || env.ADMIN_TELEGRAM_ID || '')
    .split(/[\s,;]+/)
    .map(value => value.trim())
    .filter(value => /^\d{1,22}$/.test(value));
}

function isTelegramAdmin(env, userId) {
  const id = String(userId ?? '').trim();
  return Boolean(id && telegramAdminIds(env).includes(id));
}

function telegramProfileHref(userId) {
  const id = String(userId ?? '').trim();
  return /^\d{1,22}$/.test(id) ? `tg://user?id=${id}` : null;
}

function adminPanelKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '👥 فهرست کاربران', callback_data: 'adminusers|0' }],
      [{ text: '📊 وضعیت ارسال و اعلان‌ها', callback_data: 'adminstatus' }],
      [{ text: '🔁 ادامه/تلاش دوباره اعلان‌های ناموفق', callback_data: 'adminretry' }],
      [{ text: '🏠 منوی اصلی', callback_data: 'menu' }],
    ],
  };
}

async function sendAdminPanel(env, chatId) {
  const counts = await env.DB.prepare(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN active = 1 AND notifications = 1 THEN 1 ELSE 0 END) AS notifications,
      SUM(CASE WHEN active = 1 AND notifications = 0 THEN 1 ELSE 0 END) AS muted
    FROM subscribers
  `).first();
  const body = `<blockquote>🛡️ <b>پنل مدیریت · V2ray Sub Radar</b>\nدسترسی فقط برای Telegram IDهای تعریف‌شده در <code>ADMIN_TELEGRAM_IDS</code>.</blockquote>\n\n` +
    `<pre>╭─[ 👥 مشترکان ]\n│ کل ثبت‌شده‌ها : ${formatNumber(counts?.total || 0)}\n│ فعال           : ${formatNumber(counts?.active || 0)}\n│ اعلان روشن     : ${formatNumber(counts?.notifications || 0)}\n│ اعلان خاموش    : ${formatNumber(counts?.muted || 0)}\n╰────────────────────</pre>\n\n` +
    `از فهرست کاربران وضعیت هر مشترک، شناسه قابل‌کلیک، username و آخرین زمان فعالیت را ببین. خطاهای ارسال هم از بخش وضعیت قابل بررسی‌اند.`;
  return sendHtmlMessage(env, chatId, body, adminPanelKeyboard());
}

async function sendAdminUsers(env, chatId, requestedOffset = 0) {
  const pageSize = APP.adminUserPageSize;
  const totalRow = await env.DB.prepare('SELECT COUNT(*) AS total FROM subscribers').first();
  const total = Number(totalRow?.total || 0);
  const maxOffset = Math.max(0, Math.floor((Math.max(total, 1) - 1) / pageSize) * pageSize);
  const offset = Math.min(Math.max(0, Math.floor(Number(requestedOffset) || 0)), maxOffset);
  const result = await env.DB.prepare(`
    SELECT chat_id, user_id, username, first_name, last_name, active, notifications,
      last_sent_digest, last_sent_at, created_at, updated_at
    FROM subscribers
    ORDER BY rowid DESC
    LIMIT ?1 OFFSET ?2
  `).bind(pageSize, offset).all();
  const users = result.results || [];
  if (!users.length) {
    return sendHtmlMessage(env, chatId, '<blockquote>👥 <b>فهرست کاربران</b></blockquote>هنوز هیچ کاربری در دیتابیس ثبت نشده است.', adminPanelKeyboard());
  }
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pageNo = Math.floor(offset / pageSize) + 1;
  const rows = users.map((user, index) => {
    const userId = String(user.user_id || user.chat_id || '');
    const href = telegramProfileHref(userId);
    const profileName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || 'کاربر بدون نام';
    const linkedId = href ? `<a href="${href}"><code>${escapeHtml(userId)}</code></a>` : `<code>${escapeHtml(userId || 'نامشخص')}</code>`;
    const username = user.username
      ? `🔗 <a href="https://t.me/${encodeURIComponent(String(user.username).replace(/^@/, ''))}">@${escapeHtml(String(user.username).replace(/^@/, ''))}</a>`
      : '🔗 username عمومی ثبت نشده';
    const active = Number(user.active) === 1 ? '🟢 فعال' : '⚫ غیرفعال';
    const notifications = Number(user.notifications) === 1 ? '🔔 روشن' : '🔕 خاموش';
    const joined = user.created_at ? escapeHtml(String(user.created_at).replace('T', ' ').replace('Z', ' UTC')) : 'نامشخص';
    const seen = user.updated_at ? escapeHtml(String(user.updated_at).replace('T', ' ').replace('Z', ' UTC')) : 'نامشخص';
    const sent = user.last_sent_at ? escapeHtml(String(user.last_sent_at).replace('T', ' ').replace('Z', ' UTC')) : 'هنوز ارسال موفق ثبت نشده';
    return `${index + offset + 1}. <b>${escapeHtml(profileName)}</b>\n   🆔 شناسه: ${linkedId}\n   ${username}\n   📣 وضعیت: ${active} · ${notifications}\n   🗓️ عضویت: <code>${joined}</code>\n   🕒 آخرین فعالیت: <code>${seen}</code>\n   📤 آخرین اعلان موفق: <code>${sent}</code>`;
  });
  const body = `<blockquote>👥 <b>مشترکان ربات</b>\nصفحه ${pageNo} از ${pages} · مجموع ${formatNumber(total)} کاربر</blockquote>\n\n` + rows.join('\n\n━━━━━━━━━━━━━━\n\n') +
    '\n\n<blockquote>برای باز کردن پروفایل، روی شناسه کاربر بزن. اگر کاربر username عمومی نداشته باشد، Telegram ممکن است بسته به تنظیمات حریم خصوصی نتواند پروفایل را مستقیم باز کند.</blockquote>';
  const keyboard = [];
  const navigation = [];
  if (offset > 0) navigation.push({ text: '⬅️ قبلی', callback_data: `adminusers|${Math.max(0, offset - pageSize)}` });
  navigation.push({ text: `📄 ${pageNo}/${pages}`, callback_data: `adminusers|${offset}` });
  if (offset + pageSize < total) navigation.push({ text: 'بعدی ➡️', callback_data: `adminusers|${offset + pageSize}` });
  if (navigation.length) keyboard.push(navigation);
  keyboard.push([{ text: '🔄 تازه‌سازی', callback_data: `adminusers|${offset}` }, { text: '📊 وضعیت', callback_data: 'adminstatus' }]);
  keyboard.push([{ text: '🛡️ پنل مدیریت', callback_data: 'adminpanel' }]);
  return sendHtmlMessage(env, chatId, body.slice(0, APP.maxTelegramText), { inline_keyboard: keyboard });
}

async function sendAdminStatusMessage(env, chatId) {
  const state = await getState(env);
  const general = await env.DB.prepare(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN active = 1 AND notifications = 1 THEN 1 ELSE 0 END) AS notifications,
      SUM(CASE WHEN active = 1 AND notifications = 0 THEN 1 ELSE 0 END) AS muted
    FROM subscribers
  `).first();
  const digest = state?.pending?.digest || state?.lastBroadcast?.digest || null;
  let deliveries = { sent: 0, retry: 0, failed: 0, blocked: 0, sending: 0 };
  if (digest) {
    const result = await env.DB.prepare(`
      SELECT status, COUNT(*) AS count FROM broadcast_delivery WHERE digest = ?1 GROUP BY status
    `).bind(digest).all();
    for (const row of result.results || []) if (Object.hasOwn(deliveries, row.status)) deliveries[row.status] = Number(row.count || 0);
  }
  const monitor = state?.monitor || {};
  const error = monitor.lastError ? escapeHtml(String(monitor.lastError).slice(0, 450)) : 'بدون خطای ثبت‌شده';
  const pending = state?.pending ? `در صف: ${escapeHtml(String(state.pending.sourceKey || 'mix'))} · ${escapeHtml(String(state.pending.digest || '').slice(0, 12))}` : 'صف جاری خالی است';
  const body = `<blockquote>📊 <b>گزارش وضعیت ربات</b></blockquote>\n` +
    `<pre>╭─[ 👥 کاربران ]\n│ کل ثبت‌شده‌ها : ${formatNumber(general?.total || 0)}\n│ فعال           : ${formatNumber(general?.active || 0)}\n│ اعلان روشن     : ${formatNumber(general?.notifications || 0)}\n│ اعلان خاموش    : ${formatNumber(general?.muted || 0)}\n╰────────────────────</pre>\n` +
    `<pre>╭─[ 📣 Broadcast فعلی/اخیر ]\n│ تحویل موفق     : ${formatNumber(deliveries.sent)}\n│ تلاش مجدد      : ${formatNumber(deliveries.retry)}\n│ ارسال درحال کار: ${formatNumber(deliveries.sending)}\n│ ناموفق نهایی   : ${formatNumber(deliveries.failed)}\n│ مسدود/غیرفعال  : ${formatNumber(deliveries.blocked)}\n╰────────────────────</pre>\n` +
    `<pre>╭─[ 🩺 پایش Worker ]\n│ آخرین بررسی    : ${escapeHtml(monitor.lastCheckAt || 'نامشخص')}\n│ نتیجه           : ${monitor.lastCheckOk === true ? 'OK' : monitor.lastCheckOk === false ? 'ERROR' : 'نامشخص'}\n│ Trigger         : ${escapeHtml(monitor.lastTrigger || 'نامشخص')}\n│ وضعیت صف        : ${pending}\n╰────────────────────</pre>\n` +
    `<blockquote>آخرین خطا:\n<code>${error}</code></blockquote>`;
  return sendHtmlMessage(env, chatId, body, { inline_keyboard: [[{ text: '👥 کاربران', callback_data: 'adminusers|0' }, { text: '🛡️ پنل مدیریت', callback_data: 'adminpanel' }], [{ text: '🔁 تلاش مجدد ارسال‌های ناموفق', callback_data: 'adminretry' }]] });
}

async function retryPendingBroadcast(env, origin, chatId) {
  const state = await getState(env);
  const digest = state?.pending?.digest || state?.lastBroadcast?.digest || state?.snapshot?.configSha256;
  if (!digest) return sendHtmlMessage(env, chatId, 'ℹ️ صف Broadcast یا نسخه‌ای برای تلاش مجدد وجود ندارد.', adminPanelKeyboard());
  const sourceKey = state?.pending?.sourceKey || state?.snapshot?.key || 'mix';
  if (!state?.pending && (!state?.snapshot || state.snapshot.configSha256 !== digest)) {
    return sendHtmlMessage(env, chatId, '⚠️ نسخه‌ای برای ادامه‌ی Broadcast در وضعیت فعلی موجود نیست. برای جزئیات /adminstatus را ببین.', adminPanelKeyboard());
  }
  await env.DB.prepare(`UPDATE broadcast_delivery SET status = 'retry', attempts = 0, last_error = NULL, updated_at = ?1 WHERE digest = ?2 AND status = 'failed'`)
    .bind(nowIso(), digest).run();
  let activeState = state;
  if (!activeState?.pending) {
    const snapshot = activeState?.snapshot;
    activeState = { ...activeState, pending: { digest, sourceKey, cursor: 0, createdAt: nowIso(), change: snapshot.lastChange || { added: 0, removed: 0, unchanged: snapshot.stats?.logicalUniqueCount || 0, firstRun: false } } };
    await putState(env, activeState);
  }
  await sendHtmlMessage(env, chatId, '🔁 تلاش مجدد برای گیرندگان ناموفق آغاز شد. کاربران دریافت‌کننده‌ی موفق دوباره پیام نمی‌گیرند.', adminPanelKeyboard());
  const result = await processPendingBroadcast(env, origin);
  return sendHtmlMessage(env, chatId,
    `📣 <b>گزارش تلاش مجدد</b>\n✅ موفق در این مرحله: <code>${formatNumber(result.sent || 0)}</code>\n⏳ هنوز در صف: <code>${result.pending === true || result.done === false ? 'بله' : 'خیر'}</code>`, adminPanelKeyboard());
}

function requireAdmin(request, env) {
  const key = request.headers.get('x-admin-key') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  return Boolean(env.ADMIN_KEY && key && key === env.ADMIN_KEY);
}

async function configureTelegram(env, request) {
  const origin = new URL(request.url).origin;
  const webhookUrl = `${origin}${APP.webhookPath}`;
  const secret = env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) throw new Error('TELEGRAM_WEBHOOK_SECRET تنظیم نشده است.');
  const webhookResult = await sendTelegram(env, 'setWebhook', {
    url: webhookUrl,
    secret_token: secret,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false,
    max_connections: 20,
  });
  const commandsResult = await sendTelegram(env, 'setMyCommands', { commands: COMMANDS });
  const me = await sendTelegram(env, 'getMe', {});
  return { ok: true, webhookUrl, webhookResult, commandsResult, bot: me };
}

async function adminStatus(env) {
  const state = await getState(env);
  const subscribers = await env.DB.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN active = 1 AND notifications = 1 THEN 1 ELSE 0 END) AS notifications
    FROM subscribers
  `).first();
  let pending = null;
  if (state?.pending) {
    const row = await env.DB.prepare(`SELECT COUNT(*) AS count FROM subscribers s LEFT JOIN broadcast_delivery d ON d.digest = ?1 AND d.chat_id = s.chat_id AND d.source_key = ?2 WHERE s.active = 1 AND s.notifications = 1 AND (s.last_sent_digest IS NULL OR s.last_sent_digest != ?1) AND (d.status IS NULL OR d.status IN ('pending','retry','sending')) AND COALESCE(d.attempts,0) < ?3`)
      .bind(state.pending.digest, state.pending.sourceKey || 'mix', APP.maxBroadcastAttemptsPerUser).first();
    pending = Number(row?.count || 0);
  }
  const archive = await env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM subscription_snapshots) AS snapshots,
      (SELECT COUNT(*) FROM archived_configs) AS configs,
      (SELECT COALESCE(SUM(estimated_bytes), 0) FROM subscription_snapshots) +
      (SELECT COALESCE(SUM(estimated_bytes), 0) FROM archived_configs) AS estimated_bytes
  `).first();
  const textJobs = await env.DB.prepare(`SELECT COUNT(*) AS count FROM text_delivery_jobs WHERE status IN ('queued', 'running')`).first();
  return {
    ok: true,
    app: APP,
    time: nowIso(),
    snapshot: state?.snapshot || null,
    monitor: state?.monitor || null,
    pendingBroadcast: state?.pending || null,
    pendingEligibleUsers: pending,
    archive: { snapshots: Number(archive?.snapshots || 0), configs: Number(archive?.configs || 0), estimatedBytes: Number(archive?.estimated_bytes || 0), maxSnapshots: archiveLimits(env).maxSnapshots, maxConfigRows: archiveLimits(env).maxConfigRows, maxBytes: archiveLimits(env).maxBytes },
    activeTextJobs: Number(textJobs?.count || 0),
    deliveryHistory: await (async () => {
      const digest = state?.pending?.digest || state?.lastBroadcast?.digest;
      if (!digest) return null;
      const rows = await env.DB.prepare('SELECT status, COUNT(*) AS count FROM broadcast_delivery WHERE digest = ?1 GROUP BY status').bind(digest).all();
      return Object.fromEntries((rows.results || []).map(row => [String(row.status), Number(row.count || 0)]));
    })(),
    subscribers: {
      total: Number(subscribers?.total || 0),
      active: Number(subscribers?.active || 0),
      notifications: Number(subscribers?.notifications || 0),
    },
  };
}

async function adminTelegramStatus(env) {
  const [me, webhook] = await Promise.all([
    sendTelegram(env, 'getMe', {}),
    sendTelegram(env, 'getWebhookInfo', {}),
  ]);
  return { ok: true, me, webhook };
}

async function adminTestSend(env, request) {
  let payload = {};
  try { payload = await request.json(); } catch { /* query params fallback */ }
  const url = new URL(request.url);
  const chatId = payload.chat_id || url.searchParams.get('chat_id');
  if (!chatId) throw new Error('chat_id لازم است.');
  await getMixForUser(env, chatId);
  return { ok: true, chatId: String(chatId) };
}

async function adminRemoveWebhook(env) {
  const result = await sendTelegram(env, 'deleteWebhook', { drop_pending_updates: false });
  return { ok: true, result };
}

async function timingSafeEqual(a, b) {
  const aa = new TextEncoder().encode(String(a || ''));
  const bb = new TextEncoder().encode(String(b || ''));
  if (aa.length != bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i += 1) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

async function verifyGithubSignature(secret, body, signature) {
  if (!secret || !signature.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');
  return timingSafeEqual(`sha256=${hex}`, signature);
}

async function handleGithubWebhook(request, env, ctx) {
  const secret = env.GITHUB_WEBHOOK_SECRET || '';
  if (!secret) return textResponse('github webhook disabled', 503);
  const body = await request.text();
  const signature = request.headers.get('X-Hub-Signature-256') || '';
  if (!await verifyGithubSignature(secret, body, signature)) return textResponse('forbidden', 403);

  let payload;
  try { payload = JSON.parse(body); } catch { return textResponse('bad json', 400); }
  const event = request.headers.get('X-GitHub-Event') || '';
  if (event !== 'push') return json({ ok: true, ignored: true, event });
  const branch = payload?.ref === `refs/heads/${env.REPO_BRANCH || 'main'}`;
  const changedPaths = [
    ...(payload?.head_commit?.modified || []),
    ...(payload?.head_commit?.added || []),
    ...(payload?.head_commit?.removed || []),
    ...((payload?.commits || []).flatMap(c => [
      ...(c?.modified || []),
      ...(c?.added || []),
      ...(c?.removed || []),
    ])),
  ];
  if (!branch || !changedPaths.includes('Mix.txt')) return json({ ok: true, ignored: true, reason: 'Mix.txt not changed on target branch' });

  ctx.waitUntil((async () => {
    try {
      await sleep(1800);
      const result = await runSync(env, { broadcast: true, origin: new URL(request.url).origin });
      console.log('GitHub webhook sync:', JSON.stringify({ changed: result.changed, meaningfulChange: result.meaningfulChange, digest: result.snapshot?.configSha256, after: payload?.after }));
    } catch (error) {
      console.error('GitHub webhook sync error:', error?.stack || error);
    }
  })());
  return json({ ok: true, queued: true, commit: payload?.after || null });
}

async function handleGithubAction(request, env, ctx) {
  const secret = String(env.GITHUB_ACTION_SECRET || '');
  const supplied = String(request.headers.get('X-V2SR-Action-Secret') || '');
  if (!secret) return textResponse('GitHub Actions endpoint is not configured', 503);
  if (!await timingSafeEqual(secret, supplied)) return textResponse('forbidden', 403);

  let payload = {};
  try { payload = await request.json(); } catch { /* a secret-authenticated manual ping is accepted */ }
  const expectedBranch = env.REPO_BRANCH || 'main';
  const ref = String(payload.ref || '');
  if (ref && ref !== `refs/heads/${expectedBranch}` && ref !== expectedBranch) {
    return json({ ok: true, ignored: true, reason: 'not target branch', ref });
  }
  const expectedRawSha = String(payload.content_sha256 || '').trim().toLowerCase();
  if (expectedRawSha && !/^[a-f0-9]{64}$/.test(expectedRawSha)) {
    return json({ ok: false, error: 'content_sha256 must be a 64-character SHA-256 hex digest' }, 400);
  }

  // GitHub Raw can be briefly stale just after a push. The workflow supplies the exact blob SHA;
  // retry a few times until Worker sees that exact file. This avoids falsely treating a stale CDN
  // response as the new latest version. Once confirmed, the persisted pending digest is broadcast.
  ctx.waitUntil((async () => {
    const origin = new URL(request.url).origin;
    const delays = [1800, 3000, 6000];
    let result = null;
    let expectedMatched = !expectedRawSha;
    try {
      for (let attempt = 0; attempt < delays.length; attempt += 1) {
        await sleep(delays[attempt]);
        result = await runSync(env, { broadcast: false, origin });
        if (result.locked) {
          console.warn('GitHub Actions sync lock was busy; retrying', attempt + 1);
          continue;
        }
        const actualSha = String(result.snapshot?.rawSha256 || '').toLowerCase();
        if (expectedRawSha && actualSha !== expectedRawSha) {
          console.warn('Mix.txt raw cache has not converged yet', JSON.stringify({ attempt: attempt + 1, expected: expectedRawSha, actual: actualSha || null }));
          continue;
        }
        expectedMatched = true;
        break;
      }

      if (!result || result.locked) throw new Error('Worker sync lock remained busy after retry attempts.');
      if (!expectedMatched) {
        const at = nowIso();
        const state = await getState(env);
        await putState(env, {
          ...(state || {}), updatedAt: at,
          monitor: {
            ...(state?.monitor || {}), lastCheckAt: at, lastCheckOk: false,
            lastTrigger: 'github-actions', lastExpectedContentSha: expectedRawSha || null,
            lastActualContentSha: result.snapshot?.rawSha256 || null,
            lastError: 'Raw GitHub did not return the expected Mix.txt blob SHA after retries.',
          },
        });
        console.error('GitHub Actions sync stopped: expected Mix.txt SHA never matched.', JSON.stringify({ expectedRawSha, actual: result.snapshot?.rawSha256 || null }));
        return;
      }

      // Run one locked sync with broadcasting enabled. It rechecks the now-visible file and
      // keeps the shared worker lock while the first broadcast batch is processed.
      let deliverySync = await runSync(env, { broadcast: true, origin });
      for (let lockRetry = 0; deliverySync.locked && lockRetry < 3; lockRetry += 1) {
        await sleep(1800 * (lockRetry + 1));
        deliverySync = await runSync(env, { broadcast: true, origin });
      }
      if (deliverySync.locked) throw new Error('Could not acquire the sync/broadcast lock after retries.');

      const at = nowIso();
      const state = await getState(env);
      await putState(env, {
        ...(state || {}), updatedAt: at,
        monitor: {
          ...(state?.monitor || {}), lastCheckAt: at, lastCheckOk: true, lastError: null,
          lastTrigger: 'github-actions', lastActionAt: at,
          lastExpectedContentSha: expectedRawSha || null,
          lastActualContentSha: deliverySync.snapshot?.rawSha256 || result.snapshot?.rawSha256 || null,
        },
      });
      console.log('GitHub Actions notify sync:', JSON.stringify({
        repository: payload.repository || null, sha: payload.sha || null,
        expectedRawSha: expectedRawSha || null,
        changed: Boolean(result.changed || deliverySync.changed), meaningfulChange: Boolean(result.meaningfulChange || deliverySync.meaningfulChange),
        digest: deliverySync.snapshot?.configSha256 || result.snapshot?.configSha256 || null,
        added: deliverySync.change?.added ?? result.change?.added ?? 0,
        removed: deliverySync.change?.removed ?? result.change?.removed ?? 0,
        pendingBroadcast: Boolean((await getState(env))?.pending),
      }));
    } catch (error) {
      console.error('GitHub Actions sync error:', error?.stack || error);
      try {
        const state = await getState(env); const at = nowIso();
        await putState(env, { ...(state || {}), updatedAt: at, monitor: { ...(state?.monitor || {}), lastCheckAt: at, lastCheckOk: false, lastError: error?.message || String(error), lastTrigger: 'github-actions' } });
      } catch {}
    }
  })());
  return json({ ok: true, queued: true, trigger: 'github-actions', ref: ref || null, sha: payload.sha || null, expectedContentSha: expectedRawSha || null }, 202);
}

async function handleInternalBroadcast(request, env, ctx) {
  if (!env.ADMIN_KEY || !await timingSafeEqual(env.ADMIN_KEY, request.headers.get('X-Text-Queue-Key') || '')) return textResponse('forbidden', 403);
  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid json' }, 400); }
  ctx.waitUntil((async () => {
    try {
      const state = await getState(env);
      if (!state?.pending) return;
      if (body.digest && state.pending.digest !== body.digest) return;
      const retryCount = Number(body.retry_count || 0);
      if (retryCount > 0) await sleep(Math.min(retryCount * 5000, 15000));
      await processPendingBroadcast(env, new URL(request.url).origin);
    } catch (error) { console.error('broadcast continuation failed', error?.stack || error); }
  })());
  return json({ ok: true, accepted: true }, 202);
}

async function handleInternalTextJob(request, env, ctx) {
  if (!env.ADMIN_KEY || !await timingSafeEqual(env.ADMIN_KEY, request.headers.get('X-Text-Queue-Key') || '')) return textResponse('forbidden', 403);
  let body = {};
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid json' }, 400); }
  if (!body.job_id || typeof body.job_id !== 'string' || body.job_id.length > 80) return json({ ok: false, error: 'job_id required' }, 400);
  ctx.waitUntil((async () => {
    try { await processTextDeliveryBatch(env, body.job_id, new URL(request.url).origin); }
    catch (error) {
      console.error('text delivery batch failed', body.job_id, error?.stack || error);
      try {
        const job = await env.DB.prepare('SELECT chat_id FROM text_delivery_jobs WHERE job_id = ?1').bind(body.job_id).first();
        await env.DB.prepare(`UPDATE text_delivery_jobs SET status = 'failed', updated_at = ?1 WHERE job_id = ?2`).bind(nowIso(), body.job_id).run();
        if (job?.chat_id) await sendMessage(env, job.chat_id, '⚠️ ادامه ارسال کانفیگ‌ها به مشکل خورد. دوباره /text را بزن؛ آرشیو دست‌نخورده است.', mainKeyboard());
      } catch (notifyError) { console.error('could not mark text job failed', notifyError?.message || notifyError); }
    }
  })());
  return json({ ok: true, accepted: true }, 202);
}

async function handleWebhook(request, env, ctx) {
  const expected = env.TELEGRAM_WEBHOOK_SECRET || '';
  const received = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
  if (!expected || received !== expected) return textResponse('forbidden', 403);

  let update;
  try { update = await request.json(); } catch { return textResponse('bad json', 400); }

  // Telegram only needs a quick 200 response. Work happens in waitUntil.
  ctx.waitUntil((async () => {
    try {
      if (update.callback_query) {
        await handleCallback(env, update.callback_query, request, ctx);
        return;
      }
      const message = update.message;
      if (!message?.chat) return;
      const text = String(message.text || '').trim();
      if (!text.startsWith('/')) return;
      await handleCommand(env, message, text.split(/\s+/)[0], text, request);
    } catch (error) {
      console.error('webhook processing error', error?.stack || error);
      const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
      if (chatId) {
        try { await sendMessage(env, chatId, '⚠️ عملیات انجام نشد. خطا ثبت شد؛ چند لحظه بعد دوباره تلاش کن.', mainKeyboard()); } catch {}
      }
    }
  })());

  return textResponse('ok');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/health' && request.method === 'GET') {
      try {
        const state = await getState(env);
        return json({ ok: true, app: APP, time: nowIso(), hasDb: Boolean(env.DB), configured: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_WEBHOOK_SECRET && env.ADMIN_KEY), githubActionsConfigured: Boolean(env.GITHUB_ACTION_SECRET), telegramAdminConfigured: telegramAdminIds(env).length > 0, monitor: state?.monitor || null, lastSnapshot: state?.snapshot ? { rawSha256: state.snapshot.rawSha256, configSha256: state.snapshot.configSha256, sourceUpdatedAt: state.snapshot.sourceUpdatedAt, detectedAt: state.snapshot.detectedAt, sourceDateBasis: state.snapshot.sourceDateBasis } : null });
      } catch (error) {
        return json({ ok: false, error: error.message }, 500);
      }
    }

    if (url.pathname === APP.webhookPath && request.method === 'POST') {
      return handleWebhook(request, env, ctx);
    }

    if (url.pathname === '/github/webhook' && request.method === 'POST') {
      return handleGithubWebhook(request, env, ctx);
    }

    if (url.pathname === '/github/action' && request.method === 'POST') {
      return handleGithubAction(request, env, ctx);
    }

    if (url.pathname === '/internal/process-text-job' && request.method === 'POST') {
      return handleInternalTextJob(request, env, ctx);
    }

    if (url.pathname === '/internal/process-broadcast' && request.method === 'POST') {
      return handleInternalBroadcast(request, env, ctx);
    }

    if (url.pathname === '/admin/setup' && request.method === 'POST') {
      if (!requireAdmin(request, env)) return textResponse('forbidden', 403);
      try { return json(await configureTelegram(env, request)); } catch (error) { return json({ ok: false, error: error.message }, 500); }
    }

    if (url.pathname === '/admin/sync' && request.method === 'POST') {
      if (!requireAdmin(request, env)) return textResponse('forbidden', 403);
      try {
        const result = await runSync(env, { broadcast: true, origin: new URL(request.url).origin });
        return json({
          ok: !result.locked,
          locked: Boolean(result.locked),
          changed: Boolean(result.changed),
          meaningfulChange: Boolean(result.meaningfulChange),
          digest: result.snapshot?.configSha256 || null,
          rawSha256: result.snapshot?.rawSha256 || null,
          added: result.change?.added ?? 0,
          removed: result.change?.removed ?? 0,
        });
      } catch (error) { return json({ ok: false, error: error.message }, 500); }
    }

    if (url.pathname === '/admin/live-debug' && request.method === 'GET') {
      if (!requireAdmin(request, env)) return textResponse('forbidden', 403);
      try {
        const fetched = await fetchSource(SOURCES[0], { cacheBust: true });
        const stats = await buildStats(fetched.text, env);
        const meta = await fetchGithubCommitMeta(SOURCES[0].fileName, env);
        return json({
          ok: true,
          fetchedAt: fetched.fetchedAt,
          bytes: fetched.bytes,
          rawSha256: await sha256Hex(fetched.text),
          normalizedSha256: await sha256Hex(fetched.normalized),
          embeddedTimestamps: stats.embeddedTimestamps,
          github: meta,
          lastModified: fetched.lastModified,
          etag: fetched.etag,
        });
      } catch (error) { return json({ ok: false, error: error.message }, 500); }
    }

    if (url.pathname === '/admin/status' && request.method === 'GET') {
      if (!requireAdmin(request, env)) return textResponse('forbidden', 403);
      try { return json(await adminStatus(env)); } catch (error) { return json({ ok: false, error: error.message }, 500); }
    }

    if (url.pathname === '/admin/telegram-status' && request.method === 'GET') {
      if (!requireAdmin(request, env)) return textResponse('forbidden', 403);
      try { return json(await adminTelegramStatus(env)); } catch (error) { return json({ ok: false, error: error.message }, 500); }
    }

    if (url.pathname === '/admin/test-send' && request.method === 'POST') {
      if (!requireAdmin(request, env)) return textResponse('forbidden', 403);
      try { return json(await adminTestSend(env, request)); } catch (error) { return json({ ok: false, error: error.message }, 500); }
    }

    if (url.pathname === '/admin/remove-webhook' && request.method === 'POST') {
      if (!requireAdmin(request, env)) return textResponse('forbidden', 403);
      try { return json(await adminRemoveWebhook(env)); } catch (error) { return json({ ok: false, error: error.message }, 500); }
    }

    if (url.pathname === '/' && request.method === 'GET') {
      return json({ ok: true, bot: APP.name, username: APP.username, site: APP.siteUrl, webhookPath: APP.webhookPath, githubWebhookPath: '/github/webhook', githubActionPath: '/github/action', archive: true, textDeliveryQueue: true });
    }

    return textResponse('Not found', 404);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        const state = await getState(env);
        const cronAt = nowIso();
        await putState(env, { ...(state || {}), monitor: { ...(state?.monitor || {}), lastCronAt: cronAt }, updatedAt: cronAt });
        const result = await runSync(env, { broadcast: true });
        console.log('Scheduled source check:', JSON.stringify({
          scheduledAt: controller.scheduledTime,
          changed: Boolean(result.changed),
          metadataChanged: Boolean(result.metadataChanged),
          meaningfulChange: Boolean(result.meaningfulChange),
          digest: result.snapshot?.configSha256 || null,
          added: result.change?.added || 0,
          removed: result.change?.removed || 0,
        }));
      } catch (error) {
        console.error('scheduled error:', error?.stack || error);
        try {
          const state = await getState(env);
          const failedAt = nowIso();
          await putState(env, { ...(state || {}), monitor: { ...(state?.monitor || {}), lastCronAt: failedAt, lastCheckAt: failedAt, lastCheckOk: false, lastError: error?.message || String(error) }, updatedAt: failedAt });
        } catch {}
      }
    })());
  },
};
