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
  // Existing BabySteps tokens, also used by the accepted beta invitation.
  // No image/font fetch: Nunito Sans is optional; Arial is the safe fallback.
  // Presentation tables constrain email layout; there is no card/shadow or tracking.
  return `<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(c.subject)}</title></head>
<body bgcolor="#fbf9f4" style="margin:0;padding:0;background-color:#fbf9f4;color:#4a352e;font-family:'Nunito Sans',Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
<div aria-hidden="true" style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escape(c.title)}</div>
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#fbf9f4" style="width:100%;border-collapse:collapse;background-color:#fbf9f4">
<tr><td align="center" style="padding:24px 16px">
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;border-collapse:collapse">
<tr><td style="padding:16px 24px 32px;color:#4a352e;font-family:'Nunito Sans',Arial,sans-serif;word-wrap:break-word;overflow-wrap:break-word">
<p style="margin:0 0 12px;font-size:24px;line-height:32px;font-weight:800;letter-spacing:-0.6px;color:#4a352e">BabySteps</p>
<table role="presentation" width="40" border="0" cellspacing="0" cellpadding="0" aria-hidden="true" style="width:40px;border-collapse:collapse"><tr><td height="4" bgcolor="#ef8068" style="height:4px;font-size:0;line-height:0;background-color:#ef8068">&nbsp;</td></tr></table>
<h1 style="margin:32px 0 16px;font-size:30px;line-height:36px;font-weight:800;letter-spacing:-0.6px;color:#4a352e;word-wrap:break-word">${escape(c.title)}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:26px;color:#6f5d55">${escape(c.intro)}</p>
<table role="presentation" border="0" cellspacing="0" cellpadding="0" style="border-collapse:separate;max-width:100%;margin:0 0 28px"><tr><td bgcolor="#ef8068" style="border-radius:12px;background-color:#ef8068">
<a href="{{ .ConfirmationURL }}" style="display:inline-block;border:14px solid #ef8068;border-left-width:24px;border-right-width:24px;border-radius:12px;background-color:#ef8068;color:#2b2926;font-family:'Nunito Sans',Arial,sans-serif;font-size:16px;line-height:24px;font-weight:800;text-align:center;text-decoration:none;word-wrap:break-word">${escape(c.action)}</a>
</td></tr></table>
<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#6f5d55">${escape(c.security)}</p>
<p style="margin:0 0 28px;font-size:15px;line-height:24px;color:#6f5d55">${escape(c.ignore)}</p>
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse"><tr><td style="border-top:1px solid #e6ded1;padding-top:24px;color:#4a352e;font-family:'Nunito Sans',Arial,sans-serif">
<p style="margin:0 0 4px;font-size:15px;line-height:24px;font-weight:700">${escape(c.help)}</p>
<p style="margin:0;font-size:15px;line-height:24px"><a href="mailto:support@babysteps.space" style="color:#4a352e;text-decoration:underline;text-underline-offset:3px">support@babysteps.space</a></p>
</td></tr></table>
</td></tr></table>
</td></tr></table>
</body></html>`;
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
