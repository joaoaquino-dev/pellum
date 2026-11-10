import {build} from 'esbuild';
import {readFile,writeFile,mkdir,copyFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveBuildConfig} from './src/build-config.js';
const root=path.dirname(fileURLToPath(import.meta.url));process.chdir(root);
const config=resolveBuildConfig(process.env,JSON.parse(await readFile('supabase.public.json','utf8')));
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
const brand=JSON.parse(await readFile('brand.json','utf8'));
const rebrand=s=>s.replace(/\bAura\b/g,brand.name).replace(/>aura</g,'>'+brand.wordmark+'<').replace('class="avatar">A</span>','class="avatar">P</span>');
await build({absWorkingDir:root,entryPoints:['src/main.js'],bundle:true,format:'iife',platform:'browser',target:['es2022'],outfile:'dist/main.js',minify:true,define:{AURA_DEPLOY_ENV:JSON.stringify(config.mode),AURA_SUPABASE_URL:JSON.stringify(config.url),AURA_SUPABASE_KEY:JSON.stringify(config.publishableKey)}});
await writeFile('dist/main.js',rebrand(await readFile('dist/main.js','utf8')));
let legacy=await readFile('../public/aura/app.js','utf8');
// Fail closed when the legacy bootstrap changes.
const start=legacy.indexOf('let state;try{'),end=legacy.indexOf("let page='inicio';",start);if(start<0||end<0)throw Error('Bootstrap do aplicativo não encontrado');legacy=legacy.slice(0,start)+'let state=window.AURA_DATA;'+legacy.slice(end);
legacy+='\n'+await readFile('../public/aura/features.js','utf8')+'\n'+await readFile('src/runtime-security.js','utf8')+'\n'+await readFile('src/runtime-team.js','utf8')+'\n'+await readFile('src/runtime-guide.js','utf8')+'\n'+await readFile('src/runtime-catalog.js','utf8')+'\n'+await readFile('src/runtime-products.js','utf8')+'\n'+await readFile('src/runtime-phone.js','utf8')+'\n'+await readFile('src/runtime-alerts.js','utf8')+'\n'+await readFile('src/runtime-clinical.js','utf8')+'\nwindow.AURA_CONNECT({api:window.AURA_API,cloud:window.AURA_CLOUD});\nwindow.AURA_READY();';legacy=legacy.replace(/(\s)on(click|change|input|submit)=/g,'$1data-on$2=');await writeFile('dist/runtime.js',rebrand(legacy));
let html=await readFile('../public/aura/index.html','utf8');html=html.replace('/aura/style.css','/style.css').replace('/aura/cloud.js','/main.js');html=html.replace('<head>', '<head><meta name="robots" content="noindex, nofollow">');html=html.replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: ${config.url}; connect-src 'self' ${config.url}; base-uri 'self'; form-action 'self'">`);await writeFile('dist/index.html',rebrand(html));
await writeFile('dist/style.css',(await readFile('../public/aura/style.css','utf8'))+'\n'+await readFile('src/clinical.css','utf8'));
for(const f of ['favicon.svg','favicon-32.png','apple-touch-icon.png'])await copyFile('assets/'+f,'dist/'+f);
await writeFile('dist/_headers',"/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: "+config.url+"; connect-src 'self' "+config.url+"; frame-ancestors 'none'; base-uri 'self'; form-action 'self'\n  Cache-Control: no-cache\n");
console.log('Pellum independente gerada em standalone/dist · '+config.mode);

await mkdir('dist/conheca',{recursive:true});
for(const f of ['index.html','landing.css','landing.js']){
 if(f==='index.html')await writeFile('dist/conheca/'+f,(await readFile('landing/'+f,'utf8')).replaceAll('https://usepellum.vercel.app',config.publicOrigin));
 else await copyFile('landing/'+f,'dist/conheca/'+f);
}

// Public discovery only: the authenticated application never enters the sitemap.
await writeFile('dist/robots.txt','User-agent: *\nAllow: /\nSitemap: '+config.publicOrigin+'/sitemap.xml\n');
await writeFile('dist/sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+config.publicOrigin+'/conheca/</loc></url></urlset>');
await copyFile('landing/404.html','dist/404.html');
await copyFile('assets/social-card.png','dist/social-card.png');
