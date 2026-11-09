import {readFile} from 'node:fs/promises';
import {resolveBuildConfig} from '../standalone/src/build-config.js';
import {mediaError} from './files.js';
export async function resolveMediaServerConfig(env){
 if(env.PELLUM_MEDIA_ENABLED!=='true')return {enabled:false};
 const production=JSON.parse(await readFile(new URL('../standalone/supabase.public.json',import.meta.url),'utf8'));
 const build=resolveBuildConfig(env,production);
 // No production media activation is part of this phase. Promotion requires a
 // separately reviewed change after the staging acceptance criteria pass.
 if(build.mode==='production')throw mediaError('MEDIA_DISABLED',503);
 let origin;try{origin=new URL(env.PELLUM_APP_ORIGIN)}catch{throw mediaError('MEDIA_DISABLED',503)}
 if(origin.origin!==env.PELLUM_APP_ORIGIN||origin.username||origin.password||!['https:','http:'].includes(origin.protocol)||origin.protocol==='http:'&&!(build.mode==='development'&&['127.0.0.1','localhost'].includes(origin.hostname)))throw mediaError('MEDIA_DISABLED',503);
 const serverKey=env.PELLUM_SUPABASE_SERVER_KEY||'';let role;
 if(serverKey.startsWith('eyJ'))try{role=JSON.parse(Buffer.from(serverKey.split('.')[1],'base64url')).role}catch{}
 if(!serverKey.startsWith('sb_secret_')&&role!=='service_role')throw mediaError('MEDIA_DISABLED',503);
 return {enabled:true,url:build.url,publicKey:build.publishableKey,serverKey,origin:origin.origin,development:build.mode==='development',clamdUrl:env.PELLUM_CLAMD_URL};
}
