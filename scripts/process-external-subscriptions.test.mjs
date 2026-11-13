import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { processExternalText } from './process-external-subscriptions.mjs';

const vless = 'vless://00000000-0000-4000-8000-000000000001@edge.example.net:443?encryption=none&security=reality#%F0%9F%87%B3%F0%9F%87%B1%20old-name';
const trojan = 'trojan://password@proxy.example.net:443?security=tls#%F0%9F%87%BA%F0%9F%87%B8%20legacy';
const ss = 'ss://YWVzLTI1Ni1nY206c2VjcmV0@ss.example.org:19999#old';
const vmess = `vmess://${Buffer.from(JSON.stringify({ v: '2', add: 'vmess.example.org', port: '443', id: '00000000-0000-4000-8000-000000000002', ps: '🇨🇭 Swiss node' })).toString('base64')}`;

test('renames protocols with preserved country flags and Tehran timestamp', () => {
  const result = processExternalText([vless, trojan, ss, vmess].join('\n'), { configs: [] }, new Map(), new Date('2026-11-13T06:31:00.000Z'));
  assert.equal(result.stats.processedCount, 4);
  assert.equal(result.configs[0].newName, '🇳🇱 SkyBit-0_2026-11-13_10-01');
  assert.equal(result.configs[1].newName, '🇺🇸 SkyBit-1_2026-11-13_10-01');
  assert.equal(result.configs[2].countryCode, 'ZZ');
  assert.match(result.text.split('\n')[0], /#%F0%9F%87%B3%F0%9F%87%B1%20SkyBit-0_2026-11-13_10-01$/);
  const decodedVmess = JSON.parse(Buffer.from(result.text.split('\n')[3].slice(8), 'base64').toString('utf8'));
  assert.equal(decodedVmess.ps, '🇨🇭 SkyBit-3_2026-11-13_10-01');
});

test('deduplicates provider variants and merges source IDs by endpoint identity', () => {
  const first = 'vless://00000000-0000-4000-8000-000000000001@edge.example.net:443?security=tls#🇺🇸 A';
  const second = first.split('#')[0] + '#🇺🇸 B';
  const identityHash = createHash('sha256').update(first.split('#')[0]).digest('hex');
  const rawIndex = { configs: [{ identitySha256: identityHash, sourceIds: ['source-a', 'source-b'] }] };
  const names = new Map([['source-a', 'Source A'], ['source-b', 'Source B']]);
  const result = processExternalText(`${first}\n${second}`, rawIndex, names, new Date('2026-11-13T06:31:00Z'));
  assert.equal(result.stats.processedCount, 1);
  assert.equal(result.stats.duplicateCount, 1);
  assert.deepEqual(result.configs[0].sourceIds, ['source-a', 'source-b']);
  assert.deepEqual(result.configs[0].sourceNames, ['Source A', 'Source B']);
});

test('unknown countries receive the pirate flag; ambiguous ID is not treated as Indonesia', () => {
  const unknown = 'trojan://password@proxy.example.net:443?security=tls#Node-ID-03';
  const result = processExternalText(unknown, { configs: [] }, new Map(), new Date('2026-11-13T06:31:00Z'));
  assert.equal(result.configs[0].countryCode, 'ZZ');
  assert.equal(result.configs[0].countryFlag, '🏴‍☠️');
  assert.match(result.text, /%F0%9F%8F%B4%E2%80%8D%E2%98%A0%EF%B8%8F/);
});


test('keeps source attribution on the processed index', () => {
  const line = 'vless://00000000-0000-4000-8000-000000000003@source.example.net:443?security=tls#🇩🇪 node';
  const hash = createHash('sha256').update(line).digest('hex');
  const rawIndex = { configs: [{ sha256: hash, sourceIds: ['src-a'] }] };
  const names = new Map([['src-a', 'منبع آزمایشی']]);
  const result = processExternalText(line, rawIndex, names, new Date('2026-11-13T06:31:00Z'));
  assert.deepEqual(result.configs[0].sourceIds, ['src-a']);
  assert.deepEqual(result.configs[0].sourceNames, ['منبع آزمایشی']);
  assert.equal(result.stats.sourceProcessed['src-a'], 1);
});
