import {mediaError,MAX_FILE_BYTES,processClinicalFile,sha256} from './files.js';
const messages={MEDIA_DISABLED:'Fotografias e anexos ainda aguardam configuração segura neste ambiente.',MEDIA_ACCESS_DENIED:'Acesso clínico não autorizado. Confira a sessão e as permissões.',CLINICAL_MFA_REQUIRED:'Confirme a autenticação em duas etapas para exportar.',FILE_SIZE:'Use um arquivo de até 4 MB.',FILE_TYPE:'Use uma fotografia JPEG, PNG ou WebP, ou um PDF compatível.',FILE_INVALID:'Não foi possível validar o arquivo. Confira o formato e tente outro arquivo.',FILE_REJECTED:'O arquivo foi recusado pela verificação de segurança.',PDF_ACTIVE_CONTENT:'O PDF contém recursos ativos e não pode ser anexado.',PDF_UNSUPPORTED:'Use um PDF sem proteção e com até 100 páginas.',IMAGE_UNSUPPORTED:'Use uma imagem estática compatível.',MEDIA_INVALID:'Confira os dados do arquivo e a sessão clínica.',MEDIA_INTEGRITY:'O arquivo não corresponde ao registro de integridade.',SCANNER_UNAVAILABLE:'A verificação de segurança está indisponível. O arquivo não foi liberado.'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
async function boundedBody(request,limit){
 if(Number(request.headers.get('content-length')||0)>limit)throw mediaError('FILE_SIZE',413);
 const reader=request.body?.getReader();if(!reader)return Buffer.alloc(0);const chunks=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();throw mediaError('FILE_SIZE',413)}chunks.push(Buffer.from(value))}}finally{reader.releaseLock()}
 return Buffer.concat(chunks);
}
export function createMediaHandler({gateway,scan,enabled=false,origin,logger=()=>{},processor=processClinicalFile}){
 return async request=>{
  try{
   if(!enabled)throw mediaError('MEDIA_DISABLED',503);
   if(request.method!=='POST')return json({error:'Método não permitido.'},405);
   const requestedOrigin=request.headers.get('origin'),allowedOrigin=typeof origin==='function'?origin():origin;if(requestedOrigin&&requestedOrigin!==allowedOrigin)throw mediaError('MEDIA_ACCESS_DENIED',403);
   const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];if(!token)throw mediaError('MEDIA_ACCESS_DENIED',403);
   const ctx=await gateway.authenticate(token);
   const multipart=request.headers.get('content-type')?.startsWith('multipart/form-data;');
   const raw=await boundedBody(request,multipart?MAX_FILE_BYTES+10000:8000);
   let b,file;
   try{
    if(multipart){const form=await new Request('http://localhost',{method:'POST',headers:{'content-type':request.headers.get('content-type')},body:raw}).formData();b=JSON.parse(form.get('metadata'));file=form.get('file');if(form.getAll('file').length!==1||!file||typeof file.arrayBuffer!=='function')throw Error('Invalid file')}
    else b=JSON.parse(raw.toString('utf8'));
   }catch{throw mediaError('MEDIA_INVALID')}
   if(!b||typeof b!=='object'||!/^[-a-f0-9]{36}$/.test(b.clinic||'')||!/^[A-Za-z0-9_-]{1,80}$/.test(b.patient||''))throw mediaError('MEDIA_INVALID');
   if(multipart){
    await gateway.rpc(ctx,'authorize_upload',b.clinic,b.patient);
    if(!/^[a-f0-9-]{36}$/.test(b.id||''))throw mediaError('MEDIA_INVALID');
    const bytes=Buffer.from(await file.arrayBuffer());
    const processed=await processor(bytes,{name:file.name,mime:file.type,scan});
    const reservation=await gateway.rpc(ctx,'reserve',b.clinic,b.patient,{id:b.id,entryId:b.entryId||'',capturedAt:b.capturedAt,stage:b.stage,region:b.region||'',notes:b.notes||'',clinicalBasis:b.clinicalBasis,basisReference:b.basisReference,processingBasisReference:b.processingBasisReference,mime:processed.mime,size:bytes.length,sha256:processed.evidence.originalSha256});
    if(reservation.state==='ready')return json({id:b.id,state:'ready'});
    const prefix=b.clinic+'/'+b.id;
    await gateway.putOnce('pellum-clinical-originals',prefix+'/original',bytes,processed.mime);
    if(processed.display)await gateway.putOnce('pellum-clinical-display',prefix+'/display.jpg',processed.display,'image/jpeg');
    // Reauthorization is performed again by the commit function after slow AV
    // and storage work. Failure leaves a private, non-visible pending object.
    return json(await gateway.commit(ctx,b.id,processed.evidence));
   }
   if(!['list','view','export','publicity_revoke'].includes(b.action))throw mediaError('MEDIA_INVALID');
   const result=await gateway.rpc(ctx,b.action,b.clinic,b.patient,b.action==='list'?{before:b.before,beforeId:b.beforeId}:{id:b.id});
   if(b.action==='view')return json({url:await gateway.signedUrl(result.bucket,result.path),expiresIn:30});
   if(b.action==='export'){
    const bytes=await gateway.download(result.bucket,result.path);if(sha256(bytes)!==result.sha256)throw mediaError('MEDIA_INTEGRITY',409);
    const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'}[result.mime];
    return new Response(bytes,{headers:{'Content-Type':result.mime,'Content-Disposition':'attachment; filename="pellum-arquivo.'+extension+'"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Referrer-Policy':'no-referrer'}});
   }
   if(b.action==='publicity_revoke')return json({ok:true});
   return json(result);
  }catch(error){const code=messages[error.code]?error.code:'MEDIA_SERVICE_UNAVAILABLE';logger({event:'clinical_media_failed',code});return json({code,error:messages[code]||'Não foi possível concluir. Tente novamente.'},error.status||503)}
 };
}
