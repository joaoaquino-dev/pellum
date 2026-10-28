import {build} from 'esbuild';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.dirname(new URL(import.meta.url).pathname);process.chdir(root);
await mkdir('dist',{recursive:true});
const config=JSON.parse(await readFile('supabase.public.json','utf8'));
await build({absWorkingDir:root,entryPoints:['src/main.js'],bundle:true,format:'iife',platform:'browser',target:['es2022'],outfile:'dist/main.js',minify:true,define:{AURA_SUPABASE_URL:JSON.stringify(config.url),AURA_SUPABASE_KEY:JSON.stringify(config.publishableKey)}});
let legacy=await readFile('../public/aura/app.js','utf8');legacy=legacy.replace(/let state;try\{state=JSON.parse\(localStorage.getItem\('aura-v1'\)\)\|\|structuredClone\(initial\)\}catch\{state=structuredClone\(initial\)\)\}/,'let state=window.AURA_DATA;');
// Fail closed when the legacy bootstrap changes.
const start=legacy.indexOf('let state;try{'),end=legacy.indexOf("let page='inicio';",start);if(start<0||end<0)throw Error('Bootstrap do aplicativo não encontrado');legacy=legacy.slice(0,start)+'let state=window.AURA_DATA;'+legacy.slice(end);
legacy+='\n'+await readFile('../public/aura/features.js','utf8')+'\nwindow.AURA_CONNECT({api:window.AURA_API,cloud:window.AURA_CLOUD});\nwindow.AURA_READY();';await writeFile('dist/runtime.js',legacy);
let html=await readFile('../public/aura/index.html','utf8');html=html.replace('/aura/style.css','/style.css').replace('/aura/cloud.js','/main.js');await writeFile('dist/index.html',html);
for(const f of ['style.css','favicon.svg','favicon-32.png','apple-touch-icon.png'])await copyFile('../public/aura/'+f,'dist/'+f);
await writeFile('dist/_headers',"/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' "+config.url+"; frame-ancestors 'none'; base-uri 'self'; form-action 'self'\n  Cache-Control: no-cache\n");
console.log('Aura independente gerada em standalone/dist');
