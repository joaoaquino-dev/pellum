// Real main/runtime/SQL. Initial Auth session is an explicit SDK double.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../standalone/node_modules/esbuild/lib/main.js';
import {createStockFixture} from './clinical/stock-fixture.mjs';
const {chromium}=await import(pathToFileURL(path.resolve('tests/clinical/node_modules/playwright/index.mjs')).href);
const {db,accounts,clinic,login,rpc,procedure,snapshot,clinical}=await createStockFixture();let browser,server,checks=0,loseResponse=false,confirmations=0,mediaRequests=0,cancelDialog=false;const errors=[],consumptions=[];
const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
try{
 const save=(summary,extra={})=>clinical('save',{id:crypto.randomUUID(),version:0,kind:'procedure',status:'reviewed',occurredAt:'2024-06-01T12:00:00Z',payload:{summary},requestId:crypto.randomUUID(),...extra});
 const old=await save('Ácido hialurônico antigo <script>window.SEARCH_LEAK=true</script>',{occurredAt:'2020-01-01T12:00:00Z'});
 for(let i=0;i<101;i++)await save('Registro recente fictício '+i);
 const stub=`export function createClient(){return {auth:{getSession:async()=>({data:{session:{user:{id:${JSON.stringify(accounts.owner.user)},email:${JSON.stringify(accounts.owner.email)}}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{const response=await fetch('/__stock-rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})});return response.json()}}}`;
 const compiled=(await build({entryPoints:['standalone/src/main.js'],bundle:true,write:false,format:'iife',platform:'browser',define:{AURA_DEPLOY_ENV:'"production"',AURA_SUPABASE_URL:'"https://qa.example.invalid"',AURA_SUPABASE_KEY:'"sb_publishable_fictitious"'},plugins:[{name:'explicit-auth-double',setup(b){b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'stub',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:stub,loader:'js'}))}}]})).outputFiles[0].text;
 server=createServer(async(req,res)=>{try{
  if(req.url==='/__stock-rpc'){
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1000000)throw Error('Body limit')}
   const {name,args}=JSON.parse(raw);let data,error;
   try{
    if(!['aura_rpc','aura_clinical_rpc','aura_clinical_stock_rpc','aura_clinical_form_template_rpc','aura_clinical_search'].includes(name))throw Error('Unsupported QA RPC');
    await login('owner','aal2');data=await rpc(name,name==='aura_clinical_search'?[args.p_clinic,args.p_patient,JSON.stringify(args.p_body)]:name==='aura_rpc'?[args.p_action,args.p_clinic,JSON.stringify(args.p_body)]:[args.p_action,args.p_clinic,args.p_patient,JSON.stringify(args.p_body)]);
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

 eq(await dialog.locator('.clinical-entry').filter({hasText:'Ácido hialurônico antigo'}).count(),0);
 await dialog.locator('#clinicalSearch').fill('acido HIALURONICO');await dialog.getByRole('button',{name:'Pesquisar',exact:true}).click();
 eq(await dialog.locator('.eyebrow').innerText(),'PRONTUÁRIO');
 const form=dialog.locator('#clinicalHistorySearch'),results=dialog.locator('.clinical-search-results');await results.getByText('Ácido hialurônico antigo',{exact:false}).waitFor();eq(await results.locator('article').count(),1);eq(await page.evaluate(()=>window.SEARCH_LEAK),undefined);
 await results.getByRole('button',{name:'Abrir registro',exact:true}).click();await dialog.getByRole('button',{name:'Adicionar adendo',exact:true}).waitFor();eq(await dialog.locator('.clinical-entry').count(),1);
 await dialog.getByRole('button',{name:'Voltar à pesquisa',exact:true}).click();eq(await form.locator('[name="query"]').inputValue(),'acido HIALURONICO');
 await results.getByRole('button',{name:'Ver versões',exact:true}).click();await dialog.getByText('Versões preservadas. Nenhuma versão anterior é sobrescrita.',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Voltar à pesquisa',exact:true}).click();
 await save('Registro antigo corrigido',{id:old.id,version:1,status:'addendum',reason:'Correção fictícia',occurredAt:'2020-01-01T12:00:00Z'});
 await form.getByRole('button',{name:'Pesquisar',exact:true}).click();await results.getByText('Nenhum registro encontrado.',{exact:false}).waitFor();
 await form.getByText('Tipo, período e versões',{exact:true}).click();await form.locator('[name="includeHistory"]').check();await form.getByRole('button',{name:'Pesquisar',exact:true}).click();await results.getByRole('button',{name:'Ver versão encontrada',exact:true}).click();await dialog.getByText('Versão anterior · consulte as versões para ver o registro atual.',{exact:true}).waitFor();eq(await dialog.getByRole('button',{name:'Adicionar adendo',exact:true}).count(),0);eq(await dialog.locator('.clinical-entry').innerText().then(t=>t.includes('Ácido hialurônico antigo')),true);
 await dialog.getByRole('button',{name:'Voltar à pesquisa',exact:true}).click();await form.locator('[name="query"]').fill('Registro recente');await form.locator('[name="kind"]').selectOption('procedure');await form.locator('[name="from"]').fill('2024-06-01');await form.locator('[name="to"]').fill('2024-06-01');await form.getByRole('button',{name:'Pesquisar',exact:true}).click();await results.locator('article').nth(19).waitFor();eq(await results.locator('article').count(),20);
 await dialog.getByRole('button',{name:'Mais resultados',exact:true}).click();await results.locator('article').nth(39).waitFor();eq(await results.locator('article').count(),40);
 await mkdir('.codex/clinical-qa',{recursive:true});for(const viewport of [{width:390,height:844},{width:820,height:1180},{width:1366,height:900}]){await page.setViewportSize(viewport);await dialog.evaluate(el=>el.scrollTop=0);eq(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);}
 eq(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('HIALURONICO')),false);
 await form.locator('[name="kind"]').selectOption('evolution');eq(await results.isVisible(),false);await form.getByRole('button',{name:'Pesquisar',exact:true}).click();await results.getByText('Nenhum registro encontrado.',{exact:false}).waitFor();
 await form.getByRole('button',{name:'Limpar filtros',exact:true}).click();await results.locator('article').nth(19).waitFor();eq(await form.locator('[name="query"]').inputValue(),'');eq(await form.locator('[name="includeHistory"]').isChecked(),false);
 await page.evaluate(()=>window.dispatchEvent(new Event('pellum:session-ended')));eq(await dialog.isVisible(),false);eq(await dialog.innerText(),'');eq(mediaRequests,0);eq(errors,[]);
 console.log(`PASS: ${checks} clinical-history search browser checks; real main/UI/local SQL, records beyond initial 100, accents, preserved filters, historical detail without editing, pagination, dates/types, mobile/tablet/notebook layout, safe text and logout cleanup. Auth service is a double.`);
}catch(error){for(const page of browser?.contexts().flatMap(c=>c.pages())||[])console.error('Search QA screen:',(await page.locator('body').innerText()).slice(-1800),errors);throw error}
finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await db.close()}
