#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};

const manifestArg = getArg('--manifest');
const live = args.includes('--live');
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = manifestArg ? path.resolve(manifestArg) : path.join(repoRoot, 'legal', 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

if (!manifest.version || !Array.isArray(manifest.documents)) {
  throw new Error('Invalid manifest: missing version/documents.');
}

const expectedLocales = new Set(['es', 'fr', 'en', 'pt-PT']);
const expectedTypes = new Set(['terms', 'privacy']);
const seen = new Set();

async function bytesFor(doc) {
  if (live) {
    const response = await fetch(doc.publicUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${doc.publicUrl}`);
    return Buffer.from(await response.arrayBuffer());
  }
  const url = new URL(doc.publicUrl);
  const relative = url.pathname.replace(/^\/babysteps-legal\//, '').replace(/^\//, '');
  return readFile(path.join(repoRoot, relative));
}

for (const doc of manifest.documents) {
  if (!expectedTypes.has(doc.type)) throw new Error(`Unexpected type: ${doc.type}`);
  if (!expectedLocales.has(doc.locale)) throw new Error(`Unexpected locale: ${doc.locale}`);
  if (doc.version !== manifest.version) throw new Error(`Version mismatch for ${doc.publicUrl}`);
  if (!/^https:\/\/mabatista2010\.github\.io\/babysteps-legal\//.test(doc.publicUrl)) {
    throw new Error(`Unexpected publicUrl host: ${doc.publicUrl}`);
  }
  if (!/^[a-f0-9]{64}$/.test(doc.sha256)) throw new Error(`Invalid sha256 for ${doc.publicUrl}`);
  const key = `${doc.type}:${doc.locale}`;
  if (seen.has(key)) throw new Error(`Duplicate document entry: ${key}`);
  seen.add(key);
  const bytes = await bytesFor(doc);
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== doc.sha256) {
    throw new Error(`Hash mismatch for ${doc.publicUrl}: expected ${doc.sha256}, got ${actual}`);
  }
}

for (const type of expectedTypes) {
  for (const locale of expectedLocales) {
    const key = `${type}:${locale}`;
    if (!seen.has(key)) throw new Error(`Missing document entry: ${key}`);
  }
}

console.log(`OK legal manifest ${manifest.version} (${manifest.documents.length} documents, ${live ? 'live' : 'local'}).`);
