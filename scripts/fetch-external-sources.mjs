#!/usr/bin/env node
/**
 * V2ray_Sub — isolated third-party subscription collector.
 *
 * - Fetches only the fixed HTTPS URLs from data/external-sources.json.
 * - Never changes Mix.txt, Irancell.txt or Mci.txt.
 * - Produces status metadata and a separate External.txt bundle.
 * - Counts syntactically parseable URI lines; it does not claim that proxy endpoints work.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'data', 'external-sources.json');
const STATUS_PATH = path.join(ROOT, 'data', 'external-sources-status.json');
const OUTPUT_PATH = path.join(ROOT, 'External.txt');
const FETCH_TIMEOUT_MS = Number(process.env.EXTERNAL_FETCH_TIMEOUT_MS || 15000);
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const ALLOWED_PROTOCOLS = new Set(['vless', 'vmess', 'trojan', 'ss', 'ssr', 'socks', 'socks5', 'hysteria', 'hysteria2', 'tuic', 'wireguard']);
const URI_RE = /^(vless|vmess|trojan|ss|ssr|socks5?|hysteria2?|tuic|wireguard):\/\//i;

function nowIso() { return new Date().toISOString(); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function safeError(error) {
  return String(error?.message || error || 'unknown error')
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 220);
}
function cleanUrlForReport(value) {
  const url = new URL(value);
  // Keep non-sensitive fragments such as source labels; fragments are never sent to the origin.
  // The manifest must never contain tokens. Also ensure no accidental credential-like
  // query parameter can be written to the public status document.
  for (const key of [...url.searchParams.keys()]) {
    if (/(token|key|secret|auth|password|credential)/i.test(key)) url.searchParams.delete(key);
  }
  url.username = '';
  url.password = '';
  return url.toString();
}
function assertSafeHttpsUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('Only HTTPS source URLs are permitted.');
  if (url.username || url.password) throw new Error('URL credentials are not permitted.');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new Error('Local hostnames are not permitted.');
  }
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1$|fc|fd)/i.test(host)) {
    throw new Error('Private or loopback destinations are not permitted.');
  }
  return url;
}

function decodeBase64(input) {
  const compact = String(input || '').trim().replace(/\s+/g, '');
  if (compact.length < 12 || !/^[A-Za-z0-9+/_=-]+$/.test(compact)) return null;
  try {
    const normalized = compact.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(normalized, 'base64').toString('utf8');
    if (!decoded || decoded.includes('\uFFFD')) return null;
    return decoded;
  } catch {
    return null;
  }
}

function isDisallowedHost(value) {
  const host = String(value || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host === '::' || host === '::1') return true;
  const family = isIP(host);
  if (family === 4) {
    const [a, b] = host.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254)
      || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
  }
  if (family === 6) {
    return host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:');
  }
  return false;
}

function parseVmess(uri) {
  const encoded = uri.slice('vmess://'.length).split('#')[0].split('?')[0];
  const decoded = decodeBase64(encoded);
  if (!decoded) return null;
  try {
    const obj = JSON.parse(decoded);
    const host = String(obj.add || obj.host || '').trim();
    const port = Number(obj.port);
    if (!host || isDisallowedHost(host) || !Number.isInteger(port) || port < 1 || port > 65535) return null;
    return { protocol: 'vmess', host, port };
  } catch {
    return null;
  }
}

function parseSsr(uri) {
  const encoded = uri.slice('ssr://'.length).split('#')[0].split('?')[0];
  const decoded = decodeBase64(encoded);
  if (!decoded) return null;
  const match = decoded.match(/^(\[[^\]]+\]|[^:/?#]+):(\d+):/);
  if (!match) return null;
  const port = Number(match[2]);
  if (isDisallowedHost(match[1]) || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { protocol: 'ssr', host: match[1], port };
}

function parseConfigUri(raw) {
  const value = String(raw || '').trim().replace(/^\uFEFF/, '');
  const schemeMatch = value.match(URI_RE);
  if (!schemeMatch) return null;
  const protocol = schemeMatch[1].toLowerCase();
  if (!ALLOWED_PROTOCOLS.has(protocol)) return null;
  if (protocol === 'vmess') return parseVmess(value);
  if (protocol === 'ssr') return parseSsr(value);

  try {
    const parsed = new URL(value);
    const host = String(parsed.hostname || '').replace(/^\[|\]$/g, '');
    const port = Number(parsed.port || 0);
    if (host && !isDisallowedHost(host)
      && Number.isInteger(port) && port >= 1 && port <= 65535) {
      return { protocol, host, port };
    }
  } catch {
    // Fall through to the encoded Shadowsocks variant below.
  }

  // Some Shadowsocks URI variants encode the complete "method:password@host:port" tuple.
  if (protocol === 'ss') {
    const decoded = decodeBase64(value.slice('ss://'.length).split('#')[0].split('?')[0]);
    if (decoded) {
      const match = decoded.match(/@(?:\[([^\]]+)\]|([^:/?#]+)):(\d+)/);
      if (match) {
        const host = match[1] || match[2];
        const port = Number(match[3]);
        if (host && !isDisallowedHost(host) && Number.isInteger(port) && port >= 1 && port <= 65535) {
          return { protocol, host, port };
        }
      }
    }
  }
  return null;
}

function extractCandidates(input) {
  const original = String(input || '').replace(/^\uFEFF/, '');
  const lines = original.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  let candidates = lines.filter(line => URI_RE.test(line));
  let decodedWhole = null;

  // Handle subscription responses that are Base64-encoded as a single document.
  if (!candidates.length) {
    decodedWhole = decodeBase64(original);
    if (decodedWhole) {
      candidates = decodedWhole.split(/\r?\n/).map(line => line.trim()).filter(line => URI_RE.test(line));
    }
  }

  // Some feeds mix individually Base64-encoded URI rows with plain URI rows.
  if (!candidates.length) {
    for (const line of lines) {
      const decoded = decodeBase64(line);
      if (!decoded) continue;
      for (const candidate of decoded.split(/\r?\n/).map(x => x.trim()).filter(x => URI_RE.test(x))) {
        candidates.push(candidate);
      }
    }
  }
  return candidates;
}

export function analyzeFeed(input) {
  const candidates = extractCandidates(input);
  const seen = new Set();
  const valid = [];
  const protocols = {};
  let invalid = 0;

  for (const line of candidates) {
    const parsed = parseConfigUri(line);
    if (!parsed) { invalid += 1; continue; }
    const normalized = line.trim();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    valid.push(normalized);
    protocols[parsed.protocol] = (protocols[parsed.protocol] || 0) + 1;
  }

  return {
    detectedCount: candidates.length,
    validCount: valid.length,
    invalidCount: invalid,
    duplicateCount: Math.max(0, candidates.length - valid.length - invalid),
    protocols,
    configs: valid,
  };
}

async function readLimited(response, maxBytes) {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > maxBytes) throw new Error(`Response exceeds ${maxBytes} bytes.`);
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`Response exceeds ${maxBytes} bytes.`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total).toString('utf8');
}

async function fetchText(source) {
  const originalUrl = assertSafeHttpsUrl(source.url);
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const started = Date.now();
    let url = new URL(originalUrl.toString());
    let response;

    try {
      for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
        assertSafeHttpsUrl(url.toString());
        response = await fetch(url, {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            accept: 'text/plain, application/octet-stream, */*',
            'cache-control': 'no-cache, no-store',
            'user-agent': 'V2ray_Sub-External-Source-Checker/1.0',
          },
        });

        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          if (!location || hop === MAX_REDIRECTS) throw new Error('Redirect limit reached.');
          url = new URL(location, url);
          continue;
        }
        break;
      }

      if (!response || !response.ok) throw new Error(`HTTP ${response?.status || 'network error'}`);
      const text = await readLimited(response, Math.min(Number(source.maxResponseBytes || 0) || MAX_BODY_BYTES, MAX_BODY_BYTES));
      if (!text.trim()) throw new Error('Empty response body.');
      return {
        text,
        httpStatus: response.status,
        latencyMs: Date.now() - started,
        bytes: Buffer.byteLength(text, 'utf8'),
        etag: response.headers.get('etag') || null,
        lastModified: response.headers.get('last-modified') || null,
      };
    } catch (error) {
      lastError = error;
      // A permanent access/not-found response will not improve with retries.
      if (/HTTP (?:400|401|403|404|410)\b/.test(String(error?.message || error))) break;
    } finally {
      clearTimeout(timer);
    }

    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 700 : 1600));
  }

  throw lastError || new Error('Source fetch failed.');
}

async function fetchPrivateGithubContents(source) {
  const token = process.env.EXTERNAL_GITHUB_TOKEN;
  if (!token) throw new Error('EXTERNAL_GITHUB_TOKEN is not configured.');
  const api = assertSafeHttpsUrl(source.apiUrl || '');
  if (api.hostname !== 'api.github.com') throw new Error('Private source API must use api.github.com.');
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(api, {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'V2ray_Sub-External-Source-Checker/1.0',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (Number(payload?.size || 0) > MAX_BODY_BYTES) throw new Error(`Private source exceeds ${MAX_BODY_BYTES} bytes.`);
    if (payload?.encoding !== 'base64' || typeof payload.content !== 'string') {
      throw new Error('GitHub Contents API did not return a Base64 file payload.');
    }
    const text = Buffer.from(payload.content.replace(/\s+/g, ''), 'base64').toString('utf8');
    if (!text.trim() || Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
      throw new Error('Private source is empty or exceeds the configured size limit.');
    }
    return {
      text,
      httpStatus: response.status,
      latencyMs: Date.now() - started,
      bytes: Buffer.byteLength(text, 'utf8'),
      etag: response.headers.get('etag') || null,
      lastModified: response.headers.get('last-modified') || null,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));
  if (!Array.isArray(manifest.sources) || !manifest.sources.length) throw new Error('No sources configured.');

  const checkedAt = nowIso();
  const results = [];
  const aggregate = [];
  const aggregateSeen = new Set();
  let successCount = 0;
  let offlineCount = 0;
  let unknownCount = 0;

  for (const source of manifest.sources) {
    const base = {
      id: source.id,
      name: source.name,
      provider: source.provider || '',
      category: source.category || 'other',
      url: cleanUrlForReport(source.url),
      enabled: source.enabled !== false,
      includeInAggregate: source.includeInAggregate !== false,
      lastCheckedAt: checkedAt,
    };

    if (source.enabled === false) {
      results.push({ ...base, health: 'disabled', httpStatus: null, configCount: 0, validConfigCount: 0, invalidConfigCount: 0, duplicateCount: 0, protocols: {}, latencyMs: null, note: 'Disabled in the source manifest.' });
      continue;
    }

    try {
      const fetched = source.id === 'family-sub' && process.env.EXTERNAL_GITHUB_TOKEN && source.apiUrl
        ? await fetchPrivateGithubContents(source)
        : await fetchText(source);
      const analysis = analyzeFeed(fetched.text);
      const health = analysis.validCount > 0 ? (analysis.invalidCount > 0 ? 'partial' : 'available') : 'empty';

      if (source.includeInAggregate !== false) {
        for (const config of analysis.configs) {
          if (!aggregateSeen.has(config)) {
            aggregateSeen.add(config);
            aggregate.push(config);
          }
        }
      }

      results.push({
        ...base,
        health,
        httpStatus: fetched.httpStatus,
        configCount: analysis.detectedCount,
        validConfigCount: analysis.validCount,
        invalidConfigCount: analysis.invalidCount,
        duplicateCount: analysis.duplicateCount,
        protocols: analysis.protocols,
        latencyMs: fetched.latencyMs,
        bytes: fetched.bytes,
        etag: fetched.etag,
        lastModified: fetched.lastModified,
        contentSha256: sha256(fetched.text),
        note: health === 'empty' ? 'The endpoint responded but no valid supported configuration URI was found.' : '',
      });
      if (health === 'available' || health === 'partial') successCount += 1;
      else if (health === 'empty') offlineCount += 1;
    } catch (error) {
      const message = safeError(error);
      const match = message.match(/\bHTTP\s+(\d{3})\b/);
      // GitHub deliberately returns 404 for some private repositories when no token is sent.
      // Keep that case unknown rather than incorrectly claiming the source is dead.
      const needsAuthCheck = source.id === 'family-sub' && !process.env.EXTERNAL_GITHUB_TOKEN;
      const health = match && !needsAuthCheck ? 'offline' : 'unknown';
      results.push({
        ...base,
        health,
        httpStatus: match ? Number(match[1]) : null,
        configCount: 0,
        validConfigCount: 0,
        invalidConfigCount: 0,
        duplicateCount: 0,
        protocols: {},
        latencyMs: null,
        note: message,
      });
      if (health === 'offline') offlineCount += 1;
      else unknownCount += 1;
    }
  }

  const previous = await fs.readFile(OUTPUT_PATH, 'utf8').catch(() => '');
  const previousStatus = await fs.readFile(STATUS_PATH, 'utf8')
    .then(value => JSON.parse(value))
    .catch(() => null);
  const previousAnalysis = analyzeFeed(previous);
  const canWriteAggregate = aggregate.length > 0;
  let aggregateStale = false;
  if (canWriteAggregate) {
    await fs.writeFile(OUTPUT_PATH, `${aggregate.join('\n')}\n`, 'utf8');
  } else {
    aggregateStale = Boolean(previous.trim() && !previous.includes('No third-party source'));
    if (!previous.trim()) await fs.writeFile(OUTPUT_PATH, '# No third-party source currently returned a valid config.\n', 'utf8');
  }

  const aggregateText = await fs.readFile(OUTPUT_PATH, 'utf8');
  const status = {
    schemaVersion: 1,
    generatedAt: checkedAt,
    checkMode: 'github-actions',
    checkNotice: 'Source reachability and URI syntax are checked. This is not a live proxy connectivity test.',
    totalSources: results.length,
    availableSources: successCount,
    offlineSources: offlineCount,
    unknownSources: unknownCount,
    aggregate: {
      file: 'External.txt',
      url: 'https://raw.githubusercontent.com/mehrdadmb2/V2ray_Sub/refs/heads/main/External.txt',
      configCount: canWriteAggregate ? aggregate.length : previousAnalysis.validCount,
      uniqueCount: canWriteAggregate ? aggregate.length : previousAnalysis.validCount,
      bytes: Buffer.byteLength(aggregateText, 'utf8'),
      sha256: sha256(aggregateText),
      updatedAt: canWriteAggregate ? checkedAt : (previousStatus?.aggregate?.updatedAt || null),
      stale: aggregateStale,
    },
    sources: results,
  };

  await fs.writeFile(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`, 'utf8');

  const countLabel = results.map(item => `${item.id}:${item.health}/${item.validConfigCount ?? 0}`).join(' | ');
  console.log(`External sources checked: ${successCount} available, ${offlineCount} unavailable, ${aggregate.length} unique configs`);
  console.log(countLabel);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    const rows = results.map(item => `| ${item.name.replace(/\|/g, '\\|')} | ${item.health} | ${item.httpStatus ?? '—'} | ${item.validConfigCount ?? 0} | ${Object.entries(item.protocols || {}).map(([p,n]) => `${p}: ${n}`).join(', ') || '—'} |`).join('\n');
    await fs.appendFile(summaryPath,
      `\n## External subscription check\n\n> Endpoint availability is not proof of proxy connectivity.\n\n` +
      `- Sources: ${results.length}\n- Available: ${successCount}\n- Unique aggregate configs: ${aggregate.length}\n\n` +
      `| Source | Health | HTTP | Valid URI | Protocols |\n|---|---:|---:|---:|---|\n${rows}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  main().catch(error => {
    console.error('External source check failed:', safeError(error));
    process.exitCode = 1;
  });
}
