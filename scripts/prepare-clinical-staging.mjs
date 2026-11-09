// Prepares a reviewable deployment config only. Never links, creates or deploys a project.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolveBuildConfig} from '../standalone/src/build-config.js';
const production=JSON.parse(await readFile('standalone/supabase.public.json','utf8'));
const config=resolveBuildConfig({...process.env,PELLUM_ENV:'staging'},production);
const vercel=JSON.parse(await readFile('vercel.json','utf8'));
for(const rule of vercel.headers)for(const header of rule.headers)if(header.key==='Content-Security-Policy')header.value=header.value.replace(production.url,config.url);
await mkdir('.codex/staging',{recursive:true});
await writeFile('.codex/staging/vercel.json',JSON.stringify(vercel,null,2)+'\n');
console.log('Configuração de homologação preparada em .codex/staging/vercel.json. Nenhum projeto ou deploy foi criado.');
