#!/usr/bin/env node
// Deterministic local generation ONLY. This script never sends email or changes Auth.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const locales = ['es', 'fr', 'en', 'pt-PT', 'it'];
const copy = JSON.parse(readFileSync(join(root, 'data/recovery-copy.json'), 'utf8'));
const web = 'https://mabatista2010.github.io/babysteps-legal/reset-password.html';
const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
if (JSON.stringify(Object.keys(copy)) !== JSON.stringify(locales)) throw new Error('Exactly five ordered locales required');
for (const locale of locales) {
  for (const section of ['bridge', 'email']) {
    if (JSON.stringify(Object.keys(copy[locale][section])) !== JSON.stringify(Object.keys(copy.es[section]))) throw new Error(`Missing keys: ${locale}/${section}`);
    for (const value of Object.values(copy[locale][section])) {
      if (typeof value !== 'string' || !value.trim() || /\{\{|<script|__TEXT_|\bTODO\b|\bFIXME\b/i.test(value)) throw new Error(`Unsafe/empty copy: ${locale}/${section}`);
    }
  }
}
const template = readFileSync(join(root, 'templates/reset-password.template.html'), 'utf8');
const bridge = template.replace(/__TEXT_(\w+)__/g, (_, key) => {
  if (!copy.es.bridge[key]) throw new Error(`Unknown key ${key}`);
  return escape(copy.es.bridge[key]);
}).replace('__BRIDGE_COPY_JSON__', JSON.stringify(Object.fromEntries(locales.map((locale) => [locale, copy[locale].bridge])), null, 2).replaceAll('<', '\\u003c'));
function email(locale) {
  const c = copy[locale].email;
  return `<!doctype html>\n<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(c.subject)}</title></head><body style="font-family:Arial,sans-serif;color:#302a26;line-height:1.6;max-width:560px;margin:24px auto;padding:0 20px">\n<p>BabySteps</p>\n<h1 style="font-size:24px">${escape(c.title)}</h1>\n<p>${escape(c.intro)}</p>\n<p><a href="{{ .ConfirmationURL }}">${escape(c.action)}</a></p>\n<p>${escape(c.security)}</p>\n<p>${escape(c.ignore)}</p>\n<p>${escape(c.help)} <a href="mailto:support@babysteps.space">support@babysteps.space</a></p>\n</body></html>`;
}
// Go's standard eq/if only; no unverified custom split/contains functions.
// Exact request redirect, not user metadata. Missing/unsupported/legacy input -> es.
function branches(render) {
  return locales.filter((locale) => locale !== 'es').map((locale, i) => `{{ ${i ? 'else if' : 'if'} eq .RedirectTo "${web}?lang=${locale}" }}${render(locale)}`).join('') + `{{ else }}${render('es')}{{ end }}\n`;
}
const outputs = {
  'reset-password.html': bridge,
  'auth/recovery-email.html': branches(email),
  'auth/recovery-subject.txt': branches((locale) => copy[locale].email.subject),
  'auth/recovery-config-proposal.json': JSON.stringify({
    mailer_subjects_recovery: branches((locale) => copy[locale].email.subject).trim(),
    mailer_templates_recovery_content: branches(email),
  }, null, 2) + '\n',
};
for (const [path, text] of Object.entries(outputs)) {
  if (process.argv.includes('--check')) {
    if (readFileSync(join(root, path), 'utf8') !== text) throw new Error(`Stale output: ${path}`);
  } else writeFileSync(join(root, path), text);
}
console.log(`Recovery generation ${process.argv.includes('--check') ? 'check' : 'local write'}: 5 locales, 4 outputs; no network.`);
