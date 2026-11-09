import {mediaError,sha256,MAX_FILE_BYTES} from './files.js';
const safePath=path=>path.split('/').map(encodeURIComponent).join('/');
export function createSupabaseGateway(config,{fetcher=fetch}={}){
 const request=async(path,{token=config.serverKey,method='GET',body,contentType='application/json',raw=false,extra={}}={})=>{
  let response;
  try{response=await fetcher(config.url+path,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{apikey:token===config.serverKey?config.serverKey:config.publicKey,Authorization:'Bearer '+token,...(body?{'Content-Type':contentType}:{}),...extra},body:body?(Buffer.isBuffer(body)?body:JSON.stringify(body)):undefined})}
  catch{throw mediaError('MEDIA_SERVICE_UNAVAILABLE',503)}
  if(!response.ok){let error;try{error=await response.json()}catch{}
   if(error?.message==='CLINICAL_MFA_REQUIRED')throw mediaError('CLINICAL_MFA_REQUIRED',403);
   if(response.status===401||response.status===403||error?.code==='42501')throw mediaError('MEDIA_ACCESS_DENIED',403);
   if(error?.code==='22023'||error?.code==='23514'||error?.code==='22P02')throw mediaError('MEDIA_INVALID',422);
   throw mediaError('MEDIA_SERVICE_UNAVAILABLE',503);
  }
  if(raw){
   if(Number(response.headers.get('content-length')||0)>MAX_FILE_BYTES)throw mediaError('MEDIA_INTEGRITY',409);
   const reader=response.body?.getReader();if(!reader)throw mediaError('MEDIA_INTEGRITY',409);const chunks=[];let size=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_FILE_BYTES){await reader.cancel();throw mediaError('MEDIA_INTEGRITY',409)}chunks.push(Buffer.from(value))}}finally{reader.releaseLock()}
   return Buffer.concat(chunks);
  }
  return response.status===204?null:response.json();
 };
 return {
  async authenticate(token){
   const user=await request('/auth/v1/user',{token});let claims;
   try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'))}catch{throw mediaError('MEDIA_ACCESS_DENIED',403)}
   // Token validity was checked by Auth above; decoded claims alone are never
   // used as proof. Database helpers additionally verify license/live session.
   if(!user?.id||claims.sub!==user.id||!claims.session_id||claims.exp*1000<=Date.now())throw mediaError('MEDIA_ACCESS_DENIED',403);
   return {token,claims};
  },
  rpc(ctx,action,clinic,patient,body={}){return request('/rest/v1/rpc/aura_clinical_media_rpc',{token:ctx.token,method:'POST',body:{p_action:action,p_clinic:clinic,p_patient:patient,p_body:body}})},
  commit(ctx,id,evidence){return request('/rest/v1/rpc/aura_clinical_media_commit',{method:'POST',body:{p_id:id,p_claims:ctx.claims,p_body:evidence}})},
  async putOnce(bucket,path,bytes,mime){
   // A retry never overwrites an original. If it already exists, compare bytes
   // before treating the previous storage step as recovered.
   try{await request('/storage/v1/object/'+bucket+'/'+safePath(path),{method:'POST',body:bytes,contentType:mime,extra:{'x-upsert':'false','cache-control':'no-store'}})}
   catch(error){const existing=await request('/storage/v1/object/authenticated/'+bucket+'/'+safePath(path),{raw:true});if(sha256(existing)!==sha256(bytes))throw mediaError('MEDIA_INTEGRITY',409)}
  },
  download(bucket,path){return request('/storage/v1/object/authenticated/'+bucket+'/'+safePath(path),{raw:true})},
  async signedUrl(bucket,path){const data=await request('/storage/v1/object/sign/'+bucket+'/'+safePath(path),{method:'POST',body:{expiresIn:30}});const signed=data.signedURL||data.signedUrl;if(typeof signed!=='string'||!signed.startsWith('/object/sign/'))throw mediaError('MEDIA_SERVICE_UNAVAILABLE',503);return config.url+'/storage/v1'+signed}
 };
}
