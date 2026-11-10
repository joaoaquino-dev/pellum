// Real main/runtime/SQL. Initial Auth session is an explicit SDK double.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../standalone/node_modules/esbuild/lib/main.js';
import {createStockFixture} from './clinical/stock-fixture.mjs';
const {chromium}=await import(pathToFileURL(path.resolve('tests/clinical/node_modules/playwright/index.mjs')).href);
const {db,accounts,clinic,login,rpc,procedure,snapshot,clinical}=await createStockFixture();let browser,server,checks=0,loseResponse=false,confirmations=0,mediaRequests=0,cancelDialog=false,loseSchedule=true;const errors=[],consumptions=[],scheduleRequests=[];
const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
try{
 const entry=await procedure();
 const stub=`export function createClient(){return {auth:{getSession:async()=>({data:{session:{user:{id:${JSON.stringify(accounts.owner.user)},email:${JSON.stringify(accounts.owner.email)}}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{const response=await fetch('/__stock-rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})});return response.json()}}}`;
 const compiled=(await build({entryPoints:['standalone/src/main.js'],bundle:true,write:false,format:'iife',platform:'browser',define:{AURA_DEPLOY_ENV:'"staging"',AURA_SUPABASE_URL:'"https://qa.example.invalid"',AURA_SUPABASE_KEY:'"sb_publishable_fictitious"'},plugins:[{name:'explicit-auth-double',setup(b){b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'stub',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:stub,loader:'js'}))}}]})).outputFiles[0].text;
 server=createServer(async(req,res)=>{try{
  if(req.url==='/__stock-rpc'){
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1000000)throw Error('Body limit')}
   const {name,args}=JSON.parse(raw);let data,error;
   try{
    if(!['aura_rpc','aura_clinical_rpc','aura_clinical_stock_rpc','aura_clinical_form_template_rpc','aura_clinical_followup_rpc'].includes(name))throw Error('Unsupported QA RPC');
    await login('owner','aal2');data=await rpc(name,name==='aura_rpc'?[args.p_action,args.p_clinic,JSON.stringify(args.p_body)]:[args.p_action,args.p_clinic,args.p_patient,JSON.stringify(args.p_body)]);
    if(name==='aura_clinical_followup_rpc'&&args.p_action==='schedule'){scheduleRequests.push(args.p_body);if(loseSchedule){loseSchedule=false;throw Object.assign(Error('Lost schedule response after commit'),{code:'NETWORK'})}}
    if(name==='aura_clinical_stock_rpc'&&args.p_action==='consume'){consumptions.push(args.p_body);if(loseResponse){loseResponse=false;throw Object.assign(Error('Response lost after commit'),{code:'NETWORK'})}}
   }catch(e){error={code:e.code,message:e.message}}
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data,error}));return;
  }
  if(req.url==='/main.js'){res.setHeader('Content-Type','text/javascript');res.end(compiled);return}
  const name=req.url==='/'?'index.html':req.url.slice(1);if(!/^[A-Za-z0-9_.-]+$/.test(name)){res.writeHead(404).end();return}
  res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(await readFile(path.join('standalone/dist',name)));
 }catch{res.writeHead(500).end('Local QA failure')}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.PELLUM_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>{confirmations++;if(cancelDialog){cancelDialog=false;dialog.dismiss()}else dialog.accept()});
 page.on('request',request=>{if(request.url().includes('/api/clinical-media'))mediaRequests++});
 await page.goto(origin+'/#pacientes');await page.locator('[data-clinical-patient="patient-qa"]').click();const dialog=page.locator('#clinicalDialog');
 await dialog.getByRole('button',{name:'＋ Evolução',exact:true}).click();await dialog.locator('[name="summary"]').fill('Evolução com retorno previsto');await dialog.locator('[name="returnDate"]').fill('2099-01-10');eq(await dialog.locator('[name="returnDate"]').getAttribute('max'),null);await dialog.getByRole('button',{name:'Revisar e finalizar',exact:true}).click();await dialog.getByRole('button',{name:'Retornos',exact:true}).waitFor();
 eq((await snapshot()).data.appointments.length,0);await dialog.getByRole('button',{name:'Retornos',exact:true}).click();await dialog.getByText('Retorno previsto: 10/01/2099',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Agendar retorno',exact:true}).click();const form=dialog.locator('#clinicalFollowupForm');await form.waitFor();eq(await form.locator('[name="date"]').inputValue(),'2099-01-10');eq(await form.locator('[name="professionalId"]').inputValue(),'0');
 await mkdir('.codex/clinical-qa',{recursive:true});for(const viewport of [{width:390,height:844},{width:820,height:1180},{width:1366,height:900}]){await page.setViewportSize(viewport);eq(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);await dialog.evaluate(el=>el.scrollTop=0);}await page.setViewportSize({width:390,height:844});
 await form.locator('[name="time"]').fill('10:00');await form.getByRole('button',{name:'Salvar retorno',exact:true}).click();await form.getByRole('button',{name:'Tentar salvar novamente',exact:true}).waitFor();eq((await snapshot()).data.appointments.length,1);eq(await form.locator('[name="time"]').isDisabled(),true);
 await form.getByRole('button',{name:'Tentar salvar novamente',exact:true}).click();await dialog.getByText('Retorno salvo na agenda.',{exact:true}).waitFor();eq(scheduleRequests.length,2);eq(scheduleRequests[0],scheduleRequests[1]);eq((await snapshot()).data.appointments.length,1);eq((await snapshot()).data.records.length,0);await dialog.getByText('Horário: 10/01/2099 às 10:00',{exact:true}).waitFor();checks++;
 await dialog.getByRole('button',{name:'Fechar prontuário',exact:true}).click();await page.locator('#nav a[href="#agenda"]').click();await page.getByRole('button',{name:'Ver retornos',exact:true}).click();await dialog.getByRole('heading',{name:'Retornos da clínica',exact:true}).waitFor();await dialog.getByText('Horário: 10/01/2099 às 10:00',{exact:true}).waitFor();checks++;
 const old=await clinical('save',{id:crypto.randomUUID(),version:0,kind:'evolution',status:'reviewed',occurredAt:new Date(Date.now()-60000).toISOString(),payload:{summary:'Retorno atrasado fictício',returnDate:'2020-01-01'},requestId:crypto.randomUUID()});
 await dialog.getByRole('button',{name:'Atualizar',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.clinical-followup-card').length===2);await dialog.getByLabel('Mostrar retornos',{exact:true}).selectOption('overdue');eq(await dialog.locator('.clinical-followup-card').count(),1);await dialog.getByText('Atrasado',{exact:true}).waitFor();checks++;
 await dialog.getByRole('button',{name:'Marcar concluído',exact:true}).click();await dialog.getByText('Retorno marcado como concluído.',{exact:true}).waitFor();await dialog.getByLabel('Mostrar retornos',{exact:true}).selectOption('completed');eq(await dialog.locator('.clinical-followup-card').count(),1);eq((await clinical('history',{id:old.id})).length,1);eq((await snapshot()).data.appointments.length,1);
 await dialog.getByRole('button',{name:'Reabrir retorno',exact:true}).click();await dialog.getByText('Retorno reaberto.',{exact:true}).waitFor();eq(await dialog.locator('.clinical-followup-card').count(),2);eq(mediaRequests,0);eq(errors,[]);
 const stored=await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}));eq(stored.includes('Retorno atrasado fictício'),false);
 console.log(`PASS: ${checks} clinical-followup browser checks; reviewed forecast, patient/professional/date prefill, lost response/replay without duplicate, agenda overview, overdue/completed/reopened states and three viewport widths. Main/runtime/local SQL are real; Auth service is a double.`);
}catch(error){for(const page of browser?.contexts().flatMap(c=>c.pages())||[])console.error('Stock QA screen:',(await page.locator('body').innerText()).slice(0,1500),errors);throw error}
finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await db.close()}
