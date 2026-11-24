// Real main/runtime + HTTP + local SQL. Auth SDK/session and MFA are doubles.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../standalone/node_modules/esbuild/lib/main.js';
import {createFullSchemaFixture} from './clinical/full-schema-fixture.mjs';
const {chromium}=await import(pathToFileURL(path.resolve('tests/clinical/node_modules/playwright/index.mjs')).href);
const {db,accounts,login,rpc}=await createFullSchemaFixture(['administrator','owner','manager']);let browser,server,documents=0,checks=0;const errors=[];
const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
try{
 for(const name of ['owner','manager'])await db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified')",[accounts[name].user]);
 await login('administrator','aal2');for(const name of ['owner','manager'])await rpc('aura_admin_rpc',['authorize',JSON.stringify({email:accounts[name].email,max_clinics:1})]);
 await login('owner','aal2');const {id:clinic}=await rpc('aura_rpc',['create',null,JSON.stringify({name:'QA proteção de acesso',requestId:randomUUID()})]);await rpc('aura_rpc',['member',clinic,JSON.stringify({email:accounts.manager.email,requestId:randomUUID()})]);
 const stub=`export function createClient(){return {auth:{getSession:async()=>({data:{session:{user:{id:${JSON.stringify(accounts.manager.user)},email:${JSON.stringify(accounts.manager.email)}}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'}}),listFactors:async()=>({data:{totp:[{id:'synthetic-factor',status:'verified'}]}})}},rpc:async(name,args)=>{const r=await fetch('/__owner-rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args})});return r.json()}}}`;
 const compiled=(await build({entryPoints:['standalone/src/main.js'],bundle:true,write:false,format:'iife',platform:'browser',define:{AURA_DEPLOY_ENV:'"staging"',AURA_SUPABASE_URL:'"https://qa.example.invalid"',AURA_SUPABASE_KEY:'"sb_publishable_fictitious"'},plugins:[{name:'explicit-auth-double',setup(b){b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'stub',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:stub,loader:'js'}))}}]})).outputFiles[0].text;
 server=createServer(async(req,res)=>{try{
  if(req.url==='/__owner-rpc'){
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>100000)throw Error('Body limit')}
   const {name,args}=JSON.parse(raw);let data,error;
   try{if(name!=='aura_rpc')throw Object.assign(Error('Unsupported QA call'),{code:'22023'});await login('manager','aal2');data=await rpc('aura_rpc',[args.p_action,args.p_clinic,JSON.stringify(args.p_body)])}catch(e){error={code:e.code,message:e.message}}
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data,error}));return;
  }
  if(req.url==='/main.js'){res.setHeader('Content-Type','text/javascript');res.end(compiled);return}
  if(req.url==='/')documents++;
  const name=req.url==='/'?'index.html':req.url.slice(1);if(!/^[A-Za-z0-9_.-]+$/.test(name)){res.writeHead(404).end();return}
  res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(await readFile(path.join('standalone/dist',name)));
 }catch{res.writeHead(500).end('Local QA failure')}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.PELLUM_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(id=>localStorage.setItem('pellum-start-'+id,JSON.stringify({seen:true,step:0})),clinic);await page.goto(origin+'/#config');await page.locator('#sharedManagement summary').click();await page.locator('#memberForm').waitFor();
 const initialDocuments=documents;await page.locator('[data-email="'+accounts.owner.email+'"]').click();await page.getByText(/O acesso da proprietária não pode ser removido por este formulário/).waitFor();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));eq(documents,initialDocuments);eq(await page.locator('#memberForm').isVisible(),true);
 await page.locator('[data-security="delete-clinic"]').click();await page.locator('#deleteClinicForm [name="confirmation"]').fill('QA proteção de acesso');await page.locator('#deleteClinicForm [name="confirmed"]').check();await page.locator('#deleteClinicForm button').last().click();await page.locator('#deleteClinicError').getByText('Somente a proprietária pode excluir esta clínica. Seu acesso de gestão continua ativo.',{exact:true}).waitFor();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));eq(documents,initialDocuments);eq(await page.locator('#deleteClinicForm').isVisible(),true);
 await page.locator('#cancelDeleteClinic').click();await login('owner','aal2');eq((await rpc('aura_rpc',['get',clinic,'{}'])).members.length,2);
 // Other authorization failures still force reinitialization; the exception is
 // only for the two exact ownership business-rule errors, never all 42501s.
 await login('administrator','aal2');await rpc('aura_admin_rpc',['suspend',JSON.stringify({email:accounts.manager.email})]);
 const reloaded=page.waitForEvent('domcontentloaded');await page.evaluate(()=>window.AURA_API({action:'history'}).catch(()=>null));await reloaded;eq(documents>initialDocuments,true);eq(errors,[]);
 console.log(`PASS: ${checks} owner browser checks; real main/runtime and local SQL, protected actions show clear errors without reload, retained owner access, unrelated authorization failure still reloads. Auth/MFA services are explicit doubles.`);
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await db.close()}
