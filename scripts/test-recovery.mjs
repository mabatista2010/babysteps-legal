#!/usr/bin/env node
// Execute the actual generated inline scripts with a small deterministic DOM and mocked Auth.
// No browser rendering, no Supabase traffic, no SMTP, no real accounts or tokens.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'reset-password.html'), 'utf8');
const dictionaries = JSON.parse(readFileSync(join(root, 'data/recovery-copy.json'), 'utf8'));
const web = 'https://mabatista2010.github.io/babysteps-legal/reset-password.html';
const locales = ['es', 'fr', 'en', 'pt-PT', 'it'];
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => s.trim());
assert.equal(scripts.length, 2);
assert.match(html, /<input id="password"[^>]* required disabled>/);
assert.match(html, /<input id="confirm-password"[^>]* required disabled>/);
assert.match(html, /<button id="submit-button"[^>]* disabled>/);
assert(html.indexOf('stripRecoveryParamsFromAddressBar();') < html.indexOf('<link rel="stylesheet"'));
assert(html.indexOf('stripRecoveryParamsFromAddressBar();') < html.indexOf('<script src='));
const results = [];
async function test(name, run) { await run(); results.push(name); }

function fixture(url, options = {}) {
  const calls = [];
  const elements = [];
  const ids = new Map();
  const windowListeners = new Map();
  const timers = new Map();
  const navigations = [];
  const history = [];
  let timerId = 0;
  let current = new URL(url);
  function element(attrs = {}) {
    const listeners = new Map();
    const node = {
      attrs, dataset: {}, textContent: '', disabled: 'disabled' in attrs, value: '', focused: false,
      setAttribute(key, value) { this.attrs[key] = String(value); },
      getAttribute(key) { return this.attrs[key] ?? null; },
      focus() { this.focused = true; },
      addEventListener(type, listener) { listeners.set(type, listener); },
      async dispatch(type) { await listeners.get(type)?.({ preventDefault() {} }); },
    };
    if ('data-copy' in attrs) node.dataset.copy = attrs['data-copy'];
    elements.push(node);
    if (attrs.id) ids.set(attrs.id, node);
    return node;
  }
  for (const match of html.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
    if (!/\bid="|\bdata-copy=|\bdata-support-link\b/.test(match[2])) continue;
    const attrs = Object.fromEntries([...match[2].matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
    if (match[2].includes('data-support-link')) attrs['data-support-link'] = '';
    if (/\bdisabled(?:\s|$)/.test(match[2])) attrs.disabled = '';
    element(attrs);
  }
  const description = element({ name: 'description' });
  const document = {
    title: '', documentElement: { lang: 'es' },
    getElementById(id) { assert(ids.has(id), `Unknown DOM id ${id}`); return ids.get(id); },
    querySelector(selector) { assert.equal(selector, 'meta[name="description"]'); return description; },
    querySelectorAll(selector) {
      assert(['[data-copy]', '[data-support-link]'].includes(selector), `Unsupported DOM selector ${selector}`);
      const key = selector.slice(1, -1);
      return elements.filter((node) => key in node.attrs);
    },
  };
  const location = {
    get href() { return current.href; },
    set href(value) { navigations.push(value); current = new URL(value, current); },
    get pathname() { return current.pathname; },
    get search() { return current.search; },
    get hash() { return current.hash; },
  };
  const auth = Object.fromEntries(['exchangeCodeForSession', 'setSession', 'verifyOtp', 'updateUser', 'signOut'].map((method) => [method, async (value) => {
    calls.push({ method, value: JSON.parse(JSON.stringify(value)) });
    if (options.handlers?.[method]) return options.handlers[method](value);
    if (method === 'updateUser' || method === 'signOut') return { error: null };
    if (options.invalid) return { data: { session: null }, error: { code: options.invalid, message: 'PROVIDER_PRIVATE_SENTINEL' } };
    if (options.nullSession) return { data: { session: null }, error: null };
    return { data: { session: { access_token: 'synthetic-only' } }, error: null };
  }]));
  const window = {
    location,
    history: { replaceState(_state, _title, path) { history.push(path); current = new URL(path, current); } },
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(type, fn) { windowListeners.set(type, fn); },
    ...(!options.noModule ? { supabase: { createClient(_url, _key, config) { calls.push({ method: 'createClient', config }); return { auth }; } } } : {}),
  };
  const context = vm.createContext({ window, document, URL, URLSearchParams });
  scripts.forEach((script, i) => vm.runInContext(script, context, { filename: `actual-bridge-script-${i}.js` }));
  return {
    calls, ids, document, window, history, timers, navigations, context, elements, description,
    status: () => ids.get('reset-status').textContent,
    methods: () => calls.map((c) => c.method),
    async submit(password = 'synthetic-password-1', confirmation = password) {
      ids.get('password').value = password; ids.get('confirm-password').value = confirmation;
      await ids.get('web-reset-form').dispatch('submit');
    },
    cancel: () => ids.get('cancel-button').dispatch('click'),
    async hide() { await windowListeners.get('pagehide')?.(); await Promise.resolve(); },
    fireTimers() { const pending = [...timers.values()]; timers.clear(); pending.forEach(({ fn }) => fn()); },
  };
}
function localizedAssertions(f, locale) {
  const c = dictionaries[locale].bridge;
  assert.equal(f.document.documentElement.lang, locale);
  assert.equal(f.document.title, c.pageTitle);
  assert.equal(f.description.attrs.content, c.pageDescription);
  for (const node of f.elements.filter((n) => n.dataset.copy && n.attrs.id !== 'reset-status')) assert.equal(node.textContent, c[node.dataset.copy]);
  assert.equal(f.ids.get('home-link').attrs['aria-label'], c.homeLabel);
  assert.equal(f.ids.get('legal-nav').attrs['aria-label'], c.navLabel);
  assert.equal(f.ids.get('password').attrs.placeholder, c.passwordPlaceholder);
  assert.equal(f.ids.get('confirm-password').attrs.placeholder, c.confirmPlaceholder);
  const legalSuffix = locale === 'en' ? '' : `-${locale === 'pt-PT' ? 'pt' : locale}`;
  assert.equal(f.ids.get('privacy-link').attrs.href, `privacy${legalSuffix}.html`);
  for (const node of f.elements.filter((n) => 'data-support-link' in n.attrs)) assert.equal(node.attrs.href, `support${legalSuffix}.html`);
  assert(existsSync(join(root, `privacy${legalSuffix}.html`)));
  assert(existsSync(join(root, `support${legalSuffix}.html`)));
}
function clearedAssertions(f) {
  assert.equal(f.ids.get('password').value, '');
  assert.equal(f.ids.get('confirm-password').value, '');
  assert.equal(f.timers.size, 0);
  for (const key of ['access_token', 'refresh_token', 'token_hash', 'code', 'error_description']) {
    assert(!f.window.location.href.includes(key));
    assert(!f.ids.get('open-app-link').attrs.href.includes(key));
    assert.equal(vm.runInContext(`authParams.has('${key}')`, f.context), false);
  }
}

for (const locale of locales) {
  const c = dictionaries[locale].bridge;
  const base = `${web}?lang=${locale}`;
  const payloads = [
    ['implicit', '#access_token=synthetic-access&refresh_token=synthetic-refresh&type=recovery&token_type=bearer', 'setSession'],
    ['pkce', '&code=synthetic-code', 'exchangeCodeForSession'],
    ['hash', '&token_hash=synthetic-hash&type=recovery', 'verifyOtp'],
  ];
  await test(`${locale}: localized DOM, safe handoff, no Auth on load`, () => {
    const f = fixture(`${base}&redirect_to=https://evil.invalid&email=not-forwarded${payloads[0][1]}`);
    localizedAssertions(f, locale);
    assert.deepEqual(f.methods(), []);
    assert.equal(f.status(), c.valid);
    assert.equal(f.history[0], `/babysteps-legal/reset-password.html?lang=${locale}`);
    const target = new URL(f.ids.get('open-app-link').attrs.href);
    assert.equal(target.protocol, 'babysteps:'); assert.equal(target.hostname, 'reset-password');
    assert.equal(target.searchParams.get('lang'), locale);
    assert(!target.searchParams.has('redirect_to')); assert(!target.searchParams.has('email'));
    assert.equal(f.timers.size, 1);
    f.fireTimers();
    assert.equal(f.navigations.length, 1); assert.equal(f.navigations[0], target.href);
  });
  for (const [kind, payload, method] of payloads) {
    await test(`${locale}: ${kind} success, global cleanup, no double-submit`, async () => {
      const f = fixture(base + payload);
      await f.submit();
      assert.deepEqual(f.methods(), ['createClient', method, 'updateUser', 'signOut']);
      assert.deepEqual(f.calls.at(-1).value, { scope: 'global' });
      assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0].config)), { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
      assert.equal(f.status(), c.success); assert.equal(f.ids.get('submit-button').textContent, c.updated);
      assert.equal(f.ids.get('submit-button').disabled, true);
      clearedAssertions(f);
      assert.equal(f.ids.get('open-app-link').attrs.href, 'babysteps://login?fromRecovery=1');
      const count = f.calls.length;
      await f.ids.get('web-reset-form').dispatch('submit'); await f.cancel(); f.fireTimers();
      assert.equal(f.calls.length, count); assert.equal(f.navigations.length, 0);
    });
    for (const reason of ['otp_expired', 'already_used', 'invalid_grant']) {
      await test(`${locale}: ${kind} rejects ${reason} without password update`, async () => {
        const f = fixture(base + payload, { invalid: reason });
        await f.submit();
        assert.deepEqual(f.methods(), ['createClient', method]);
        assert.equal(f.status(), c.invalid); assert(!f.status().includes('PROVIDER_PRIVATE_SENTINEL'));
        clearedAssertions(f);
        assert.equal(f.ids.get('submit-button').disabled, true);
      });
    }
  }
  await test(`${locale}: missing/malformed/provider error link is non-actionable`, async () => {
    for (const tail of ['', '&access_token=synthetic&type=recovery', '&token_hash=synthetic&type=signup', '&code=synthetic&type=signup', '&code=a&code=b', '&code=a#code=b', '&code=a&token_hash=b&type=recovery', '#error=access_denied&error_description=PROVIDER_PRIVATE_SENTINEL']) {
      const f = fixture(base + tail);
      assert.equal(f.status(), c.invalid);
      assert.equal(f.ids.get('submit-button').disabled, true);
      await f.submit(); f.fireTimers();
      assert.deepEqual(f.methods(), []); assert.equal(f.navigations.length, 0);
      assert(!f.ids.get('open-app-link').attrs.href.includes('PROVIDER_PRIVATE_SENTINEL'));
    }
  });
  await test(`${locale}: validation never consumes link; web interaction cancels auto-open`, async () => {
    const f = fixture(`${base}&code=synthetic-code`);
    await f.ids.get('web-action').dispatch('click');
    assert.equal(f.timers.size, 0);
    await f.submit('short'); assert.equal(f.status(), c.minLength); assert.deepEqual(f.methods(), []);
    await f.submit('long-enough-password', 'different-password'); assert.equal(f.status(), c.mismatch);
    assert.deepEqual(f.methods(), []); assert(f.ids.get('confirm-password').focused);
  });
  await test(`${locale}: cancel before Auth clears fields/timer/credentials without changing password`, async () => {
    const f = fixture(`${base}&code=synthetic-code`);
    f.ids.get('password').value = 'synthetic-password';
    await f.cancel(); await f.ids.get('web-reset-form').dispatch('submit'); f.fireTimers();
    assert.equal(f.status(), c.cancelled); assert.deepEqual(f.methods(), []); clearedAssertions(f);
  });
  await test(`${locale}: same-password retry reuses session and cancellation signs out locally`, async () => {
    const f = fixture(`${base}&code=synthetic-code`, { handlers: { updateUser: () => ({ error: { code: 'same_password', message: 'DO_NOT_DISPLAY' } }) } });
    await f.submit(); assert.equal(f.status(), c.samePassword); assert.equal(f.ids.get('submit-button').disabled, false);
    await f.submit(); assert.equal(f.methods().filter((m) => m === 'exchangeCodeForSession').length, 1);
    await f.cancel(); assert.equal(f.status(), c.cancelled);
    assert.deepEqual(f.calls.at(-1).value, { scope: 'local' }); clearedAssertions(f);
  });
  await test(`${locale}: module failure is localized without making Auth calls`, async () => {
    const f = fixture(`${base}&code=synthetic-code`, { noModule: true });
    await f.submit(); assert.equal(f.status(), c.moduleError); assert.deepEqual(f.methods(), []);
  });
  await test(`${locale}: session expiration on update clears locally, not globally`, async () => {
    const f = fixture(`${base}&code=synthetic-code`, { handlers: { updateUser: () => ({ error: { code: 'session_expired', message: 'DO_NOT_DISPLAY' } }) } });
    await f.submit(); assert.equal(f.status(), c.invalid);
    assert.deepEqual(f.calls.at(-1).value, { scope: 'local' }); clearedAssertions(f);
  });
}

await test('unsupported/missing/ambiguous locale -> Spanish (legacy 93 fallback)', () => {
  for (const locale of ['', 'de', 'pt-BR', 'pt', 'EN', 'en-US', '<script>', 'https://evil.invalid']) {
    const f = fixture(`${web}?code=synthetic&lang=${encodeURIComponent(locale)}`);
    localizedAssertions(f, 'es');
    assert.equal(f.status(), dictionaries.es.bridge.valid);
    assert.equal(new URL(f.ids.get('open-app-link').attrs.href).searchParams.get('lang'), 'es');
  }
  const f = fixture(`${web}?code=synthetic&lang=fr#lang=en`);
  assert.equal(f.document.documentElement.lang, 'es'); assert.equal(f.status(), dictionaries.es.bridge.invalid);
});
await test('foreign page origin never exchanges or forwards credentials', async () => {
  for (const url of ['https://evil.invalid/reset-password.html?code=synthetic', 'http://mabatista2010.github.io/babysteps-legal/reset-password.html?code=synthetic']) {
    const f = fixture(url); await f.submit(); assert.deepEqual(f.methods(), []); assert(!f.ids.get('open-app-link').attrs.href.includes('code=synthetic'));
  }
});
await test('null session is not treated as verification success', async () => {
  const f = fixture(`${web}?code=synthetic`, { nullSession: true }); await f.submit();
  assert.deepEqual(f.methods(), ['createClient', 'exchangeCodeForSession']);
  assert.equal(f.status(), dictionaries.es.bridge.invalid);
});
await test('in-flight update is atomic: double submit/cancel do not create another update', async () => {
  let resolveUpdate;
  const f = fixture(`${web}?code=synthetic`, { handlers: { updateUser: () => new Promise((resolve) => { resolveUpdate = resolve; }) } });
  const pending = f.submit();
  while (!resolveUpdate) await Promise.resolve();
  await f.ids.get('web-reset-form').dispatch('submit'); await f.cancel();
  assert.equal(f.calls.filter((c) => c.method === 'updateUser').length, 1);
  resolveUpdate({ error: null }); await pending;
  assert.equal(f.status(), dictionaries.es.bridge.success); clearedAssertions(f);
});
await test('leaving during verification never starts a password update after returning', async () => {
  let resolveSession;
  const f = fixture(`${web}?code=synthetic`, { handlers: { exchangeCodeForSession: () => new Promise((resolve) => { resolveSession = resolve; }) } });
  const pending = f.submit();
  while (!resolveSession) await Promise.resolve();
  await f.hide();
  resolveSession({ data: { session: { access_token: 'synthetic' } }, error: null });
  await pending;
  assert.equal(f.methods().includes('updateUser'), false);
  assert.deepEqual(f.calls.at(-1).value, { scope: 'local' });
  assert.equal(f.status(), dictionaries.es.bridge.cancelled); clearedAssertions(f);
});
await test('leaving during a submitted update cleans fields immediately and session globally on success', async () => {
  let resolveUpdate;
  const f = fixture(`${web}?code=synthetic`, { handlers: { updateUser: () => new Promise((resolve) => { resolveUpdate = resolve; }) } });
  const pending = f.submit();
  while (!resolveUpdate) await Promise.resolve();
  await f.hide(); clearedAssertions(f);
  resolveUpdate({ error: null }); await pending;
  assert.deepEqual(f.calls.at(-1).value, { scope: 'global' });
  assert.equal(f.status(), dictionaries.es.bridge.success);
});
await test('pagehide after a correctable error clears owned session locally', async () => {
  const f = fixture(`${web}?code=synthetic`, { handlers: { updateUser: () => ({ error: { code: 'same_password' } }) } });
  await f.submit(); await f.hide();
  assert.deepEqual(f.calls.at(-1).value, { scope: 'local' }); clearedAssertions(f);
});
await test('global sign-out failure triggers local cleanup; no remote revocation claim', async () => {
  let count = 0;
  const f = fixture(`${web}?code=synthetic`, { handlers: { signOut: () => ({ error: ++count === 1 ? { code: 'network_error' } : null }) } });
  await f.submit();
  assert.deepEqual(f.calls.filter((c) => c.method === 'signOut').map((c) => c.value.scope), ['global', 'local']);
  clearedAssertions(f);
});

// N2-R1: pagehide WHILE update is pending, then a late callback. Run every
// locale/outcome even on RED so the report distinguishes leakage from cleanup.
const lateUpdateReports = [];
const lateUpdateFailures = [];
for (const locale of locales) {
  for (const outcome of ['same_password', 'session_expired', 'success']) {
    const name = `${locale}: N2-R1 pagehide during pending update then ${outcome}`;
    try {
      await test(name, async () => {
        let resolveUpdate;
        const f = fixture(`${web}?code=synthetic-r1-code&lang=${locale}`, { handlers: {
          updateUser: () => new Promise((resolve) => { resolveUpdate = resolve; }),
        } });
        const pending = f.submit();
        while (!resolveUpdate) await Promise.resolve();
        assert.equal(vm.runInContext('sessionActive', f.context), true);
        assert.equal(vm.runInContext('busy', f.context), true);
        await f.hide();
        clearedAssertions(f);
        assert.equal(vm.runInContext('closed', f.context), true);
        resolveUpdate({ error: outcome === 'success' ? null : { code: outcome, message: 'DO_NOT_DISPLAY' } });
        await pending;
        const report = {
          locale, outcome,
          closed: vm.runInContext('closed', f.context),
          sessionActive: vm.runInContext('sessionActive', f.context),
          busy: vm.runInContext('busy', f.context),
          signOutScopes: f.calls.filter((c) => c.method === 'signOut').map((c) => c.value.scope),
          updateCalls: f.calls.filter((c) => c.method === 'updateUser').length,
          controlsDisabled: ['submit-button', 'cancel-button', 'password', 'confirm-password'].every((id) => f.ids.get(id).disabled),
        };
        lateUpdateReports.push(report);
        assert.equal(report.closed, true);
        assert.equal(report.sessionActive, false, 'N2-R1: abandoned attempt retained its session');
        assert.equal(report.busy, false);
        assert.equal(report.controlsDisabled, true, 'Late callback reopened a closed form');
        assert.deepEqual(report.signOutScopes, [outcome === 'success' ? 'global' : 'local']);
        assert.equal(report.updateCalls, 1);
        assert.equal(f.status(), dictionaries[locale].bridge[outcome === 'success' ? 'success' : 'invalid']);
        clearedAssertions(f);
        const callsAfterClose = f.calls.length;
        await f.ids.get('web-reset-form').dispatch('submit');
        await f.cancel(); await f.hide(); f.fireTimers();
        assert.equal(f.calls.length, callsAfterClose, 'Closed attempt retried update or cleanup');
        assert.equal(f.navigations.length, 0);
        clearedAssertions(f);
      });
    } catch (error) {
      lateUpdateFailures.push({ locale, outcome, error: error.message });
    }
  }
}
if (lateUpdateFailures.length) {
  console.error(JSON.stringify({ regression: 'N2-R1', cases: 15, passed: 15 - lateUpdateFailures.length, failed: lateUpdateFailures.length, observations: lateUpdateReports }, null, 2));
}
assert.deepEqual(lateUpdateFailures, [], 'N2-R1 late callback regression(s)');

// Restricted branch selection simulation, NOT Go html/template or SMTP rendering.
const proposal = JSON.parse(readFileSync(join(root, 'auth/recovery-config-proposal.json'), 'utf8'));
assert.deepEqual(Object.keys(proposal), ['mailer_subjects_recovery', 'mailer_templates_recovery_content']);
function selectBranch(template, redirect) {
  const pieces = template.split(/(\{\{ (?:if|else if) eq \.RedirectTo "[^"]+" \}\}|\{\{ else \}\}|\{\{ end \}\})/).filter(Boolean);
  assert.equal(pieces.at(-1).trim(), ''); // reviewed body file has trailing LF
  let selected = null;
  let matches = false;
  let branchCount = 0;
  for (let i = 0; i < pieces.length - 1; i += 2) {
    const token = pieces[i];
    if (token === '{{ end }}') break;
    const match = token.match(/^\{\{ (?:if|else if) eq \.RedirectTo "([^"]+)" \}\}$/);
    assert(match || token === '{{ else }}');
    const hit = match ? redirect === match[1] : !matches;
    matches ||= hit;
    if (hit && selected === null) selected = pieces[i + 1];
    branchCount++;
  }
  assert.equal(branchCount, 5); assert(selected);
  return selected;
}
const subjectSource = readFileSync(join(root, 'auth/recovery-subject.txt'), 'utf8');
const bodySource = readFileSync(join(root, 'auth/recovery-email.html'), 'utf8');
assert.equal(proposal.mailer_subjects_recovery, subjectSource.trim());
assert.equal(proposal.mailer_templates_recovery_content, bodySource);
assert(!/[\r\n]/.test(proposal.mailer_subjects_recovery));
function subjectWithinProviderBounds(value) {
  return typeof value === 'string' && value.trim().length > 0 &&
    !/[\r\n]/.test(value) && value.length <= 255 && Buffer.byteLength(value, 'utf8') <= 255;
}
await test('email global literal subject, CR/LF rejection and conservative raw255 boundaries', () => {
  const raw = proposal.mailer_subjects_recovery;
  assert.equal(raw, 'BabySteps');
  assert.equal(subjectSource, 'BabySteps\n');
  assert(subjectWithinProviderBounds(raw));
  assert(!/\{\{|\}\}/.test(raw));
  for (const size of [254, 255, 256]) assert.equal(subjectWithinProviderBounds('a'.repeat(size)), size <= 255);
  for (const value of ['', ' ', 'BabySteps\r', 'BabySteps\n', 'BabySteps\r\nBcc: synthetic@example.invalid']) assert.equal(subjectWithinProviderBounds(value), false);
  assert.equal(subjectWithinProviderBounds('é'.repeat(127)), true);
  assert.equal(subjectWithinProviderBounds('é'.repeat(128)), false);
  assert.equal(subjectWithinProviderBounds('😀'.repeat(63)), true);
  assert.equal(subjectWithinProviderBounds('😀'.repeat(64)), false);
});
for (const locale of locales) {
  await test(`${locale}: literal email subject/body locale branch and unchanged ConfirmationURL placeholder (static simulation)`, () => {
    const redirect = `${web}?lang=${locale}`;
    const subject = proposal.mailer_subjects_recovery;
    const body = selectBranch(bodySource, redirect);
    assert.equal(subject, 'BabySteps');
    assert(body.includes(`<html lang="${locale}">`));
    assert(body.includes(dictionaries[locale].email.subject)); // native body title remains localized
    assert(body.includes(dictionaries[locale].email.title));
    assert.equal((body.match(/\{\{ \.ConfirmationURL \}\}/g) || []).length, 1);
    assert(body.includes('href="{{ .ConfirmationURL }}"'));
    assert(!/\.Data|\.Email|\.TokenHash|\.Token\b|<script|<img/.test(body));
    assert(body.includes('mailto:support@babysteps.space'));
  });
}
await test('email missing/invalid/external/extra-query locale -> Spanish body, global brand subject, never arbitrary redirect', () => {
  for (const redirect of [web, '', `${web}?lang=de`, `${web}?lang=pt-BR`, `${web}?lang=fr&next=evil`, 'https://evil.invalid/?lang=fr']) {
    assert.equal(proposal.mailer_subjects_recovery, 'BabySteps');
    assert(selectBranch(bodySource, redirect).includes('<html lang="es">'));
  }
});
console.log(JSON.stringify({ result: 'PASS', groups: results.length, locales, lateUpdateReports, actualInlineScripts: true, dom: 'minimal deterministic mock; no layout claims', auth: 'synthetic only', email: 'restricted branch simulation; NOT Go/Supabase/SMTP', network: 'none', tests: results }, null, 2));
