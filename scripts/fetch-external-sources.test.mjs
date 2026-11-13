import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFeed } from './fetch-external-sources.mjs';

const vmess = 'vmess://' + Buffer.from(JSON.stringify({ add: 'node.example.com', port: '443', ps: 'test' })).toString('base64');
const goodVless = 'vless://00000000-0000-4000-8000-000000000001@edge.example.com:443?security=tls&type=ws#node';
const badLocal = 'vless://00000000-0000-4000-8000-000000000001@127.0.0.1:443?security=tls#placeholder';
const badPrivate = 'vless://00000000-0000-4000-8000-000000000001@192.168.1.4:443?security=tls#private';
const goodTrojan = 'trojan://password@proxy.example.net:8443?security=tls#node';
const goodSs = 'ss://YWVzLTEyOC1nY206c2hhZG93c29ja3M=@ss.example.org:443#node';
const wholeEncodedSs = 'ss://' + Buffer.from('aes-128-gcm:secret@ss-encoded.example.org:9443').toString('base64');
const goodSsr = 'ssr://' + Buffer.from('ssr.example.net:8443:origin:aes-128-cfb:plain:cGFzcw==/?remarks=node').toString('base64');
const goodHysteria = 'hysteria2://password@hy2.example.org:8443?sni=example.org#node';
const goodTuic = 'tuic://00000000-0000-4000-8000-000000000001:password@tuic.example.org:443?sni=example.org#node';
const goodSocks = 'socks5://user:password@socks.example.net:1080#node';
const goodWireguard = 'wireguard://privatekey@wg.example.net:51820?publickey=example#node';

test('parses supported URI schemes and excludes placeholders', () => {
  const result = analyzeFeed([goodVless, badLocal, badPrivate, goodTrojan, goodSs, wholeEncodedSs, vmess].join('\n'));
  assert.equal(result.detectedCount, 7);
  assert.equal(result.validCount, 5);
  assert.equal(result.invalidCount, 2);
  assert.equal(result.protocols.vless, 1);
  assert.equal(result.protocols.vmess, 1);
  assert.equal(result.protocols.trojan, 1);
  assert.equal(result.protocols.ss, 2);
});

test('recognizes SSR, SOCKS5, Hysteria2, TUIC and WireGuard endpoints', () => {
  const result = analyzeFeed([goodSsr, goodSocks, goodHysteria, goodTuic, goodWireguard].join('\n'));
  assert.equal(result.validCount, 5);
  assert.equal(result.protocols.ssr, 1);
  assert.equal(result.protocols.socks5, 1);
  assert.equal(result.protocols.hysteria2, 1);
  assert.equal(result.protocols.tuic, 1);
  assert.equal(result.protocols.wireguard, 1);
});

test('removes exact duplicates and ignores comments', () => {
  const result = analyzeFeed(`# header\n${goodVless}\n${goodVless}\n`);
  assert.equal(result.validCount, 1);
  assert.equal(result.duplicateCount, 1);
});

test('decodes a base64 subscription document', () => {
  const encoded = Buffer.from(`${goodVless}\n${goodTrojan}\n`).toString('base64');
  const result = analyzeFeed(encoded);
  assert.equal(result.validCount, 2);
});

test('does not accept unsupported or malformed lines', () => {
  const result = analyzeFeed('https://example.com\nssr://not-base64\nvless://broken');
  assert.equal(result.validCount, 0);
  assert.equal(result.detectedCount, 2);
});

