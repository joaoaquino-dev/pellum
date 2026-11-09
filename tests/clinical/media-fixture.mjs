// Local integration fixture: real handler, decoder and PostgreSQL; Auth,
// antivirus verdict and Storage transport are explicit controlled doubles.
import {createMediaTestDatabase} from '../clinical-media-database.mjs';
import {createMediaHandler} from '../../clinical-server/media-handler.js';
import {sha256,mediaError} from '../../clinical-server/files.js';
import {randomUUID,randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
export async function createMediaFixture(){
 const env=await createMediaTestDatabase();const {db,ids,login,rpc,mediaRpc,workerCommit}=env;
 const objects=new Map(),signed=new Map(),logs=[];let origin='http://127.0.0.1',clock=Date.now(),failPut=false,revokeOnPut=false,loseResponse=false;
 const secret=randomBytes(32);
 const gateway={
  async authenticate(token){const [name,aal='aal1']=token.split('-');if(!['owner','other','outsider'].includes(name))throw mediaError('MEDIA_ACCESS_DENIED',403);return {name,aal}},
  async rpc(ctx,action,clinic,patient,body){await login(ctx.name,ctx.aal);try{return await mediaRpc(action,body,patient,clinic)}catch(error){throw mediaError(error.message==='CLINICAL_MFA_REQUIRED'?'CLINICAL_MFA_REQUIRED':error.code==='42501'?'MEDIA_ACCESS_DENIED':error.code==='22023'?'MEDIA_INVALID':'MEDIA_SERVICE_UNAVAILABLE',error.code==='42501'?403:422)}},
  async commit(ctx,id,evidence){try{const result=await workerCommit(id,evidence,{name:ctx.name,aal:ctx.aal});if(loseResponse){loseResponse=false;throw mediaError('MEDIA_SERVICE_UNAVAILABLE',503)}return result}catch(error){if(error.code==='42501')throw mediaError('MEDIA_ACCESS_DENIED',403);throw error}},
  async putOnce(bucket,path,bytes,mime){if(failPut){failPut=false;throw mediaError('MEDIA_SERVICE_UNAVAILABLE',503)}const key=bucket+'/'+path,previous=objects.get(key);if(previous&&sha256(previous.bytes)!==sha256(bytes))throw mediaError('MEDIA_INTEGRITY',409);if(!previous)objects.set(key,{bytes:Buffer.from(bytes),mime});if(revokeOnPut){revokeOnPut=false;await login();await rpc('grant',{userId:ids.owner,professionalId:0,profession:'enfermagem',write:true,export:true,enabled:false,requestId:randomUUID()})}},
  async download(bucket,path){const stored=objects.get(bucket+'/'+path);if(!stored)throw mediaError('MEDIA_SERVICE_UNAVAILABLE',503);return stored.bytes},
  async signedUrl(bucket,path){const id=randomUUID(),expiry=clock+30000,signature=createHmac('sha256',secret).update(id).digest('hex');signed.set(id,{key:bucket+'/'+path,expiry,signature});return origin+'/__private/'+id+'/'+signature}
 };
 const handler=createMediaHandler({gateway,enabled:true,origin:()=>origin,scan:async()=>({clean:true,engine:'explicit-antivirus-test-double'}),logger:event=>logs.push(event)});
 return {...env,gateway,objects,logs,handler,async request(body,{file,token='owner-aal1',url=origin+'/api/clinical-media'}={}){
  const headers={authorization:'Bearer '+token};let data;
  if(file){data=new FormData();data.set('metadata',JSON.stringify(body));data.set('file',file)}else{headers['content-type']='application/json';data=JSON.stringify(body)}
  return handler(new Request(url,{method:'POST',headers,body:data}));
 },setOrigin(value){origin=value},advance(ms){clock+=ms},failNextPut(){failPut=true},loseNextResponse(){loseResponse=true},revokeDuringPut(){revokeOnPut=true},readSigned(path){
  const [,id,signature]=path.split('/').slice(1),ticket=signed.get(id);if(!ticket||signature?.length!==ticket.signature.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(ticket.signature))||ticket.expiry<=clock)return null;return objects.get(ticket.key);
 }};
}
