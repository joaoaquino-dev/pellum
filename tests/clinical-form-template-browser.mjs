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
 const entry=await procedure();
 const stub=`export function createClient(){return {auth:{getSession:async()=>({data:{session:{user:{id:${JSON.stringify(accounts.owner.user)},email:${JSON.stringify(accounts.owner.email)}}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args)=>{const response=await fetch('/__stock-rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})});return response.json()}}}`;
 const compiled=(await build({entryPoints:['standalone/src/main.js'],bundle:true,write:false,format:'iife',platform:'browser',define:{AURA_DEPLOY_ENV:'"staging"',AURA_SUPABASE_URL:'"https://qa.example.invalid"',AURA_SUPABASE_KEY:'"sb_publishable_fictitious"'},plugins:[{name:'explicit-auth-double',setup(b){b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'stub',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:stub,loader:'js'}))}}]})).outputFiles[0].text;
 server=createServer(async(req,res)=>{try{
  if(req.url==='/__stock-rpc'){
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1000000)throw Error('Body limit')}
   const {name,args}=JSON.parse(raw);let data,error;
   try{
    if(!['aura_rpc','aura_clinical_rpc','aura_clinical_stock_rpc','aura_clinical_form_template_rpc'].includes(name))throw Error('Unsupported QA RPC');
    await login('owner','aal2');data=await rpc(name,name==='aura_rpc'?[args.p_action,args.p_clinic,JSON.stringify(args.p_body)]:[args.p_action,args.p_clinic,args.p_patient,JSON.stringify(args.p_body)]);
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
 const models=async name=>{await dialog.getByText('Modelos de procedimentos e termos',{exact:true}).click();await dialog.getByRole('button',{name,exact:true}).click();await dialog.locator('#questionBuilder').waitFor()};
 const editor=()=>dialog.locator('#questionBuilder').locator('..');
 await models('Modelos de procedimentos');await editor().locator('[name="name"]').fill('Modelo Peeling QA');await editor().locator('[name="procedure"]').selectOption('Peeling');await editor().locator('[data-label]').fill('Conferência fictícia');await editor().locator('[data-required]').check();await editor().locator('[data-details]').check();eq(await editor().locator('[data-options]').isVisible(),false);
 await mkdir('.codex/clinical-qa',{recursive:true});for(const viewport of [{width:390,height:844},{width:820,height:1180},{width:1366,height:900}]){await page.setViewportSize(viewport);await dialog.evaluate(el=>el.scrollTop=0);eq(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);await dialog.screenshot({path:'.codex/clinical-qa/form-model-'+viewport.width+'.png'})}await page.setViewportSize({width:390,height:844});
 await editor().getByRole('button',{name:'Salvar modelo',exact:true}).click();await dialog.getByRole('button',{name:'＋ Procedimento realizado',exact:true}).waitFor();
 await dialog.getByRole('button',{name:'＋ Procedimento realizado',exact:true}).click();await dialog.locator('[name="summary"]').fill('Procedimento com ficha reutilizável');await dialog.locator('[name="procedure"]').selectOption('Peeling');await dialog.locator('[name="formTemplateChoice"] option').filter({hasText:'Modelo Peeling QA'}).waitFor({state:'attached'});await dialog.locator('[name="formTemplateChoice"]').selectOption({label:'Modelo Peeling QA · v1'});
 eq(await dialog.locator('[name="form_answer_q1_detail"]').isVisible(),false);await dialog.locator('[name="form_answer_q1"]').selectOption('yes');eq(await dialog.locator('[name="form_answer_q1_detail"]').isVisible(),true);await dialog.locator('[name="form_answer_q1_detail"]').fill('Explicação fictícia <script>window.TEMPLATE_LEAK=true</script>');
 cancelDialog=true;await dialog.locator('[name="procedure"]').selectOption('Limpeza de pele');eq(await dialog.locator('[name="procedure"]').inputValue(),'Peeling');eq(await dialog.locator('[name="form_answer_q1_detail"]').inputValue(),'Explicação fictícia <script>window.TEMPLATE_LEAK=true</script>');
 await dialog.getByRole('button',{name:'Revisar e finalizar',exact:true}).click();await dialog.getByRole('button',{name:'＋ Procedimento realizado',exact:true}).waitFor();
 const created=(await clinical('list')).find(e=>e.payload.summary==='Procedimento com ficha reutilizável');eq(created.payload.formTemplateVersion,1);eq(created.payload.formAnswers.q1,'yes');eq(created.payload.formQuestions[0].label,'Conferência fictícia');eq(await page.evaluate(()=>window.TEMPLATE_LEAK),undefined);
 await models('Modelos de procedimentos');await dialog.getByRole('button',{name:'Editar modelo: Modelo Peeling QA · v1',exact:true}).click();await editor().locator('[data-label]').first().fill('Pergunta revisada fictícia');await editor().getByRole('button',{name:'Salvar modelo',exact:true}).click();await dialog.getByRole('button',{name:'＋ Procedimento realizado',exact:true}).waitFor();
 const saved=(await clinical('list')).find(e=>e.id===created.id);eq(saved.payload.formQuestions[0].label,'Conferência fictícia');eq(saved.payload.formTemplateVersion,1);
 const card=dialog.locator('.clinical-entry').filter({hasText:'Procedimento com ficha reutilizável'});await card.getByRole('button',{name:'Adicionar adendo',exact:true}).click();eq(await dialog.locator('[name="formTemplateChoice"]').isDisabled(),true);eq(await dialog.locator('[name="form_answer_q1_detail"]').inputValue(),'Explicação fictícia <script>window.TEMPLATE_LEAK=true</script>');await dialog.locator('[name="reason"]').fill('Complemento fictício com o mesmo modelo');await dialog.getByRole('button',{name:'Salvar adendo',exact:true}).click();await dialog.getByRole('button',{name:'＋ Minuta de termo',exact:true}).waitFor();eq((await clinical('history',{id:created.id})).at(-1).payload.formTemplateVersion,1);
 await models('Modelos de termos');await editor().locator('[name="name"]').fill('Termo QA');await editor().locator('[name="purpose"]').selectOption('Procedimento');await editor().locator('[data-label]').fill('Dúvidas esclarecidas fictícias');await editor().locator('[data-type]').selectOption('text');await editor().locator('[data-required]').check();await editor().getByRole('button',{name:'Salvar modelo',exact:true}).click();await dialog.getByRole('button',{name:'＋ Minuta de termo',exact:true}).waitFor();
 await dialog.getByRole('button',{name:'＋ Minuta de termo',exact:true}).click();await dialog.locator('[name="summary"]').fill('Minuta com modelo QA');await dialog.locator('[name="formTemplateChoice"] option').filter({hasText:'Termo QA'}).waitFor({state:'attached'});await dialog.locator('[name="formTemplateChoice"]').selectOption({label:'Termo QA · v1'});await dialog.getByRole('button',{name:'Revisar e finalizar',exact:true}).click();await dialog.getByText('Responda: Dúvidas esclarecidas fictícias',{exact:true}).waitFor();checks++;
 await dialog.locator('[name="form_answer_q1"]').fill('Esclarecimentos fictícios registrados');await dialog.getByRole('button',{name:'Revisar e finalizar',exact:true}).click();await dialog.getByRole('button',{name:'Exportar documento clínico',exact:true}).waitFor();const term=(await clinical('list')).find(e=>e.payload.summary==='Minuta com modelo QA');eq(term.payload.formTemplateName,'Termo QA');eq(term.payload.formAnswers.q1,'Esclarecimentos fictícios registrados');
 const downloadPromise=page.waitForEvent('download');await dialog.getByRole('button',{name:'Exportar documento clínico',exact:true}).click();const download=await downloadPromise,html=await readFile(await download.path(),'utf8');eq(html.includes('Modelo Peeling QA · v1'),true);eq(html.includes('Esclarecimentos fictícios registrados'),true);eq(html.includes('<script>'),false);eq(mediaRequests,0);eq(errors,[]);eq(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
 console.log(`PASS: ${checks} reusable form-template browser checks; real UI/main/local SQL, editor/version reuse, conditional/required answers, old reviewed source and adendum, consent model, safe export and no photos. Auth service is a double.`);
}catch(error){for(const page of browser?.contexts().flatMap(c=>c.pages())||[])console.error('Stock QA screen:',(await page.locator('body').innerText()).slice(0,1500),errors);throw error}
finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await db.close()}
