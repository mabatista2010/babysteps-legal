#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const htmlPath = join(root, 'reset-password.html');
const robotsPath = join(root, 'robots.txt');
const html = readFileSync(htmlPath, 'utf8');
const robots = readFileSync(robotsPath, 'utf8');
const verifyCdn = process.argv.includes('--verify-cdn');
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function includesAll(source, values, label) {
  for (const value of values) {
    check(source.includes(value), `${label}: falta ${value}`);
  }
}

check(/<meta\s+name="robots"\s+content="noindex,nofollow"/i.test(html), 'falta meta robots noindex,nofollow');
check(/<meta\s+name="referrer"\s+content="no-referrer"/i.test(html), 'falta meta referrer no-referrer');
check(/Disallow:\s*\/reset-password\.html/i.test(robots), 'robots.txt no bloquea /reset-password.html');
check(!/localhost:3000/i.test(html), 'reset-password.html contiene localhost:3000');
check(!/service[_-]?role|sb_secret|SUPABASE_SERVICE_ROLE/i.test(html), 'reset-password.html parece contener una clave server-only');

includesAll(html, [
  'https://emsazfgkobjndjzofeoh.supabase.co',
  'sb_publishable__-I0joppOFhW3w9GStRvSg_2UpNWQWQ',
  'babysteps://reset-password',
], 'constantes públicas');

includesAll(html, [
  'access_token',
  'refresh_token',
  'code',
  'token_hash',
  'setSession',
  'exchangeCodeForSession',
  'verifyOtp',
  'updateUser',
  "signOut({ scope: 'global' })",
  'stripRecoveryParamsFromAddressBar',
  'history.replaceState',
], 'flujo Supabase recovery');

const scriptMatch = html.match(/<script\s+src="([^"]*supabase-js@2\.104\.0[^"]*)"([^>]*)><\/script>/i);
check(Boolean(scriptMatch), 'falta script CDN Supabase JS v2.104.0');
if (scriptMatch) {
  const [, src, attrs] = scriptMatch;
  const integrityMatch = attrs.match(/integrity="sha384-([^"]+)"/i);
  check(Boolean(integrityMatch), 'falta integrity sha384 en script Supabase CDN');
  check(/crossorigin="anonymous"/i.test(attrs), 'falta crossorigin anonymous en script Supabase CDN');
  check(/referrerpolicy="no-referrer"/i.test(attrs), 'falta referrerpolicy no-referrer en script Supabase CDN');

  if (verifyCdn && integrityMatch) {
    const response = await fetch(src);
    check(response.ok, `no se pudo descargar CDN Supabase: HTTP ${response.status}`);
    if (response.ok) {
      const bytes = Buffer.from(await response.arrayBuffer());
      const digest = createHash('sha384').update(bytes).digest('base64');
      check(digest === integrityMatch[1], `SRI no coincide: esperado ${integrityMatch[1]}, recibido ${digest}`);
    }
  }
}

if (failures.length) {
  console.error('reset-password.html check FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`reset-password.html check OK${verifyCdn ? ' + CDN SRI verified' : ''}`);
