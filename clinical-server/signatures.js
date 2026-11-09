import {sha256,mediaError} from './files.js';
// No provider, renderer, signature validator or outbound delivery is configured
// by default. Provider adapters must verify their own webhook protocol.
export function createSignatureCoordinator({provider,repository,renderer,validator,archive,policy}={}){
 const configured=()=>{if(!provider?.name||!provider.supportsIdempotency||!repository||!renderer||!archive?.getPrepared||!archive.putImmutable||!policy?.approved||!policy.version||typeof policy.allows!=='function')throw mediaError('SIGNATURE_NOT_CONFIGURED',503)};
 return {
  async dispatch(context,documentId){
   configured();const document=await repository.loadAuthorized(context,documentId);
   if(!policy.allows(document.kind,document.requiredSignature)||!provider.supportsProfile(document.requiredSignature))throw mediaError('SIGNATURE_PROFILE_NOT_APPROVED',422);
   if(document.state!=='prepared'&&document.state!=='dispatch_requested')return {state:document.state};
   const previous=await archive.getPrepared(documentId),bytes=previous?.bytes||await renderer(document);if(!Buffer.isBuffer(bytes)||bytes.length>20_000_000||bytes.toString('ascii',0,5)!=='%PDF-')throw mediaError('SIGNATURE_DOCUMENT_INVALID',422);
   if(previous&&sha256(bytes)!==previous.sha256)throw mediaError('SIGNATURE_DOCUMENT_INVALID',422);
   const preparedSha256=sha256(bytes);
   await archive.putImmutable(documentId,'prepared',bytes,preparedSha256);
   await repository.record(documentId,provider.name,documentId+':dispatch',{type:'dispatch_requested',sourceDigest:document.sourceDigest,preparedSha256,policyApproved:true,policyVersion:policy.version});
   // The adapter must guarantee idempotence for the same immutable document ID.
   const envelope=await provider.createEnvelope({documentId,bytes,preparedSha256,idempotencyKey:documentId,signers:document.signers,profile:document.requiredSignature});
   if(!envelope?.id)throw mediaError('SIGNATURE_PROVIDER_FAILED',503);
   await repository.record(documentId,provider.name,documentId+':created',{type:'provider_created',sourceDigest:document.sourceDigest,preparedSha256,envelopeId:envelope.id});
   return {state:'provider_created'};
  },
  async handleWebhook(rawBody,headers){
   configured();
   // Never trust a normalized payload supplied directly by the public caller.
   const event=await provider.verifyWebhook(rawBody,headers);
   if(!event?.authenticated||!event.id||!event.envelopeId)throw mediaError('SIGNATURE_WEBHOOK_INVALID',403);
   const document=await repository.findEnvelope(provider.name,event.envelopeId);if(!document)throw mediaError('SIGNATURE_WEBHOOK_INVALID',403);
   const result=await repository.record(document.documentId,provider.name,event.id,{type:event.type,sourceDigest:document.sourceDigest,preparedSha256:document.preparedSha256});
   if(event.type!=='provider_completed'||result.state!=='received_unverified')return result;
   // Missing external cryptographic validator never upgrades a provider claim
   // to a verified signature. A later reconciliation may retry validation.
   if(!validator)return result;
   const artifacts=await provider.downloadCompleted(event.envelopeId);
   if(!Buffer.isBuffer(artifacts?.signed)||!Buffer.isBuffer(artifacts?.evidence)||artifacts.signed.length>20_000_000||artifacts.evidence.length>5_000_000)throw mediaError('SIGNATURE_PROVIDER_FAILED',503);
   const validation=await validator.verify({document,signed:artifacts.signed,evidence:artifacts.evidence});
   if(!validation?.contentMatches||!validation.allSignersVerified||document.requiredSignature==='qualified'&&!validation.professionalQualified){
    return repository.record(document.documentId,provider.name,event.id+':invalid',{type:'validation_failed',sourceDigest:document.sourceDigest,preparedSha256:document.preparedSha256});
   }
   const signedSha256=sha256(artifacts.signed),evidenceSha256=sha256(artifacts.evidence);
   await archive.putImmutable(document.documentId,'signed',artifacts.signed,signedSha256);
   await archive.putImmutable(document.documentId,'evidence',artifacts.evidence,evidenceSha256);
   return repository.record(document.documentId,provider.name,event.id+':verified',{type:'verified',sourceDigest:document.sourceDigest,preparedSha256:document.preparedSha256,signedSha256,evidenceSha256,contentMatches:true,allSignersVerified:true,professionalQualified:!!validation.professionalQualified});
  }
 };
}
