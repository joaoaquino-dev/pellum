// Packages already generated production output. Never deploys source, .env,
// private runtime state, backup scripts or API/functions directories.
import {readFile,readdir,lstat,mkdir,mkdtemp,copyFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {resolvePublicOrigin} from '../standalone/src/public-origin.js';
const origin=resolvePublicOrigin(process.env.PELLUM_PUBLIC_ORIGIN);if(!process.env.PELLUM_PUBLIC_ORIGIN)throw Error('Explicit public origin required');
await mkdir('outputs',{recursive:true});const root=await mkdtemp(path.resolve('outputs/netlify-release-'));await mkdir(path.join(root,'public'));
const files=[];let total=0;
async function visit(relative=''){
 for(const entry of await readdir(path.join('standalone/dist',relative),{withFileTypes:true})){
  const name=path.posix.join(relative,entry.name),source=path.join('standalone/dist',name);if((await lstat(source)).isSymbolicLink())throw Error('Linked build file refused');
  if(entry.isDirectory()){if(name!=='conheca')throw Error('Unexpected build directory');await mkdir(path.join(root,'public',name));await visit(name);continue}
  if(!/\.(?:html|js|css|svg|png|txt|xml)$/.test(name)&&name!=='_headers')throw Error('Unexpected build file');
  const bytes=await readFile(source);total+=bytes.length;if(total>10*1024*1024||files.length>=30)throw Error('Unexpected build size');
  if(/\.(?:html|js|css)$/.test(name)&&/sb_secret_[A-Za-z0-9_-]{20,}/.test(bytes.toString()))throw Error('Privileged key pattern refused');
  await copyFile(source,path.join(root,'public',name));files.push({file:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
}
await visit();const sitemap=await readFile(path.join(root,'public/sitemap.xml'),'utf8');if(!sitemap.includes(origin+'/conheca/'))throw Error('Wrong public origin');
const main=await readFile(path.join(root,'public/main.js'),'utf8');if(main.includes('http://127.0.0.1:54321')||main.includes('sb_publishable_local_development_only'))throw Error('Local development build refused');
await writeFile(path.join(root,'netlify.toml'),'[build]\n  publish = "public"\n[build.processing]\n  skip_processing = true\n[functions]\n  directory = "functions-disabled"\n',{flag:'wx'});await mkdir(path.join(root,'functions-disabled'));
const manifest={preparedAt:new Date().toISOString(),publicOrigin:origin,totalBytes:total,files,staticOnly:true,backendProjectUnchanged:true,published:false};await writeFile(path.join(root,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});await writeFile('.codex/netlify-release.json',JSON.stringify({root,origin})+'\n');console.log('Static production package prepared: '+root+'; no remote deployment.');
