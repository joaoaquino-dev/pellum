import {sha256,mediaError} from './files.js';
// No provider, renderer, signature validator or outbound delivery is configured
// by default. Provider adapters must verify their own webhook protocol.
export function createSignatureCoordinator({provider,repository,renderer,validator,archive,policy}={}){
 const configured=()=>{if(!provider?.name||!/^[a-z][a-z0-9_-]{1,39}$/.test(provider.name)||provider.supportsIdempotency!==true||typeof repository?.loadAuthorized!=='function'||typeof repository.record!=='function'||typeof renderer!=='function'||typeof archive?.getPrepared!=='function'||typeof archive.putImmutable!=='function'||policy?.approved!==true||!policy.version||typeof policy.allows!=='function'||typeof provider.supportsProfile!=='function')throw mediaError('SIGNATURE_NOT_CONFIGURED',503)};
 const terminal=new Set(['verified','refused','expired','cancelled','validation_failed']);
 const eventKey=(kind,id)=>kind+':'+sha256(Buffer.from(String(id),'utf8'));
 function checkEvent(event){if(!event||typeof event.id!=='string'||!event.id||event.id.length>2000||typeof event.envelopeId!=='string'||!event.envelopeId||event.envelopeId.length>200||typeof event.type!=='string'||!event.type||event.type.length>80)throw mediaError('SIGNATURE_WEBHOOK_INVALID',403)}
 async function receive(document,event,channel){checkEvent(event);
   const result=await repository.record(document.documentId,provider.name,eventKey('provider-'+channel,event.id),{type:event.type,sourceDigest:document.sourceDigest,preparedSha256:document.preparedSha256});
   if(terminal.has(document.state))return {...result,state:document.state};
   if(event.type!=='provider_completed'||result.state!=='received_unverified')return result;
   // Missing external cryptographic validator never upgrades a provider claim
   // to a verified signature. A later reconciliation may retry validation.
   if(!validator)return result;
   let artifacts;try{artifacts=await provider.downloadCompleted(event.envelopeId)}catch{throw mediaError('SIGNATURE_PROVIDER_FAILED',503)}
   if(!Buffer.isBuffer(artifacts?.signed)||!Buffer.isBuffer(artifacts?.evidence)||artifacts.signed.length>20_000_000||artifacts.evidence.length>5_000_000)throw mediaError('SIGNATURE_PROVIDER_FAILED',503);
   let validation;try{validation=await validator.verify({document,signed:artifacts.signed,evidence:artifacts.evidence})}catch{throw mediaError('SIGNATURE_VALIDATION_UNAVAILABLE',503)}
   const fields=['contentMatches','allSignersVerified',...(document.requiredSignature==='qualified'?['professionalQualified']:[])];
   if(!validation||validation.unavailable||fields.some(field=>typeof validation[field]!=='boolean'))throw mediaError('SIGNATURE_VALIDATION_UNAVAILABLE',503);
   if(!validation?.contentMatches||!validation.allSignersVerified||document.requiredSignature==='qualified'&&!validation.professionalQualified){
    return repository.record(document.documentId,provider.name,eventKey('invalid-'+channel,event.id),{type:'validation_failed',sourceDigest:document.sourceDigest,preparedSha256:document.preparedSha256});
   }
   const signedSha256=sha256(artifacts.signed),evidenceSha256=sha256(artifacts.evidence);
   await archive.putImmutable(document.documentId,'signed',artifacts.signed,signedSha256);
   await archive.putImmutable(document.documentId,'evidence',artifacts.evidence,evidenceSha256);
   return repository.record(document.documentId,provider.name,eventKey('verified-'+channel,event.id),{type:'verified',sourceDigest:document.sourceDigest,preparedSha256:document.preparedSha256,signedSha256,evidenceSha256,contentMatches:true,allSignersVerified:true,professionalQualified:!!validation.professionalQualified});
 }

 return {
  async dispatch(context,documentId){
   configured();const document=await repository.loadAuthorized(context,documentId);
   if(typeof document.canonicalSource!=='string'||document.canonicalSource.length>262144||sha256(Buffer.from(document.canonicalSource,'utf8'))!==document.sourceDigest)throw mediaError('SIGNATURE_DOCUMENT_INVALID',422);
   let source;try{source=JSON.parse(document.canonicalSource)}catch{throw mediaError('SIGNATURE_DOCUMENT_INVALID',422)}
   if(source.documentKind!==document.kind||source.requiredSignature!==document.requiredSignature)throw mediaError('SIGNATURE_DOCUMENT_INVALID',422);
   if(await policy.allows(document.kind,document.requiredSignature)!==true||await provider.supportsProfile(document.requiredSignature)!==true)throw mediaError('SIGNATURE_PROFILE_NOT_APPROVED',422);
   if(document.state!=='prepared'&&document.state!=='dispatch_requested')return {state:document.state};
   const previous=await archive.getPrepared(documentId),bytes=previous?.bytes||await renderer(document);if(!Buffer.isBuffer(bytes)||bytes.length>20_000_000||bytes.toString('ascii',0,5)!=='%PDF-')throw mediaError('SIGNATURE_DOCUMENT_INVALID',422);
   if(previous&&sha256(bytes)!==previous.sha256)throw mediaError('SIGNATURE_DOCUMENT_INVALID',422);
   const preparedSha256=sha256(bytes);
   await archive.putImmutable(documentId,'prepared',bytes,preparedSha256);
   await repository.record(documentId,provider.name,documentId+':dispatch',{type:'dispatch_requested',sourceDigest:document.sourceDigest,preparedSha256,policyApproved:true,policyVersion:policy.version});
   // The adapter must guarantee idempotence for the same immutable document ID.
   let envelope;try{envelope=await provider.createEnvelope({documentId,bytes,preparedSha256,idempotencyKey:documentId,signers:document.signers,profile:document.requiredSignature})}catch{throw mediaError('SIGNATURE_PROVIDER_FAILED',503)}
   if(!envelope?.id)throw mediaError('SIGNATURE_PROVIDER_FAILED',503);
   await repository.record(documentId,provider.name,documentId+':created',{type:'provider_created',sourceDigest:document.sourceDigest,preparedSha256,envelopeId:envelope.id});
   return {state:'provider_created'};
  },
  async handleWebhook(rawBody,headers){
   configured();if(!Buffer.isBuffer(rawBody)||rawBody.length>1000000)throw mediaError('SIGNATURE_WEBHOOK_INVALID',403);
   let event;try{event=await provider.verifyWebhook(rawBody,headers)}catch{throw mediaError('SIGNATURE_WEBHOOK_INVALID',403)}
   if(event?.authenticated!==true)throw mediaError('SIGNATURE_WEBHOOK_INVALID',403);checkEvent(event);
   const document=await repository.findEnvelope(provider.name,event.envelopeId);if(!document)throw mediaError('SIGNATURE_WEBHOOK_INVALID',403);
   return receive(document,event,'webhook');
  },
  async reconcile(context,documentId){
   configured();const authorized=await repository.loadAuthorized(context,documentId);
   if(terminal.has(authorized.state)||authorized.state==='prepared')return {state:authorized.state};
   if(typeof repository.findDocumentEnvelope!=='function')throw mediaError('SIGNATURE_NOT_CONFIGURED',503);
   const binding=await repository.findDocumentEnvelope(documentId);
   // No implicit dispatch or resend: a missing binding requires an explicit,
   // idempotent dispatch retry after the uncertain creation call.
   if(!binding)return {state:authorized.state,needsDispatchRetry:true};
   if(binding.documentId!==documentId||binding.provider!==provider.name||binding.sourceDigest!==authorized.sourceDigest)throw mediaError('SIGNATURE_DOCUMENT_INVALID',422);
   if(typeof provider.getEnvelopeStatus!=='function')throw mediaError('SIGNATURE_NOT_CONFIGURED',503);
   let status;try{status=await provider.getEnvelopeStatus(binding.envelopeId)}catch{throw mediaError('SIGNATURE_PROVIDER_FAILED',503)}
   if(!status||typeof status.type!=='string'||status.type.length>80)throw mediaError('SIGNATURE_PROVIDER_FAILED',503);
   const event={type:status.type,envelopeId:binding.envelopeId,id:JSON.stringify([binding.envelopeId,status.type,String(status.revision||'').slice(0,300)])};
   return receive(binding,event,'poll');
  }
 };
}
