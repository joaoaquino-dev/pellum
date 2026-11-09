// Real auth-screen code in Chromium; the Auth SDK is an explicit UI test double.
import assert from 'node:assert/strict';
import {build} from '../standalone/node_modules/esbuild/lib/main.js';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(path.resolve('tests/clinical/node_modules/playwright/index.mjs')).href);
const stub=`window.authCalls=[];export function createClient(){return {auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signUp:async body=>{window.authCalls.push({action:'signup',body});return {data:{user:{id:'synthetic'},session:null}}},resetPasswordForEmail:async(email,options)=>{window.authCalls.push({action:'reset',email,options});return {}},signInWithPassword:async()=>({error:{status:400,message:'Sensitive provider details'}})}}}`;
const compiled=await build({entryPoints:['standalone/src/main.js'],bundle:true,write:false,format:'iife',platform:'browser',define:{AURA_DEPLOY_ENV:'"staging"',AURA_SUPABASE_URL:'"https://qa.example.invalid"',AURA_SUPABASE_KEY:'"sb_publishable_fictitious"'},plugins:[{name:'explicit-auth-ui-double',setup(builder){builder.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'auth-stub',namespace:'qa'}));builder.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:stub,loader:'js'}))}}]});
const server=createServer(async(req,res)=>{if(req.url==='/main.js'){res.setHeader('Content-Type','text/javascript');res.end(compiled.outputFiles[0].text);return}const file=req.url.startsWith('/style.css')?'style.css':'index.html';res.setHeader('Content-Type',file.endsWith('css')?'text/css':'text/html');res.end(await readFile('standalone/dist/'+file))});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.PELLUM_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});let checks=0;const errors=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
 await page.getByRole('heading',{name:'Que bom ter você por aqui.',exact:true}).waitFor();assert.equal(await page.locator('[name=password]').getAttribute('minlength'),'8');checks++;
 await page.locator('#app').getByText('Homologação · usar somente dados fictícios',{exact:true}).waitFor();checks++;
 await page.locator('[data-mode=signup]').click();assert.equal(await page.locator('[name=password]').getAttribute('minlength'),'12');checks++;
 await page.locator('[name=email]').fill('ficticia@example.invalid');await page.locator('[name=password]').fill('FicticiaQA2026!');await page.locator('#authForm button').click();await page.getByText(/Confira seu e-mail para confirmar o cadastro/).waitFor();
 assert.equal(await page.evaluate(()=>window.authCalls.at(-1).body.options.emailRedirectTo),origin+'/');checks++;
 await page.locator('[data-mode=reset]').click();await page.locator('[name=email]').fill('ficticia@example.invalid');await page.locator('#authForm button').click();await page.getByText(/Se o endereço estiver cadastrado/).waitFor();assert.equal(await page.evaluate(()=>window.authCalls.at(-1).options.redirectTo),origin+'/?mode=recovery');checks++;
 await page.locator('[data-mode=login]').click();await page.locator('[name=email]').fill('ficticia@example.invalid');await page.locator('[name=password]').fill('FicticiaQA2026!');await page.locator('#authForm button').click();await page.getByText(/Não foi possível entrar/).waitFor();assert.equal((await page.locator('#authMessage').textContent()).includes('Sensitive'),false);checks++;
 assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth>window.innerWidth+1),false);checks++;assert.deepEqual(errors,[]);checks++;
 console.log(`PASS: ${checks} auth-screen browser checks, mobile layout, staging warning, password guidance, same-origin confirmation/reset redirects and sanitized login errors. Auth/SMTP are explicit doubles, not service validation.`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
