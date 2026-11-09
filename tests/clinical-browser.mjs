// Real runtime -> local HTTP RPC -> isolated PostgreSQL. Auth/SMTP/Storage are not validated here.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createClinicalTestDatabase} from './clinical-database.mjs';
const tooling=process.env.PELLUM_TEST_TOOLS||path.resolve('tests/clinical/node_modules');
const {chromium}=await import(pathToFileURL(path.join(tooling,'playwright/index.mjs')).href);
const {build}=await import('../standalone/node_modules/esbuild/lib/main.js');
const {db,ids,rpc,login,snapshot}=await createClinicalTestDatabase();
await rpc('grant',{userId:ids.owner,professionalId:0,profession:'enfermagem',registry:'COREN-QA',write:true,export:true,enabled:true,requestId:randomUUID()});
const fixture={...snapshot,percent:100,expenses:[],products:[],records:[],appointments:[],patients:snapshot.patients.map(p=>({...p,phone:'',note:''}))};
const cloud={clinic:{id:ids.clinic,name:'Clínica fictícia de testes',role:'manager',owner_id:ids.owner},user:'owner@example.invalid',revision:0,is_admin:false,members:[],clinics:[{id:ids.clinic,name:'Clínica fictícia'}],data:fixture};
const entry=`
 import {installActions} from './standalone/src/actions.js';
 import {installInterface} from './standalone/src/interface.js';
 import {createClinicalService} from './standalone/src/clinical-service.js';
 import * as phone from './standalone/src/phone.js';
 import * as team from './standalone/src/team-model.js';
 import {clinicAlerts} from './standalone/src/clinic-alerts.js';
 installActions();installInterface();window.AURA_PHONE=phone;window.AURA_TEAM_MODEL=team;window.AURA_CLINIC_ALERTS=clinicAlerts;
 window.AURA_CLOUD=${JSON.stringify(cloud)};window.AURA_DATA=window.AURA_CLOUD.data;
 window.AURA_API=async()=>window.AURA_CLOUD;window.AURA_READY=()=>{};window.AURA_VERIFY_MFA=async()=>{};
 window.AURA_CLINICAL=createClinicalService({rpc:async(name,args)=>{const response=await fetch('/__rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)});return response.json()}},()=>window.AURA_CLOUD.clinic.id,async()=>{});
 window.AURA_CLINICAL.actorId=${JSON.stringify(ids.owner)};
 const script=document.createElement('script');script.src='/runtime.js';document.body.append(script);
`;
const bundled=await build({stdin:{contents:entry,resolveDir:process.cwd(),sourcefile:'clinical-test.js'},bundle:true,write:false,format:'iife',platform:'browser'});
let failure=null,deny=false,loseSave=false,conflictSave=false;const rpcActions=[];
const server=createServer(async(req,res)=>{
 try{
  if(req.method==='POST'&&req.url==='/__rpc'){
   let raw='';for await(const c of req){raw+=c;if(raw.length>100000)throw Error('Request too big')}
   const b=JSON.parse(raw);rpcActions.push(b.p_action);let data,error;
   if(deny)error={code:'42501',message:'Denied'};
   else if(conflictSave&&b.p_action==='save'){conflictSave=false;error={code:'40001',message:'CLINICAL_CONFLICT'}}
   else try{data=await rpc(b.p_action,b.p_body,b.p_patient,b.p_clinic)}catch(e){error={code:e.code,message:e.message}}
   if(loseSave&&b.p_action==='save'){loseSave=false;res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'Simulated response lost after commit'}}));return}
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data,error}));return;
  }
  if(req.url==='/main.js'){res.setHeader('Content-Type','text/javascript');res.end(bundled.outputFiles[0].text);return}
  const pathname=new URL(req.url,'http://localhost').pathname;
  const name=pathname==='/'?'index.html':pathname.slice(1);if(!/^[A-Za-z0-9_.-]+$/.test(name)){res.writeHead(404).end();return}
  const data=await readFile(path.join('standalone/dist',name));res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);
 }catch(e){failure=e;res.writeHead(500).end('QA failure')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,executablePath:process.env.PELLUM_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
await mkdir('.codex/clinical-qa',{recursive:true});
let checks=0;const errors=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.route('**/*',route=>{const url=new URL(route.request().url());return url.hostname==='127.0.0.1'?route.continue():route.abort()});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:'+server.address().port+'/#pacientes');
 const dialog=page.locator('#clinicalDialog');
 await page.locator('[data-clinical-patient="p1"]').click();await dialog.getByRole('button',{name:'＋ Anamnese',exact:true}).waitFor();checks++;
 await dialog.getByRole('button',{name:'＋ Anamnese',exact:true}).click();
 await dialog.locator('[name="summary"]').fill('Anamnese fictícia <script>window.PHI_LEAK=true</script>');
 await dialog.locator('[name="answer_allergy"]').selectOption('yes');
 await dialog.locator('[name="answer_allergy_detail"]').fill('Reação fictícia para QA');
 await dialog.locator('[name="answer_diabetes"]').selectOption('unknown');
 await dialog.getByRole('button',{name:'Salvar rascunho',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#clinicalMessage').textContent.startsWith('Salvo na nuvem'));checks++;
 await dialog.getByRole('button',{name:'Revisar e finalizar',exact:true}).click();await dialog.getByText('Informações declaradas para revisão profissional',{exact:true}).waitFor();checks++;
 assert.equal(await page.evaluate(()=>window.PHI_LEAK),undefined);checks++;
 await dialog.evaluate(el=>el.scrollTop=0);await page.screenshot({path:'.codex/clinical-qa/mobile-timeline.png',fullPage:true});
 await dialog.getByRole('button',{name:'Adicionar adendo',exact:true}).click();await dialog.locator('[name="summary"]').fill('Adendo fictício');await dialog.locator('[name="reason"]').fill('Complementação para QA');await dialog.getByRole('button',{name:'Salvar adendo',exact:true}).click();await dialog.getByRole('button',{name:'Versões',exact:true}).click();await dialog.getByText('Motivo do adendo:',{exact:false}).waitFor();checks++;
 assert.equal((await rpc('history',{id:(await rpc('list'))[0].id})).length,3);checks++;
 await dialog.getByRole('button',{name:'Voltar ao prontuário',exact:true}).click();
 await dialog.getByRole('button',{name:'Modelos de anamnese',exact:true}).click();await dialog.locator('[name="name"]').fill('Modelo fictício da clínica');await dialog.locator('[data-label]').fill('Pergunta de referência fictícia');await dialog.locator('[data-required]').check();await dialog.getByRole('button',{name:'Salvar modelo',exact:true}).click();await dialog.getByRole('button',{name:'＋ Anamnese',exact:true}).waitFor();checks++;
 await dialog.getByRole('button',{name:'Modelos de anamnese',exact:true}).click();await dialog.getByRole('button',{name:'Editar modelo: Modelo fictício da clínica · v1',exact:true}).click();await dialog.locator('[data-label]').fill('Pergunta fictícia revisada');await dialog.getByRole('button',{name:'Salvar modelo',exact:true}).click();await dialog.getByRole('button',{name:'＋ Anamnese',exact:true}).waitFor();assert.equal((await rpc('templates'))[0].version,2);checks++;
 await dialog.getByRole('button',{name:'＋ Anamnese',exact:true}).click();await dialog.locator('[name="templateChoice"]').selectOption('0');await dialog.locator('[name="summary"]').fill('Segunda anamnese fictícia com resposta obrigatória ainda em branco');
 loseSave=true;await dialog.getByRole('button',{name:'Salvar rascunho',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#clinicalMessage').textContent.includes('Não foi possível'));checks++;
 await dialog.getByRole('button',{name:'Salvar rascunho',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#clinicalMessage').textContent.startsWith('Salvo na nuvem'));checks++;
 await dialog.getByRole('button',{name:'Voltar',exact:true}).click();await dialog.getByRole('button',{name:'＋ Plano de tratamento',exact:true}).waitFor();
 for(const kind of ['＋ Avaliação','＋ Plano de tratamento','＋ Procedimento realizado','＋ Evolução','＋ Intercorrência','＋ Minuta de termo']){
  await dialog.getByRole('button',{name:kind,exact:true}).click();await dialog.locator('[name="summary"]').fill('Registro fictício: '+kind);await dialog.getByRole('button',{name:'Salvar rascunho',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#clinicalMessage').textContent.startsWith('Salvo na nuvem'));await dialog.getByRole('button',{name:'Voltar',exact:true}).click();await dialog.getByRole('button',{name:kind,exact:true}).waitFor();checks++;
 }
 await page.setViewportSize({width:1280,height:900});await dialog.evaluate(el=>el.scrollTop=0);await page.screenshot({path:'.codex/clinical-qa/desktop-timeline.png',fullPage:true});
 const overflow=await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1);assert.equal(overflow,false);checks++;
 await dialog.getByRole('button',{name:'Continuar rascunho',exact:true}).first().click();await dialog.locator('[name="summary"]').fill('Rascunho fictício mantido após conflito');conflictSave=true;await dialog.getByRole('button',{name:'Salvar rascunho',exact:true}).click();await dialog.locator('#clinicalConflict').waitFor();assert.equal(await dialog.locator('[name="summary"]').inputValue(),'Rascunho fictício mantido após conflito');checks++;
 await dialog.getByRole('button',{name:'Consultar histórico sem descartar rascunho',exact:true}).click();await dialog.locator('[data-conflict-history] .clinical-entry').first().waitFor();assert.equal(await dialog.getByRole('button',{name:'Salvar rascunho',exact:true}).isDisabled(),true);checks++;
 await login('owner','aal2');const draftDownloadPromise=page.waitForEvent('download');await dialog.getByRole('button',{name:'Exportar rascunho não confirmado',exact:true}).click();const draftDownload=await draftDownloadPromise;const draftExport=JSON.parse(await readFile(await draftDownload.path(),'utf8'));assert.equal(draftExport.unconfirmed,true);assert.equal(draftExport.payload.summary,'Rascunho fictício mantido após conflito');checks++;
 await dialog.getByRole('button',{name:'Voltar',exact:true}).click();await dialog.getByRole('button',{name:'Exportar documento clínico',exact:true}).waitFor();
 await login('owner','aal2');const downloadPromise=page.waitForEvent('download');await dialog.getByRole('button',{name:'Exportar documento clínico',exact:true}).click();const download=await downloadPromise;const exported=await readFile(await download.path(),'utf8');assert.equal(exported.includes('<script>'),false);assert.equal(exported.includes('sem assinatura digital validada'),true);checks++;
 await dialog.getByRole('button',{name:'Fechar prontuário',exact:true}).click();
 await page.locator('[data-clinical-patient="p2"]').click();await dialog.getByText(/Acesso clínico não autorizado/).waitFor();checks++;
 await dialog.getByRole('button',{name:'Fechar prontuário',exact:true}).click();
 deny=true;await page.locator('[data-clinical-patient="p1"]').click();await dialog.getByText(/Acesso clínico não autorizado/).waitFor();checks++;
 assert.equal(await dialog.locator('.clinical-entry').count(),0);checks++;
 assert.deepEqual(errors,[]);assert.equal(failure,null);checks++;
 const stored=await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}));assert.equal(stored.includes('Anamnese fictícia'),false);checks++;
 console.log(`PASS: ${checks} clinical browser checks, mobile/desktop, real local RPC/PostgreSQL, conditional questionnaire, versions/addendum, template, all record sections, network retry, denied access, XSS and no clinical browser storage. Auth and remote services not tested.`);
}catch(e){for(const p of browser.contexts().flatMap(c=>c.pages()))console.error('QA status:',await p.locator('#clinicalMessage').textContent(),'Actions:',rpcActions.join(','),'Browser errors:',errors);throw e}
finally{await browser.close();await new Promise(resolve=>server.close(resolve));await db.close()}
