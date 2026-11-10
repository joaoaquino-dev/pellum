// Browser -> local HTTP -> all repository SQL. Auth/SMTP are synthetic fixtures.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createFullSchemaFixture} from './clinical/full-schema-fixture.mjs';
const {chromium}=await import(pathToFileURL(path.resolve(process.env.PELLUM_TEST_TOOLS||'tests/clinical/node_modules','playwright/index.mjs')).href);
const {build}=await import('../standalone/node_modules/esbuild/lib/main.js');
const {db,accounts,login,rpc}=await createFullSchemaFixture();
let browser,server,checks=0,loseSave=false;const errors=[],actions=[];
const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
try{
 await db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified')",[accounts.solo_a.user]);
 await login('administrator','aal2');await rpc('aura_admin_rpc',['authorize',JSON.stringify({email:accounts.solo_a.email,max_clinics:1})]);
 await login('solo_a','aal2');const {id:clinic}=await rpc('aura_rpc',['create',null,JSON.stringify({name:'QA fluxos fictícios',requestId:randomUUID()})]);
 const call=async body=>{await login('solo_a','aal2');const {action='get',...rest}=body;if(action!=='get'&&!rest.requestId)rest.requestId=randomUUID();return rpc('aura_rpc',[action,clinic,JSON.stringify(rest)])};
 const cloud=await call({});cloud.clinic.owner_id=accounts.solo_a.user;
 const entry=`import {installActions} from './standalone/src/actions.js';import {installInterface} from './standalone/src/interface.js';import * as phone from './standalone/src/phone.js';import * as team from './standalone/src/team-model.js';import {clinicAlerts} from './standalone/src/clinic-alerts.js';installActions();installInterface();window.AURA_PHONE=phone;window.AURA_TEAM_MODEL=team;window.AURA_CLINIC_ALERTS=clinicAlerts;window.AURA_CLOUD=${JSON.stringify(cloud)};window.AURA_DATA=window.AURA_CLOUD.data;window.AURA_READY=()=>{};window.AURA_VERIFY_MFA=async()=>{};window.AURA_API=async(body={})=>{const r=await fetch('/__business',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),v=await r.json();if(v.error)throw Object.assign(Error(v.error.message),{code:v.error.code});return v.data};const script=document.createElement('script');script.src='/runtime.js';document.body.append(script);`;
 const bundle=(await build({stdin:{contents:entry,resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser'})).outputFiles[0].text;
 server=createServer(async(req,res)=>{try{
  if(req.url==='/__business'){
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1000000)throw Error('QA body limit')}
   const body=JSON.parse(raw);actions.push(body.action||'get');let data,error;
   try{data=await call(body);if(loseSave&&body.action==='save'){loseSave=false;throw Object.assign(Error('Resposta perdida após salvar.'),{code:'NETWORK'})}}catch(e){error={code:e.code,message:e.message}}
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data,error}));return;
  }
  if(req.url==='/main.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle);return}
  const name=req.url==='/'?'index.html':req.url.slice(1);if(!/^[A-Za-z0-9_.-]+$/.test(name)){res.writeHead(404).end();return}
  const bytes=await readFile(path.join('standalone/dist',name));res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(bytes);
 }catch{res.writeHead(500).end('Local QA failure')}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,executablePath:process.env.PELLUM_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
 await page.addInitScript(id=>localStorage.setItem('pellum-start-'+id,JSON.stringify({step:0,seen:true})),clinic);
 await page.goto('http://127.0.0.1:'+server.address().port+'/#pacientes');
 const go=async section=>{await page.locator('#nav a[href="#'+section+'"]').click();await page.waitForFunction(s=>location.hash==='#'+s,section)};
 const synced=()=>page.waitForFunction(()=>{const s=window.AURA_CLINIC_SYNC?.();return s&&s.pending===0&&!s.blocked});
 const snapshot=async()=>(await call({})).data;
 await page.getByRole('button',{name:'＋ Nova paciente',exact:true}).click();
 await page.locator('#patientform [name="name"]').fill('Paciente fictícia fluxo');await page.locator('#patientform [name="phone"]').fill('11987654321');
 await page.locator('#patientform button[type="submit"], #patientform button:not([type])').click();await synced();
 let saved=await snapshot();eq(saved.patients.length,1);const patient=saved.patients[0];eq(patient.name,'Paciente fictícia fluxo');
 await go('agenda');await page.getByRole('button',{name:'＋ Agendar',exact:true}).click();
 await page.locator('#appointmentform [name="date"]').fill('2026-12-10');await page.locator('#appointmentform [name="time"]').fill('10:00');await page.locator('#appointmentform button').last().click();await synced();
 saved=await snapshot();eq(saved.appointments.length,1);eq(saved.appointments[0].patient,patient.id);
 await page.getByRole('button',{name:'＋ Agendar',exact:true}).click();await page.locator('#appointmentform [name="date"]').fill('2026-12-10');await page.locator('#appointmentform [name="time"]').fill('10:30');await page.locator('#appointmentform button').last().click();
 await page.getByText('Essa profissional já tem um atendimento nesse horário.',{exact:true}).waitFor();eq((await snapshot()).appointments.length,1);await page.locator('#appointmentform button').first().click();
 await go('estoque');await page.getByRole('button',{name:/Cadastrar produto/}).click();const supply=page.locator('#supplyForm');
 for(const [name,value] of Object.entries({name:'Insumo fictício',quantity:'100',price:'900',packCount:'1',lot:'QA-LOTE'}))await supply.locator('[name="'+name+'"]').fill(value);
 await supply.getByRole('button',{name:'Salvar item',exact:true}).click();await synced();saved=await snapshot();eq(saved.products[0].balance,100);eq(saved.products[0].price/saved.products[0].quantity,9);
 await go('calcular');await page.locator('#price').fill('1000');await page.locator('#discount').fill('100');await page.locator('#fee').fill('2');
 await page.locator('#consumeProduct').selectOption(saved.products[0].id);await page.locator('#consumeQty').fill('40');await page.getByRole('button',{name:'Adicionar produto ao cálculo',exact:true}).click();eq(await page.locator('#cost1').inputValue(),'360.00');
 await page.locator('#calcform button[type="submit"]').click();await page.locator('#cloudRecord [name="received"]').fill('200');await page.locator('#cloudRecord [name="installments"]').fill('3');await page.locator('#cloudRecord [name="due"]').fill('2026-12-10');await page.getByRole('button',{name:'Salvar atendimento',exact:true}).click();await synced();
 saved=await snapshot();eq(saved.records.length,1);eq(saved.products[0].balance,60);eq(saved.products[0].movements.length,1);eq(saved.products[0].movements[0].qty,-40);eq(saved.records[0].cost1,360);eq(saved.records[0].received,200);eq(saved.records[0].materials[0].owner,0);eq(saved.records[0].schedule.length,3);
 const record=saved.records[0];eq(Math.round(record.schedule.reduce((sum,item)=>sum+item.value,0)*100),70000);
 await go('financeiro');await page.locator('#financeContent').getByRole('button',{name:'Editar',exact:true}).click();
 const beforeInvalid=actions.filter(a=>a==='save').length;await page.locator('#cloudRecord [name="cost1"]').fill('350');await page.getByRole('button',{name:'Salvar atendimento',exact:true}).click();await page.getByText('O custo informado não pode ser menor que os materiais já registrados neste atendimento.',{exact:true}).waitFor();eq(actions.filter(a=>a==='save').length,beforeInvalid);eq(await page.evaluate(()=>window.AURA_CLINIC_SYNC().blocked),false);
 await page.locator('#cloudRecord [name="cost1"]').fill('370');await page.getByRole('button',{name:'Salvar atendimento',exact:true}).click();await synced();
 saved=await snapshot();eq(saved.records[0].cost1,370);eq(saved.products[0].balance,60);eq(saved.products[0].movements.length,1);eq(saved.records[0].materials[0].cost,360);
 await go('estoque');await page.locator('#app').getByRole('button',{name:'Editar',exact:true}).click();eq(await page.locator('#supplyForm [name="price"]').isDisabled(),true);await page.locator('#supplyCancel').click();
 await go('calcular');eq(await page.locator('#cost1').inputValue(),'0');eq(await page.locator('#consumptionList').innerText(),'');
 await go('despesas');await page.getByRole('button',{name:/Nova despesa/}).click();await page.locator('#expenseForm [name="name"]').fill('Despesa fictícia');await page.locator('#expenseForm [name="value"]').fill('123.45');await page.locator('#expenseForm button').last().click();await synced();eq((await snapshot()).expenses[0].value,123.45);
 // Inverted professional order: materials belong to roster ID 0, which now
 // occupies calculation slot 2. Switching professionals clears the same draft.
 await go('config');await page.locator('#teamAdd').click();await synced();await page.locator('#settingsform [name="professional-1"]').fill('Segunda QA');await page.getByRole('button',{name:'Salvar nomes e regra padrão',exact:true}).click();await synced();
 await go('calcular');await page.locator('#professional1').selectOption('1');await page.locator('#professional2').selectOption('0');await page.locator('#consumeProduct').selectOption(saved.products[0].id);await page.locator('#consumeQty').fill('5');await page.getByRole('button',{name:'Adicionar produto ao cálculo',exact:true}).click();eq(await page.locator('#cost2').inputValue(),'45.00');
 await page.locator('#professional1').selectOption('0');eq(await page.locator('#consumptionList').innerText(),'');eq(await page.locator('#cost1').inputValue(),'0');
 await page.locator('#professional1').selectOption('1');await page.locator('#professional2').selectOption('0');await page.getByRole('button',{name:'Adicionar produto ao cálculo',exact:true}).click();await page.locator('#price').fill('300');await page.locator('#discount').fill('0');await page.locator('#fee').fill('0');await page.locator('#calcform button[type="submit"]').click();await page.getByRole('button',{name:'Salvar atendimento',exact:true}).click();await synced();
 saved=await snapshot();eq(saved.records.length,2);eq(saved.records[1].professionalIds,[1,0]);eq(saved.records[1].cost1,0);eq(saved.records[1].cost2,45);eq(saved.records[1].materials.length,1);eq(saved.records[1].materials[0].owner,0);eq(saved.products[0].balance,55);eq(saved.products[0].movements.length,2);
 await go('config');await page.locator('#clinicManagementScope').waitFor();eq(await page.locator('#clinicManagementScope').isVisible(),true);const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar backup',exact:true}).click();const download=await downloadPromise;const exported=JSON.parse(await readFile(await download.path(),'utf8'));eq(exported.records[0].id,record.id);eq(actions.includes('export'),true);
 // A response lost after commit must pause the queue, retain the draft and
 // offer an export; never silently retry a different snapshot or overwrite.
 await go('pacientes');loseSave=true;await page.getByRole('button',{name:'＋ Nova paciente',exact:true}).click();await page.locator('#patientform [name="name"]').fill('Resposta perdida fictícia');await page.locator('#patientform button').last().click();await page.getByRole('heading',{name:'Não foi possível sincronizar',exact:true}).waitFor();
 eq((await snapshot()).patients.length,2);eq(await page.evaluate(()=>window.AURA_CLINIC_SYNC().blocked),true);
 const before=actions.filter(a=>a==='save').length;await page.locator('#modal').evaluate(el=>el.close());await go('despesas');await page.getByRole('button',{name:/Nova despesa/}).click();await page.locator('#expenseForm [name="name"]').fill('Rascunho não enviado');await page.locator('#expenseForm [name="value"]').fill('1');await page.locator('#expenseForm button').last().click();eq(actions.filter(a=>a==='save').length,before);eq((await snapshot()).expenses.length,1);
 eq(errors,[]);eq(await page.locator('#app').evaluate(el=>el.scrollWidth>el.clientWidth+2),false);
 console.log(`PASS: ${checks} business browser checks; real local SQL snapshots, patient, appointment/conflict, stock, consumption, installment rounding, expense, authorized export and interrupted-save pause. Auth/SMTP/services and physical mobile devices not validated.`);
}catch(error){console.error('Browser QA errors:',errors);for(const page of browser?.contexts().flatMap(c=>c.pages())||[])console.error('QA screen:',(await page.locator('body').innerText()).slice(0,2200));throw error}
finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await db.close()}
