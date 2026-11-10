import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {renderMoveNotice} from '../standalone/src/move-notice.js';
import {chromium} from './clinical/node_modules/playwright/index.mjs';
const destination='https://new-pellum.example.invalid';let checks=0,browser,server;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
for(const value of [undefined,'https://usepellum.vercel.app','javascript:alert(1)','https://fake:password@example.com','https://example.com/#token']){assert.throws(()=>renderMoveNotice(value));checks++}
const html=renderMoveNotice(destination);
const prepared=execFileSync(process.execPath,['scripts/prepare-move-notice.mjs'],{encoding:'utf8',env:{...process.env,PELLUM_NEW_PUBLIC_ORIGIN:destination}});
const directory=prepared.match(/Aviso preparado localmente: (.+)\. Nada foi publicado\./)?.[1];assert.ok(directory);checks++;
const config=JSON.parse(await readFile(directory+'/vercel.json','utf8'));
eq(config.rewrites,[{source:'/(.*)',destination:'/index.html'}]);eq(config.buildCommand,null);eq(config.installCommand,null);
try{
 server=createServer((request,response)=>{response.setHeader('Content-Type','text/html; charset=utf-8');response.end(html)});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.PELLUM_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe'});const context=await browser.newContext(),page=await context.newPage();const outside=[],errors=[];
 page.on('pageerror',error=>errors.push(error.message));await context.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)return route.continue();outside.push({url:route.request().url(),referer:route.request().headers().referer});return route.fulfill({contentType:'text/html; charset=utf-8',body:'<p>Novo endereço fictício</p>'})});
 await page.goto(origin+'/?mode=recovery&code=synthetic-code#access_token=synthetic-token');eq(await page.getByRole('heading',{name:'A Pellum está de casa nova.'}).count(),1);eq(await page.locator('form,input,script').count(),0);eq(await page.locator('a').getAttribute('href'),destination+'/');eq(outside,[]);
 await mkdir('.codex/clinical-qa',{recursive:true});for(const viewport of [{width:390,height:844},{width:820,height:1180},{width:1366,height:900}]){await page.setViewportSize(viewport);eq(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await page.getByRole('link',{name:'Acessar a Pellum no novo endereço'}).focus();eq(await page.getByRole('link').evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Enter');await page.getByText('Novo endereço fictício').waitFor();eq(outside,[{url:destination+'/',referer:undefined}]);eq(errors,[]);
 console.log(`PASS: ${checks} move-notice checks; safe fixed destination, preserved branding and three viewports, keyboard access, no scripts/forms/background requests, no query/hash/recovery-token or referrer forwarding. No remote deployment.`);
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve))}
