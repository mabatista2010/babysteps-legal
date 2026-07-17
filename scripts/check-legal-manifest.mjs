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
const expectedBaseUrl = 'https://mabatista2010.github.io/babysteps-legal';
const expectedLocales = ['es', 'fr', 'en', 'pt-PT', 'it'];
const expectedTypes = ['privacy', 'terms'];
const expectedFiles = {
  privacy: {
    es: 'privacy-es.html',
    fr: 'privacy-fr.html',
    en: 'privacy.html',
    'pt-PT': 'privacy-pt.html',
    it: 'privacy-it.html',
  },
  terms: {
    es: 'terms-es.html',
    fr: 'terms-fr.html',
    en: 'terms.html',
    'pt-PT': 'terms-pt.html',
    it: 'terms-it.html',
  },
};
const approvedAnalyticsGateByLocale = {
  es: 'La analítica opcional permanece desactivada en el momento de publicación.',
  fr: 'L’analytique facultative reste désactivée au moment de la publication.',
  en: 'Optional analytics remains disabled at publication.',
  'pt-PT': 'A analítica opcional permanece desativada no momento da publicação.',
  it: 'L’analitica facoltativa resta disattivata al momento della pubblicazione.',
};
const forbiddenApprovalPlaceholders = [
  /candidate legal basis/i,
  /this candidate/i,
  /base jurídica candidata/i,
  /esta candidata/i,
  /base juridique candidate/i,
  /version candidate/i,
  /versão candidata/i,
  /base giuridica candidata/i,
  /versione candidata/i,
  /subject to legal review/i,
  /pendiente de revisión jurídica/i,
  /soumise à une revue juridique/i,
  /sujeita a revisão jurídica/i,
  /soggetta a revisione legale/i,
];

if (manifest.schemaVersion !== 2) {
  throw new Error(`Unsupported manifest schema: ${manifest.schemaVersion}`);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.manifestVersion ?? '')) {
  throw new Error('Invalid manifestVersion.');
}
if (manifest.manifestVersion !== manifest.documentVersions?.privacy) {
  throw new Error('manifestVersion must match the current privacy document version.');
}
for (const type of expectedTypes) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.documentVersions?.[type] ?? '')) {
    throw new Error(`Invalid document version for ${type}.`);
  }
}
if (manifest.baseUrl !== expectedBaseUrl) {
  throw new Error(`Unexpected baseUrl: ${manifest.baseUrl}`);
}
if (manifest.reviewStatus !== 'approved-human-legal-review') {
  throw new Error(`Legal review is not approved: ${manifest.reviewStatus}`);
}
if (manifest.legalBasisFinal !== true) {
  throw new Error('legalBasisFinal must be true before publication.');
}
if (manifest.publicationAuthorized !== true) {
  throw new Error('publicationAuthorized must be true before publication.');
}
if (!Number.isFinite(Date.parse(manifest.generatedAt))) {
  throw new Error('generatedAt must be a valid timestamp.');
}
if (!Array.isArray(manifest.documents) || manifest.documents.length !== 10) {
  throw new Error('Manifest must contain exactly 10 privacy/terms documents.');
}

const seen = new Set();
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function bytesForUrl(rawUrl) {
  if (live) {
    const response = await fetch(rawUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${rawUrl}`);
    return Buffer.from(await response.arrayBuffer());
  }

  const url = new URL(rawUrl);
  const relative = url.pathname.replace(/^\/babysteps-legal\//, '').replace(/^\//, '');
  return readFile(path.join(repoRoot, relative));
}

for (const doc of manifest.documents) {
  if (!expectedTypes.includes(doc.type)) throw new Error(`Unexpected type: ${doc.type}`);
  if (!expectedLocales.includes(doc.locale)) throw new Error(`Unexpected locale: ${doc.locale}`);

  const key = `${doc.type}:${doc.locale}`;
  if (seen.has(key)) throw new Error(`Duplicate document entry: ${key}`);
  seen.add(key);

  const expectedVersion = manifest.documentVersions[doc.type];
  const expectedFile = expectedFiles[doc.type][doc.locale];
  const expectedCurrentUrl = `${expectedBaseUrl}/${expectedFile}`;
  const expectedPublicUrl = `${expectedBaseUrl}/legal/${expectedVersion}/${expectedFile}`;

  if (doc.version !== expectedVersion) {
    throw new Error(`Version mismatch for ${key}: expected ${expectedVersion}, got ${doc.version}`);
  }
  if (doc.currentUrl !== expectedCurrentUrl) {
    throw new Error(`Unexpected currentUrl for ${key}: ${doc.currentUrl}`);
  }
  if (doc.publicUrl !== expectedPublicUrl) {
    throw new Error(`Unexpected publicUrl for ${key}: ${doc.publicUrl}`);
  }
  if (!/^[a-f0-9]{64}$/.test(doc.sha256)) {
    throw new Error(`Invalid sha256 for ${doc.publicUrl}`);
  }

  const [versionedBytes, currentBytes] = await Promise.all([
    bytesForUrl(doc.publicUrl),
    bytesForUrl(doc.currentUrl),
  ]);
  const versionedHash = sha256(versionedBytes);
  const currentHash = sha256(currentBytes);

  if (versionedHash !== doc.sha256) {
    throw new Error(`Hash mismatch for ${doc.publicUrl}: expected ${doc.sha256}, got ${versionedHash}`);
  }
  if (doc.type === 'privacy' && currentHash !== doc.sha256) {
    throw new Error(`Current page differs from ${doc.publicUrl}: expected ${doc.sha256}, got ${currentHash}`);
  }
  if (currentBytes.length === 0) {
    throw new Error(`Current page is empty: ${doc.currentUrl}`);
  }

  if (doc.type === 'privacy') {
    const text = versionedBytes.toString('utf8');
    for (const pattern of forbiddenApprovalPlaceholders) {
      if (pattern.test(text)) {
        throw new Error(`Unresolved legal approval placeholder ${pattern} in ${doc.publicUrl}`);
      }
    }
    for (const requiredToken of [
      'sb-emsazfgkobjndjzofeoh-auth-token',
      '<code>HttpOnly</code>',
      '<code>Secure</code>',
      '<code>SameSite=Lax</code>',
      '<code>Path=/</code>',
      '400',
      'DPA',
      approvedAnalyticsGateByLocale[doc.locale],
    ]) {
      if (!text.includes(requiredToken)) {
        throw new Error(`Missing approved privacy invariant "${requiredToken}" in ${doc.publicUrl}`);
      }
    }
  }
}

for (const type of expectedTypes) {
  for (const locale of expectedLocales) {
    const key = `${type}:${locale}`;
    if (!seen.has(key)) throw new Error(`Missing document entry: ${key}`);
  }
}

console.log(
  `OK approved legal manifest ${manifest.manifestVersion} ` +
    `(privacy ${manifest.documentVersions.privacy}; terms ${manifest.documentVersions.terms}; ` +
    `${manifest.documents.length} documents, current routes + versioned hashes, ${live ? 'live' : 'local'}).`,
  );
