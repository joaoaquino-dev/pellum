// This module runs only during build. Do not print configuration or keys in errors.
import {resolvePublicOrigin} from './public-origin.js';
export function resolveBuildConfig(env,production){
 const mode=env.PELLUM_ENV||(env.VERCEL_ENV==='production'?'production':env.VERCEL_ENV==='preview'?'staging':'development');
 if(!['development','staging','production'].includes(mode))throw Error('Ambiente de build inválido.');
 if(env.VERCEL_ENV&&mode==='development')throw Error('Deploys remotos exigem configuração explícita de homologação ou produção.');
 if(env.VERCEL_ENV==='preview'&&mode==='production')throw Error('Uma prévia não pode usar a configuração de produção.');
 if(mode==='production'&&env.VERCEL_ENV&&env.VERCEL_PROJECT_ID!=='prj_xNNqxkDzMtJScbuTbt1Fhp5bjdRA')throw Error('Projeto Vercel de produção não confirmado. Configure o novo projeto como homologação.');
 let url=env.PELLUM_SUPABASE_URL,publishableKey=env.PELLUM_SUPABASE_PUBLISHABLE_KEY;
 if(mode==='production'){url||=production.url;publishableKey||=production.publishableKey}
 else if(mode==='development'&&!url&&!publishableKey){url='http://127.0.0.1:54321';publishableKey='sb_publishable_local_development_only'}
 if(!url||!publishableKey)throw Error('Configure URL e chave publicável próprias deste ambiente.');
 let parsed;try{parsed=new URL(url)}catch{throw Error('URL do ambiente inválida.')}
 const loopback=['localhost','127.0.0.1','[::1]'].includes(parsed.hostname);
 if(parsed.username||parsed.password||parsed.search||parsed.hash||!['','/'].includes(parsed.pathname)||(!loopback&&parsed.protocol!=='https:')||(loopback&&mode!=='development'))throw Error('Use a origem HTTPS do projeto ou um servidor local de desenvolvimento.');
 const productionOrigin=new URL(production.url).origin;
 if(mode!=='production'&&parsed.origin===productionOrigin)throw Error('Desenvolvimento e homologação não podem usar o Supabase de produção.');
 if(mode==='production'&&parsed.origin!==productionOrigin)throw Error('O projeto de produção não pode ser substituído por variável de ambiente.');
 if(mode==='staging'&&(!/^[a-z0-9]{20}$/.test(env.PELLUM_STAGING_PROJECT_REF||'')||parsed.hostname!==env.PELLUM_STAGING_PROJECT_REF+'.supabase.co'))throw Error('Confirme o identificador exclusivo do projeto de homologação.');
 let legacyRole=null;
 if(publishableKey.startsWith('eyJ'))try{legacyRole=JSON.parse(Buffer.from(publishableKey.split('.')[1],'base64url').toString()).role}catch{}
 if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)&&legacyRole!=='anon')throw Error('Use somente chave publicável de cliente. Chaves administrativas são proibidas.');
 return {mode,url:parsed.origin,publishableKey,publicOrigin:resolvePublicOrigin(env.PELLUM_PUBLIC_ORIGIN)};
}
