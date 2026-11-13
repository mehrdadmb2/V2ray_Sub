#!/usr/bin/env node
/**
 * V2ray_Sub External Config Renamer.
 * Runs after the fetch workflow and replaces External.txt with a cleaned,
 * deduplicated, consistently named subscription bundle. Mix.txt is untouched.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { extractCandidates, parseConfigUri } from './fetch-external-sources.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW_PATH = path.join(ROOT, 'External-raw.txt');
const OUTPUT_PATH = path.join(ROOT, 'External.txt');
const INDEX_PATH = path.join(ROOT, 'data', 'external-raw-index.json');
const PROCESSED_PATH = path.join(ROOT, 'data', 'external-processed.json');
const STATUS_PATH = path.join(ROOT, 'data', 'external-sources-status.json');
const CONFIG = { prefix: 'SkyBit-', startNumber: 0, timezone: 'Asia/Tehran', timestampFormat: 'yyyy-MM-dd_HH-mm', countryPosition: 'prefix', preserveCountry: true, unknownFlag: '🏴‍☠️', removeDuplicates: true };

const COUNTRY_NAMES = {
  'united states':'US', usa:'US', america:'US', germany:'DE', netherlands:'NL', france:'FR', 'united kingdom':'GB', britain:'GB', england:'GB', canada:'CA', japan:'JP', singapore:'SG', sweden:'SE', switzerland:'CH', finland:'FI', norway:'NO', denmark:'DK', italy:'IT', spain:'ES', australia:'AU', 'new zealand':'NZ', brazil:'BR', india:'IN', russia:'RU', china:'CN', turkey:'TR', iran:'IR', uae:'AE', 'united arab emirates':'AE', 'saudi arabia':'SA', israel:'IL', 'south korea':'KR', korea:'KR', 'hong kong':'HK', taiwan:'TW', indonesia:'ID', malaysia:'MY', thailand:'TH', vietnam:'VN', poland:'PL', austria:'AT', belgium:'BE', 'czech republic':'CZ', czechia:'CZ', ireland:'IE', portugal:'PT', greece:'GR', romania:'RO', bulgaria:'BG', hungary:'HU', slovakia:'SK', slovenia:'SI', croatia:'HR', serbia:'RS', ukraine:'UA', latvia:'LV', lithuania:'LT', estonia:'EE', luxembourg:'LU', iceland:'IS', cyprus:'CY', malta:'MT', moldova:'MD', georgia:'GE', armenia:'AM', azerbaijan:'AZ', kazakhstan:'KZ', uzbekistan:'UZ', kyrgyzstan:'KG', turkmenistan:'TM', tajikistan:'TJ', afghanistan:'AF', pakistan:'PK', bangladesh:'BD', 'sri lanka':'LK', nepal:'NP', bhutan:'BT', maldives:'MV', myanmar:'MM', laos:'LA', cambodia:'KH', brunei:'BN', philippines:'PH', mongolia:'MN', 'north korea':'KP', egypt:'EG', libya:'LY', tunisia:'TN', algeria:'DZ', morocco:'MA', sudan:'SD', 'south sudan':'SS', ethiopia:'ET', somalia:'SO', kenya:'KE', uganda:'UG', rwanda:'RW', tanzania:'TZ', mozambique:'MZ', zambia:'ZM', zimbabwe:'ZW', namibia:'NA', 'south africa':'ZA', nigeria:'NG', ghana:'GH', 'ivory coast':'CI', senegal:'SN', cameroon:'CM', congo:'CG', 'dr congo':'CD', angola:'AO', madagascar:'MG', mauritius:'MU', seychelles:'SC', qatar:'QA', kuwait:'KW', bahrain:'BH', oman:'OM', iraq:'IQ', lebanon:'LB', jordan:'JO', mexico:'MX', argentina:'AR', chile:'CL', colombia:'CO', peru:'PE', panama:'PA', bosnia:'BA', montenegro:'ME', 'north macedonia':'MK', albania:'AL', kosovo:'XK'
};
const ISO_CODES = new Set(Object.values(COUNTRY_NAMES));
const COUNTRY_LABELS = {
  US:'آمریکا', DE:'آلمان', NL:'هلند', FR:'فرانسه', GB:'بریتانیا', CA:'کانادا', JP:'ژاپن', SG:'سنگاپور', SE:'سوئد', CH:'سوئیس', FI:'فنلاند', NO:'نروژ', DK:'دانمارک', IT:'ایتالیا', ES:'اسپانیا', AU:'استرالیا', NZ:'نیوزیلند', BR:'برزیل', IN:'هند', RU:'روسیه', CN:'چین', TR:'ترکیه', IR:'ایران', AE:'امارات', SA:'عربستان', KR:'کره‌جنوبی', HK:'هنگ‌کنگ', TW:'تایوان', ID:'اندونزی', MY:'مالزی', TH:'تایلند', VN:'ویتنام', PL:'لهستان', AT:'اتریش', BE:'بلژیک', CZ:'چک', IE:'ایرلند', PT:'پرتغال', GR:'یونان', RO:'رومانی', BG:'بلغارستان', HU:'مجارستان', UA:'اوکراین', EG:'مصر', ZA:'آفریقای جنوبی', XK:'کوزوو'
};

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function decodeFragment(uri) {
  const raw = String(uri).split('#').slice(1).join('#');
  try { return decodeURIComponent(raw.replace(/\+/g, '%20')); } catch { return raw; }
}
function oldName(uri) {
  if (/^vmess:\/\//i.test(uri)) {
    try {
      const part = uri.slice(8).split('#')[0].replace(/-/g, '+').replace(/_/g, '/');
      const json = Buffer.from(part, 'base64').toString('utf8');
      const parsed = JSON.parse(json);
      return String(parsed.ps || parsed.name || '');
    } catch { return ''; }
  }
  return decodeFragment(uri);
}
function flagForCode(code) {
  const normalized = String(code || '').toUpperCase();
  if (!ISO_CODES.has(normalized) || normalized.length !== 2) return '';
  return String.fromCodePoint(...[...normalized].map(ch => ch.codePointAt(0) + 127397));
}
function countryFromName(name) {
  const value = String(name || '').trim();
  if (value.includes(CONFIG.unknownFlag)) return { code: 'ZZ', flag: CONFIG.unknownFlag, label: 'نامشخص' };
  const flagMatch = value.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
  if (flagMatch) {
    const chars = [...flagMatch[0]].map(ch => String.fromCodePoint(ch.codePointAt(0) - 127397)).join('');
    if (ISO_CODES.has(chars)) return { code: chars, flag: flagMatch[0], label: COUNTRY_LABELS[chars] || chars };
  }
  const lower = value.toLocaleLowerCase('en-US');
  for (const [country, code] of Object.entries(COUNTRY_NAMES).sort((a, b) => b[0].length - a[0].length)) {
    if (new RegExp(`(^|[^a-z])${country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i').test(lower)) {
      return { code, flag: flagForCode(code), label: COUNTRY_LABELS[code] || country };
    }
  }
  // Only clearly delimited, uppercase ISO-like tokens are accepted. "ID" is
  // intentionally ignored because it is commonly part of node identifiers.
  const tokens = value.match(/(?:^|[^A-Za-z0-9_-])([A-Z]{2})(?=$|[^A-Za-z0-9_-])/g) || [];
  for (const tokenText of tokens) {
    const token = tokenText.trim().slice(-2);
    if (token !== 'ID' && ISO_CODES.has(token)) return { code: token, flag: flagForCode(token), label: COUNTRY_LABELS[token] || token };
  }
  return { code: 'ZZ', flag: CONFIG.unknownFlag, label: 'نامشخص' };
}
function timestampInTimezone(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CONFIG.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).reduce((acc, part) => (acc[part.type] = part.value, acc), {});
  return `${parts.year}-${parts.month}-${parts.day}_${parts.hour}-${parts.minute}`;
}
function renameLink(uri, label) {
  const value = String(uri).trim();
  if (/^vmess:\/\//i.test(value)) {
    const payload = value.slice(8).split('#')[0].replace(/-/g, '+').replace(/_/g, '/');
    const config = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    config.ps = label;
    return `vmess://${Buffer.from(JSON.stringify(config), 'utf8').toString('base64')}`;
  }
  if (!value.includes('://')) throw new Error('URI protocol separator is missing');
  return `${value.split('#')[0]}#${encodeURIComponent(label)}`;
}
function readSourceNames(status) {
  return new Map((status?.sources || []).map(source => [source.id, source.name || source.id]));
}

export function processExternalText(rawText, rawIndex = {}, sourceNameMap = new Map(), now = new Date()) {
  const candidates = extractCandidates(String(rawText || ''));
  const sourceIndex = new Map((rawIndex?.configs || []).map(item => [item.identitySha256 || item.sha256, Array.isArray(item.sourceIds) ? item.sourceIds : []]));
  const seen = new Map();
  const output = [];
  const configs = [];
  const protocols = {};
  const countries = {};
  const sourceProcessed = {};
  let invalidCount = 0;
  let duplicateCount = 0;
  const stamp = timestampInTimezone(now);

  for (const candidate of candidates) {
    const line = String(candidate || '').trim().replace(/^\uFEFF/, '');
    const parsed = parseConfigUri(line);
    if (!parsed) { invalidCount += 1; continue; }
    const identity = line.split('#')[0].trim();
    const sourceIds = sourceIndex.get(sha256(identity)) || sourceIndex.get(sha256(line)) || [];
    if (CONFIG.removeDuplicates && seen.has(identity)) {
      duplicateCount += 1;
      const existing = configs[seen.get(identity)];
      existing.sourceIds = [...new Set([...existing.sourceIds, ...sourceIds])];
      existing.sourceNames = existing.sourceIds.map(id => sourceNameMap.get(id) || id);
      continue;
    }

    const originalName = oldName(line);
    const country = countryFromName(originalName);
    const sequence = CONFIG.startNumber + output.length;
    const baseName = `${CONFIG.prefix}${sequence}_${stamp}`;
    const newName = `${country.flag} ${baseName}`.trim();
    let renamed;
    try { renamed = renameLink(line, newName); }
    catch { invalidCount += 1; continue; }

    const configIndex = configs.length;
    seen.set(identity, configIndex);
    output.push(renamed);
    configs.push({
      index: configIndex,
      protocol: parsed.protocol,
      host: parsed.host,
      port: parsed.port,
      countryCode: country.code,
      countryFlag: country.flag,
      countryLabel: country.label,
      originalName: originalName.slice(0, 240),
      newName,
      sourceIds,
      sourceNames: sourceIds.map(id => sourceNameMap.get(id) || id),
      sha256: sha256(renamed)
    });
    protocols[parsed.protocol] = (protocols[parsed.protocol] || 0) + 1;
    countries[country.code] = countries[country.code] || { code: country.code, flag: country.flag, label: country.label, count: 0 };
    countries[country.code].count += 1;
  }

  // Count the final, merged source attribution after cross-source de-duplication.
  for (const item of configs) {
    for (const sourceId of item.sourceIds) sourceProcessed[sourceId] = (sourceProcessed[sourceId] || 0) + 1;
  }

  return {
    text: output.length ? `${output.join('\n')}\n` : '',
    stats: {
      inputCount: candidates.length,
      processedCount: output.length,
      duplicateCount,
      invalidCount,
      protocols,
      countries: Object.values(countries).sort((a, b) => b.count - a.count),
      sourceProcessed
    },
    configs
  };
}

async function main() {
  const raw = await fs.readFile(RAW_PATH, 'utf8').catch(() => '');
  const rawIndex = await fs.readFile(INDEX_PATH, 'utf8').then(JSON.parse).catch(() => ({ configs: [] }));
  const status = await fs.readFile(STATUS_PATH, 'utf8').then(JSON.parse).catch(() => ({}));
  const hasFreshRaw = Boolean(raw.trim()) && !raw.startsWith('# No third-party source') && status.aggregate?.rawStale !== true;
  if (!hasFreshRaw) {
    // A source outage is a valid operational state, not a failed renamer deployment.
    // Keep the last known-good External.txt and mark it stale for the site and bot.
    const staleStatus = {
      ...status,
      aggregate: { ...(status.aggregate || {}), file: 'External.txt', rawFile: 'External-raw.txt', processedStale: true, stale: true },
    };
    await fs.writeFile(STATUS_PATH, `${JSON.stringify(staleStatus, null, 2)}\n`, 'utf8');
    console.warn('No fresh raw subscription data. Previous External.txt and metadata were preserved; status marked stale.');
    return;
  }
  const result = processExternalText(raw, rawIndex, readSourceNames(status));
  if (!result.stats.processedCount || !result.text.trim()) throw new Error('No valid configurations were processed; previous External.txt remains unchanged.');

  const generatedAt = new Date().toISOString();
  const outputHash = sha256(result.text);
  const hasSourceAttribution = result.configs.some(item => item.sourceIds.length > 0);
  const metadata = {
    schemaVersion: 1,
    sourceAttributionAvailable: hasSourceAttribution,
    generatedAt,
    timezone: CONFIG.timezone,
    timestampFormat: CONFIG.timestampFormat,
    naming: { prefix: CONFIG.prefix, countryPosition: CONFIG.countryPosition, unknownCountryFlag: CONFIG.unknownFlag, duplicateIdentity: 'URI before #fragment' },
    stats: result.stats,
    configs: result.configs
  };
  await fs.writeFile(OUTPUT_PATH, result.text, 'utf8');
  await fs.writeFile(PROCESSED_PATH, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

  const updatedStatus = {
    ...status,
    schemaVersion: 2,
    processed: { file: 'data/external-processed.json', generatedAt, ...result.stats },
    aggregate: {
      ...(status.aggregate || {}),
      file: 'External.txt',
      rawFile: 'External-raw.txt',
      rawStale: false,
      configCount: result.stats.processedCount,
      uniqueCount: result.stats.processedCount,
      rawCount: Number(status.aggregate?.rawCount || result.stats.inputCount),
      bytes: Buffer.byteLength(result.text, 'utf8'),
      sha256: outputHash,
      updatedAt: generatedAt,
      processedAt: generatedAt,
      processedStale: false,
      stale: false
    },
    sources: (status.sources || []).map(source => ({
      ...source,
      processedConfigCount: hasSourceAttribution ? Number(result.stats.sourceProcessed[source.id] || 0) : null
    }))
  };
  await fs.writeFile(STATUS_PATH, `${JSON.stringify(updatedStatus, null, 2)}\n`, 'utf8');

  console.log(`External processor: ${result.stats.processedCount} renamed, ${result.stats.duplicateCount} duplicate, ${result.stats.invalidCount} invalid.`);
  console.log(`Protocols: ${Object.entries(result.stats.protocols).map(([key, value]) => `${key}=${value}`).join(', ')}`);
  console.log(`Countries: ${result.stats.countries.map(item => `${item.code}=${item.count}`).join(', ')}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const protocols = Object.entries(result.stats.protocols).sort((a, b) => b[1] - a[1]).map(([name, count]) => `| ${name} | ${count} |`).join('\n');
    const countries = result.stats.countries.map(item => `| ${item.flag} ${item.label} | ${item.count} |`).join('\n');
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,
      `\n## External subscription processing\n\n- Renamed/unique: ${result.stats.processedCount}\n- Duplicates removed: ${result.stats.duplicateCount}\n- Invalid entries: ${result.stats.invalidCount}\n- Timezone: ${CONFIG.timezone}\n- Output: External.txt\n\n### Protocols\n| Protocol | Count |\n|---|---:|\n${protocols || '| — | 0 |'}\n\n### Countries\n| Country | Count |\n|---|---:|\n${countries || '| — | 0 |'}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  main().catch(error => { console.error('External processing failed:', String(error?.message || error)); process.exitCode = 1; });
}
