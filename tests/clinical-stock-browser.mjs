// Real main/runtime/SQL. Initial Auth session is an explicit SDK double.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../standalone/node_modules/esbuild/lib/main.js';
import {createStockFixture} from './clinical/stock-fixture.mjs';
const {chromium}=await import(pathToFileURL(path.resolve('tests/clinical/node_modules/playwright/index.mjs')).href);
const {db,accounts,clinic,login,rpc,procedure,snapshot,clinical}=await createStockFixture();let browser,server,checks=0,loseResponse=true,confirmations=0,mediaRequests=0;const errors=[],consumptions=[];
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
    if(!['aura_rpc','aura_clinical_rpc','aura_clinical_stock_rpc'].includes(name))throw Error('Unsupported QA RPC');
    await login('owner');data=await rpc(name,name==='aura_rpc'?[args.p_action,args.p_clinic,JSON.stringify(args.p_body)]:[args.p_action,args.p_clinic,args.p_patient,JSON.stringify(args.p_body)]);
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
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>{confirmations++;dialog.accept()});
 page.on('request',request=>{if(request.url().includes('/api/clinical-media'))mediaRequests++});
 await page.goto(origin+'/#pacientes');await page.locator('[data-clinical-patient="patient-qa"]').click();const dialog=page.locator('#clinicalDialog');
 await dialog.getByRole('button',{name:'Adicionar materiais',exact:true}).click();const form=dialog.locator('#clinicalStockForm');await form.waitFor();eq(await form.locator('[data-stock-row]').count(),1);eq(await form.locator('option[value="expired"]').count(),0);
 await mkdir('.codex/clinical-qa',{recursive:true});
 for(const viewport of [{width:390,height:844},{width:820,height:1180},{width:1366,height:900}]){
  await page.setViewportSize(viewport);eq(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);eq(await form.locator('input').evaluate(el=>el.getBoundingClientRect().height>=44),true);await dialog.screenshot({path:'.codex/clinical-qa/stock-'+viewport.width+'.png'});
 }
 await page.setViewportSize({width:390,height:844});
 await form.getByRole('button',{name:'Adicionar outro material',exact:true}).click();eq(await form.locator('[data-stock-row]').count(),2);await form.getByRole('button',{name:'Remover este material',exact:true}).click();eq(await form.locator('[data-stock-row]').count(),1);
 await form.locator('[data-stock-quantity]').fill('40');await form.getByRole('button',{name:'Salvar materiais',exact:true}).click();await form.getByRole('button',{name:'Tentar salvar novamente',exact:true}).waitFor();eq((await snapshot()).data.products[0].balance,60);eq((await clinical('history',{id:entry.id})).length,2);eq(await form.locator('input').isDisabled(),true);
 await form.getByRole('button',{name:'Tentar salvar novamente',exact:true}).click();await dialog.getByText('Materiais registrados.',{exact:true}).waitFor();eq(consumptions.length,2);eq(consumptions[0],consumptions[1]);eq((await snapshot()).data.products[0].movements.length,1);eq((await snapshot()).data.records.length,0);
 eq(await dialog.getByRole('button',{name:'Adicionar materiais',exact:true}).count(),0);await dialog.getByText(/Material: Insumo fictício · lote QA-01 · 40 unidades/).waitFor();checks++;
 eq(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);await dialog.getByRole('button',{name:'Fechar prontuário',exact:true}).click();
 // A normal later snapshot write uses the refreshed revision and keeps the
 // clinical movement, instead of overwriting the new debit with stale state.
 await page.locator('#nav a[href="#estoque"]').click();await page.waitForFunction(()=>document.querySelector('#app tbody tr')?.textContent.includes('60 unidades'));checks++;
 await page.locator('#nav a[href="#despesas"]').click();await page.getByRole('button',{name:/Nova despesa/}).click();await page.locator('#expenseForm [name="name"]').fill('Despesa fictícia posterior');await page.locator('#expenseForm [name="value"]').fill('10');await page.locator('#expenseForm button').last().click();await page.waitForFunction(()=>window.AURA_CLINIC_SYNC().pending===0&&!window.AURA_CLINIC_SYNC().blocked);
 const saved=await snapshot();eq(saved.data.expenses.length,1);eq(saved.data.products[0].balance,60);eq(saved.data.products[0].movements.length,1);eq(errors,[]);
 const pendingEntry=await procedure();await page.locator('#nav a[href="#pacientes"]').click();await page.locator('[data-clinical-patient="patient-qa"]').click();await dialog.getByRole('button',{name:'Adicionar materiais',exact:true}).click();await form.waitFor();eq(await form.locator('[data-stock-quantity]').getAttribute('max'),null);
 await form.locator('[data-stock-quantity]').fill('70');await form.getByRole('button',{name:'Salvar materiais',exact:true}).click();await dialog.getByText('Materiais registrados. Lembre-se de revisar seu estoque.',{exact:true}).waitFor();eq((await snapshot()).data.products[0].balance,60);eq((await snapshot()).data.records.length,0);eq((await clinical('history',{id:pendingEntry.id})).at(-1).payload.stockReview,'pending');eq(errors,[]);
 const stored=await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}));eq(stored.includes('Procedimento fictício'),false);
 eq(confirmations,0);
 eq(await dialog.getByRole('button',{name:'Fotografias e anexos',exact:true}).count(),0);eq(mediaRequests,0);
 // Default product has no photo workflow. Optional profile fields remain real
 // clinical content: save through the actual RPC, then inspect SQL and export.
 await dialog.getByRole('button',{name:'＋ Procedimento realizado',exact:true}).click();await dialog.locator('[name="summary"]').fill('Procedimento específico fictício');await dialog.locator('[name="procedure"]').selectOption('Toxina botulínica');
 await dialog.getByText('Detalhes do procedimento · se necessário',{exact:true}).click();await dialog.getByLabel('Preparo e diluição utilizados',{exact:true}).fill('Preparo documentado pelo profissional, sem recomendação automática');await dialog.getByLabel('Regiões, pontos e unidades aplicadas',{exact:true}).fill('Descrição fictícia de aplicação');await dialog.locator('[name="productDetails"]').fill('Produto e fabricante fictícios');await dialog.locator('[name="batchDetails"]').fill('Lote QA-MANUAL, quantidade e unidade conferidas');
 await dialog.getByRole('button',{name:'Revisar e finalizar',exact:true}).click();await dialog.getByRole('button',{name:'＋ Avaliação',exact:true}).waitFor();
 const procedureRecord=(await clinical('list')).find(e=>e.payload.summary==='Procedimento específico fictício');eq(procedureRecord.payload.applicationDetails,'Descrição fictícia de aplicação');eq(procedureRecord.payload.productDetails,'Produto e fabricante fictícios');eq(procedureRecord.finalized,true);
 await dialog.getByRole('button',{name:'＋ Avaliação',exact:true}).click();await dialog.locator('[name="summary"]').fill('Avaliação corporal fictícia');await dialog.locator('[name="assessmentType"]').selectOption('Corporal');eq(await dialog.getByText('Avaliação facial · se necessário',{exact:true}).isVisible(),false);eq(await dialog.getByText('Avaliação corporal · se necessário',{exact:true}).isVisible(),true);
 await dialog.getByText('Avaliação corporal · se necessário',{exact:true}).click();await dialog.locator('[name="bodyMeasurements"]').fill('Medida fictícia: 80 cm');await dialog.getByRole('button',{name:'Revisar e finalizar',exact:true}).click();await dialog.getByRole('button',{name:'＋ Avaliação',exact:true}).waitFor();
 eq((await clinical('list')).find(e=>e.payload.summary==='Avaliação corporal fictícia').payload.bodyMeasurements,'Medida fictícia: 80 cm');eq(mediaRequests,0);eq(errors,[]);
 await db.exec('reset role');eq((await db.query("select count(*)::int n from public.aura_clinical_versions where payload->>'applicationDetails'='Descrição fictícia de aplicação'")).rows[0].n,1);
 console.log(`PASS: ${checks} clinical-stock browser checks; real main/runtime/local SQL, lot selection, lost response/replay, immutable addendum, refreshed revision, later expense save, insufficient stock as a nonblocking reminder and mobile layout. Auth service is a double.`);
}catch(error){for(const page of browser?.contexts().flatMap(c=>c.pages())||[])console.error('Stock QA screen:',(await page.locator('body').innerText()).slice(0,1500),errors);throw error}
finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await db.close()}
