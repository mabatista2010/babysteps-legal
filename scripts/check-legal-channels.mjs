#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(root, p));
const json = (p) => JSON.parse(read(p));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const legacy = json('data/legacy-channel-lock.json');
const manifest = json('legal/2026-09-24/manifest.json');
const base = 'https://mabatista2010.github.io/babysteps-legal/';
assert.equal(legacy.gitBase, '95673d138bcbf8bc3a42caffbacb05bca985c8f0');
assert.equal(legacy.files.length, 30);
for (const row of legacy.files) {
  const bytes = read(row.file);
  assert.equal(bytes.length, row.bytes, row.file);
  assert.equal(hash(bytes), row.sha256, `Legacy surface changed: ${row.file}`);
}
assert.equal(manifest.schemaVersion, 3);
assert.equal(manifest.channel, 'checked-v2');
assert.equal(manifest.publishedAt, null);
assert.equal(manifest.publicationAuthorized, false);
assert.equal(manifest.activationAuthorized, false);
assert.equal(manifest.publicationStatus, 'PREPARED_FOR_REVIEW_NOT_PUBLISHED');
assert.equal(manifest.privacyContentBase.version, '2026-07-17');
assert.equal(manifest.privacyContentBase.clausesChanged, false);
assert.equal(manifest.documents.length, 10);
const keys = new Set();
for (const doc of manifest.documents) {
  assert(['es', 'fr', 'en', 'pt-PT', 'it'].includes(doc.locale));
  assert(['terms', 'privacy'].includes(doc.type));
  const suffix = doc.locale === 'en' ? '' : doc.locale === 'pt-PT' ? '-pt' : `-${doc.locale}`;
  const name = `${doc.type}${suffix}.html`;
  assert.equal(doc.version, '2026-09-24');
  assert.equal(doc.publicUrl, `${base}legal/${doc.version}/${name}`);
  assert.equal(doc.currentUrl, doc.publicUrl);
  assert.equal(doc.legacyCurrentUrl, `${base}${name}`);
  const html = read(`legal/${doc.version}/${name}`);
  assert.equal(hash(html), doc.sha256);
  assert.notEqual(hash(read(name)), doc.sha256, 'Old mutable alias must not become the new edition');
  assert(html.toString().includes('support@babysteps.space'));
  for (const [, url] of html.toString().matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (!url.startsWith(base)) continue;
    const relative = url.slice(base.length).split('#')[0];
    assert(existsSync(path.join(root, relative)), `Broken V2 source reference ${url}`);
    assert(!/^(terms|privacy)(?:-[a-z]+)?\.html$/.test(relative), `V2 links to legacy alias ${url}`);
  }
  const key = `${doc.locale}/${doc.type}`; assert(!keys.has(key)); keys.add(key);
}
console.log(JSON.stringify({ result: 'PASS', legacyFilesFrozen: legacy.files.length, immutableV2Documents: keys.size,
  channel: manifest.channel, published: false, activated: false, noLegacyAliasChanges: true }));
