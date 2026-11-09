import {resolveMediaServerConfig} from '../clinical-server/config.js';
import {createSupabaseGateway} from '../clinical-server/supabase-gateway.js';
import {createClamdScanner} from '../clinical-server/clamd.js';
import {createMediaHandler} from '../clinical-server/media-handler.js';
export async function POST(request){
 try{
  const config=await resolveMediaServerConfig(process.env);
  const gateway=config.enabled?createSupabaseGateway(config):null;
  const scan=config.enabled?createClamdScanner(config.clamdUrl,{development:config.development}):null;
  // Only fixed operational codes are logged; never requests, tokens or errors.
  return createMediaHandler({gateway,scan,enabled:config.enabled,origin:config.origin,logger:event=>console.warn(JSON.stringify(event))})(request);
 }catch{return new Response(JSON.stringify({code:'MEDIA_DISABLED',error:'Fotografias e anexos aguardam configuração segura neste ambiente.'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})}
}
