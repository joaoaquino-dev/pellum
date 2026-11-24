// End-to-end browser + real PostgreSQL schema test for multi-procedure appointments,
// Agenda -> Precificação shortcut, WhatsApp confirmation link, and Financeiro recoverable deletion.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createFullSchemaFixture } from './clinical/full-schema-fixture.mjs';

const { chromium } = await import(pathToFileURL(path.resolve(process.env.PELLUM_TEST_TOOLS || 'tests/clinical/node_modules', 'playwright/index.mjs')).href);
const { build } = await import('../standalone/node_modules/esbuild/lib/main.js');
const { db, accounts, login, rpc } = await createFullSchemaFixture();

let browser, server, checks = 0;
const errors = [];
const eq = (a, b) => { assert.deepEqual(a, b); checks++; };
const browserPath = process.env.PELLUM_BROWSER || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : 'C:/Program Files/Google/Chrome/Application/chrome.exe');

try {
 await db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified')", [accounts.solo_a.user]);
 await login('administrator', 'aal2');
 await rpc('aura_admin_rpc', ['authorize', JSON.stringify({ email: accounts.solo_a.email, max_clinics: 1 })]);
 await login('solo_a', 'aal2');
 const { id: clinic } = await rpc('aura_rpc', ['create', null, JSON.stringify({ name: 'Clínica QA Fluxo Completo', requestId: randomUUID() })]);

 const call = async body => {
  await login('solo_a', 'aal2');
  const { action = 'get', ...rest } = body;
  if (action !== 'get' && !rest.requestId) rest.requestId = randomUUID();
  return rpc('aura_rpc', [action, clinic, JSON.stringify(rest)]);
 };

 const cloud = await call({});
 cloud.clinic.owner_id = accounts.solo_a.user;
 const entry = `import {installActions} from './standalone/src/actions.js';import {installInterface} from './standalone/src/interface.js';import * as phone from './standalone/src/phone.js';import * as team from './standalone/src/team-model.js';import * as batchRecords from './standalone/src/batch-records.js';import {clinicAlerts} from './standalone/src/clinic-alerts.js';installActions();installInterface();window.AURA_PHONE=phone;window.AURA_TEAM_MODEL=team;window.AURA_BATCH_RECORDS=batchRecords;window.AURA_CLINIC_ALERTS=clinicAlerts;window.AURA_CLOUD=${JSON.stringify(cloud)};window.AURA_DATA=window.AURA_CLOUD.data;window.AURA_READY=()=>{};window.AURA_VERIFY_MFA=async()=>{};window.AURA_API=async(body={})=>{const r=await fetch('/__business',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),v=await r.json();if(v.error)throw Object.assign(Error(v.error.message),{code:v.error.code});return v.data};const script=document.createElement('script');script.src='/runtime.js';document.body.append(script);`;
 const bundle = (await build({ stdin: { contents: entry, resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', platform: 'browser' })).outputFiles[0].text;

 server = createServer(async (req, res) => {
  try {
   if (req.url === '/__business') {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 1000000) throw Error('QA body limit'); }
    const body = JSON.parse(raw);
    let data, error;
    try { data = await call(body); } catch (e) { error = { code: e.code, message: e.message }; }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data, error }));
    return;
   }
   if (req.url === '/main.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle); return; }
   const name = req.url === '/' ? 'index.html' : req.url.slice(1);
   if (!/^[A-Za-z0-9_.-]+$/.test(name)) { res.writeHead(404).end(); return; }
   const bytes = await readFile(path.join('standalone/dist', name));
   res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html');
   res.end(bytes);
  } catch {
   res.writeHead(500).end('Local QA failure');
  }
 });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

 browser = await chromium.launch({ headless: true, executablePath: browserPath });
 const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
 await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
 const page = await context.newPage();
 page.on('pageerror', err => errors.push(err.message));
 page.on('dialog', dialog => dialog.accept());
 await page.addInitScript(id => localStorage.setItem('pellum-start-' + id, JSON.stringify({ step: 0, seen: true })), clinic);
 await page.goto('http://127.0.0.1:' + server.address().port + '/#pacientes');

 const go = async section => { await page.locator('#nav a[href="#' + section + '"]').click(); await page.waitForFunction(s => location.hash === '#' + s, section); };
 const synced = () => page.waitForFunction(() => { const s = window.AURA_CLINIC_SYNC?.(); return s && s.pending === 0 && !s.blocked; });
 const snapshot = async () => (await call({})).data;

 // 1. Create patient with valid phone
 await page.getByRole('button', { name: '＋ Nova paciente', exact: true }).click();
 await page.locator('#patientform [name="name"]').fill('Marina Costa');
 await page.locator('#patientform [name="phone"]').fill('61999998888');
 await page.locator('#patientform button').last().click();
 await synced();
 let saved = await snapshot();
 eq(saved.patients.length, 1);

 // 2. Schedule multi-procedure appointment in Agenda
 await go('agenda');
 await page.getByRole('button', { name: '＋ Agendar', exact: true }).click();
 await page.locator('#agendaProcPicker').selectOption('Toxina botulínica');
 await page.locator('#agendaProcAdd').click();
 await page.locator('#agendaProcPicker').selectOption('Skinbooster');
 await page.locator('#agendaProcAdd').click();
 await page.locator('#appointmentform [name="date"]').fill('2026-12-15');
 await page.locator('#appointmentform [name="time"]').fill('14:30');
 await page.locator('#appointmentform [name="duration"]').fill('90');
 // Verify #appointmentform button.first() is still Cancelar and .last() is Agendar
 eq(await page.locator('#appointmentform button').first().innerText(), 'Cancelar');
 await page.locator('#appointmentform button').last().click();
 await synced();
 saved = await snapshot();
 eq(saved.appointments.length, 1);
 eq(saved.appointments[0].procedure, 'Toxina botulínica + Skinbooster');

 // 3. Verify WhatsApp confirmation button on Agenda card
 const waLink = page.locator('#agendaList a', { hasText: 'Confirmar WhatsApp' });
 eq(await waLink.isVisible(), true);
 const href = await waLink.getAttribute('href');
 assert.ok(href.startsWith('https://wa.me/5561999998888?text='));
 assert.match(decodeURIComponent(href), /Olá, Marina!/);
 assert.match(decodeURIComponent(href), /15\/12\/2026 às 14:30/);
 checks++;

 // Check mobile/tablet/desktop no overflow on Agenda
 for (const vp of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1366, height: 900 }]) {
  await page.setViewportSize(vp);
  eq(await page.locator('#app').evaluate(el => el.scrollWidth > el.clientWidth + 2), false);
 }
 await page.setViewportSize({ width: 390, height: 844 });

 // 4. Click "Lançar valores" on Agenda card -> jumps to #calcular pre-filled
 await page.locator('#agendaList').getByRole('button', { name: 'Lançar valores' }).click();
 await page.waitForFunction(() => location.hash === '#calcular');
 eq(await page.locator('#procedure').inputValue(), 'Toxina botulínica');
 await page.locator('#price').fill('1200');
 await page.locator('#addBatchProcedure').click();
 // Automatically advances to 2nd procedure ("Skinbooster")
 eq(await page.locator('#procedure').inputValue(), 'Skinbooster');
 await page.locator('#price').fill('800');
 await page.locator('#calcform button[type="submit"]').click();

 // Batch modal pre-filled with Marina Costa and 2026-12-15
 eq(await page.locator('#batchRecordForm [name="patient"]').inputValue(), saved.patients[0].id);
 eq(await page.locator('#batchRecordForm [name="date"]').inputValue(), '2026-12-15');
 await page.locator('#batchRecordForm [name="received"]').fill('500');
 await page.locator('#batchRecordForm [name="installments"]').fill('2');
 await page.locator('#batchRecordForm button[type="submit"]').click();
 await synced();

 saved = await snapshot();
 eq(saved.records.length, 2);
 eq(saved.records[0].procedure, 'Toxina botulínica');
 eq(saved.records[1].procedure, 'Skinbooster');
 eq(Math.round((saved.records[0].received + saved.records[1].received) * 100), 50000);
 // Appointment automatically marked as Atendido!
 eq(saved.appointments[0].status, 'Atendido');

 // 5. Go to Financeiro -> exclude one record and restore it
 await go('financeiro');
 await page.locator('#financeMonth').fill('2026-12');
 await page.locator('#financeMonth').dispatchEvent('change');
 eq(await page.locator('#financeContent tbody tr').count(), 2);

 await page.locator('#financeContent tbody tr').nth(1).getByRole('button', { name: /Excluir/ }).click();
 await page.locator('#confirmRecordDelete').click();
 await synced();

 saved = await snapshot();
 eq(saved.records.length, 2);
 eq(saved.records[1].deleted, true);
 eq(await page.locator('#financeContent tbody tr').count(), 1);

 // Toggle "Mostrar atendimentos excluídos" and restore
 await page.locator('#showDeletedRecords').check();
 eq(await page.locator('#financeContent tbody tr').count(), 1);
 await page.locator('#financeContent tbody tr').first().getByRole('button', { name: /Restaurar/ }).click();
 await synced();

 saved = await snapshot();
 eq(saved.records[1].deleted, false);
 await page.locator('#showDeletedRecords').uncheck();
 eq(await page.locator('#financeContent tbody tr').count(), 2);

 eq(errors, []);
 eq(await page.locator('#app').evaluate(el => el.scrollWidth > el.clientWidth + 2), false);
 console.log(`PASS: ${checks} end-to-end checks for multi-procedure Agenda, WhatsApp confirmation, Lançar valores flow, and Financeiro recoverable deletion.`);
} catch (error) {
 console.error('Browser QA errors:', errors);
 for (const p of browser?.contexts().flatMap(c => c.pages()) || []) {
  console.error('QA screen:', (await p.locator('body').innerText()).slice(0, 2200));
 }
 throw error;
} finally {
 await browser?.close();
 if (server) await new Promise(resolve => server.close(resolve));
 await db.close();
}
