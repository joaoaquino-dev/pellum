// Actual local SQL repository, explicit provider/policy/crypto doubles. No
// provider account is configured and no signing request leaves this process.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PDFDocument} from '../clinical-server/node_modules/pdf-lib/cjs/index.js';
import {createMediaTestDatabase} from './clinical-media-database.mjs';
import {createSignatureCoordinator} from '../clinical-server/signatures.js';
const {db,ids,login,rpc}=await createMediaTestDatabase();let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++};const reject=async(fn,code)=>{await assert.rejects(fn,e=>e.code===code);checks++};
try{
 await db.exec('reset role');for(const file of ['20261109223043_clinical_documents.sql','20261110010851_clinical_document_reconciliation.sql'])await db.exec(await readFile('supabase/migrations/'+file,'utf8'));await login('owner','aal2');
 const docRpc=async(action,body={})=>(await db.query('select public.aura_clinical_document_rpc($1,$2,$3,$4) result',[action,ids.clinic,'p1',JSON.stringify(body)])).rows[0].result;
 const worker=async(name,args)=>{await db.exec('reset role');await db.exec('set role service_role');try{return (await db.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') result',args)).rows[0].result}finally{await login('owner','aal2')}};
 const entryId=randomUUID(),documentId=randomUUID();await rpc('save',{id:entryId,version:0,kind:'evolution',status:'reviewed',occurredAt:'2026-01-01T12:00:00Z',payload:{summary:'Fonte fictícia de QA'},requestId:randomUUID()});await docRpc('prepare',{id:documentId,entryId,version:1,kind:'professional_record'});
 const archive=new Map(),envelopes=new Map();let creations=0,polls=0,downloads=0,renders=0,lost=true,pollFailure=false,webhookFailure=false;
 const repository={async loadAuthorized(context,id){await login(context.name||'owner','aal2');const packet=await docRpc('export',{id}),list=await docRpc('list');return {kind:packet.kind,canonicalSource:packet.canonicalSource,sourceDigest:packet.source_digest,requiredSignature:packet.required_signature,state:list.find(doc=>doc.id===id).state,signers:[{id:'synthetic-professional'}]}},record:(id,provider,event,body)=>worker('aura_clinical_document_event',[id,provider,event,JSON.stringify(body)]),findEnvelope:(provider,id)=>worker('aura_clinical_document_envelope',[provider,id]),findDocumentEnvelope:id=>worker('aura_clinical_document_binding',[id])};
 const provider={name:'synthetic',supportsIdempotency:true,supportsProfile:async()=>true,async createEnvelope({documentId}){creations++;if(!envelopes.has(documentId))envelopes.set(documentId,{id:'envelope-'+documentId});if(lost){lost=false;throw Error('Sensitive provider details')}return envelopes.get(documentId)},async getEnvelopeStatus(){polls++;if(pollFailure)throw Error('Sensitive provider details');return {type:'provider_completed',revision:'stable-1'}},async verifyWebhook(){if(webhookFailure)throw Error('Sensitive provider details');return {authenticated:true,id:'x'.repeat(2000),envelopeId:'envelope-'+documentId,type:'provider_completed'}},async downloadCompleted(){downloads++;return {signed:Buffer.from('%PDF-synthetic-signed-artifact'),evidence:Buffer.from('Synthetic evidence only')}}};
 const renderer=async()=>{renders++;const pdf=await PDFDocument.create();pdf.addPage([100,100]);return Buffer.from(await pdf.save())};
 const immutable={async getPrepared(id){return archive.get(id+'/prepared')},async putImmutable(id,type,bytes,sha256){const key=id+'/'+type;if(archive.has(key))assert.equal(archive.get(key).sha256,sha256);else archive.set(key,{bytes:Buffer.from(bytes),sha256})}};
 const options={provider,repository,renderer,archive:immutable,policy:{approved:true,version:'synthetic-approval-only',allows:async()=>true}};
 const coordinator=createSignatureCoordinator(options);
 await reject(()=>coordinator.dispatch({},documentId),'SIGNATURE_PROVIDER_FAILED');eq(envelopes.size,1);eq((await docRpc('list'))[0].state,'dispatch_requested');
 eq((await coordinator.reconcile({},documentId)).needsDispatchRetry,true);eq(creations,1);
 eq((await coordinator.dispatch({},documentId)).state,'provider_created');eq(envelopes.size,1);eq(renders,1);eq(creations,2);
 await reject(()=>db.query('select public.aura_clinical_document_binding($1)',[documentId]),'42501');
 const before=polls;await reject(()=>coordinator.reconcile({name:'outsider'},documentId),'42501');eq(polls,before);await login('owner','aal2');
 pollFailure=true;await reject(()=>coordinator.reconcile({},documentId),'SIGNATURE_PROVIDER_FAILED');pollFailure=false;
 eq((await coordinator.reconcile({},documentId)).state,'received_unverified');eq(downloads,0);
 const unavailable=createSignatureCoordinator({...options,validator:{verify:async()=>({})}});await reject(()=>unavailable.reconcile({},documentId),'SIGNATURE_VALIDATION_UNAVAILABLE');eq((await docRpc('list'))[0].state,'received_unverified');
 const validated=createSignatureCoordinator({...options,validator:{verify:async()=>({contentMatches:true,allSignersVerified:true,professionalQualified:true})}});
 eq((await validated.reconcile({},documentId)).state,'verified');eq(archive.has(documentId+'/signed'),true);eq(archive.has(documentId+'/evidence'),true);
 const afterPolls=polls,afterDownloads=downloads;eq((await validated.reconcile({},documentId)).state,'verified');eq(polls,afterPolls);
 eq((await validated.handleWebhook(Buffer.from('synthetic'),{})).state,'verified');eq((await validated.handleWebhook(Buffer.from('synthetic'),{})).state,'verified');eq(downloads,afterDownloads);
 webhookFailure=true;await reject(()=>validated.handleWebhook(Buffer.from('synthetic'),{}),'SIGNATURE_WEBHOOK_INVALID');webhookFailure=false;
 await reject(()=>createSignatureCoordinator({...options,policy:{...options.policy,allows:async()=>false}}).dispatch({},documentId),'SIGNATURE_PROFILE_NOT_APPROVED');
 await reject(()=>createSignatureCoordinator({...options,provider:{...provider,supportsIdempotency:'true'}}).dispatch({},documentId),'SIGNATURE_NOT_CONFIGURED');
 console.log(`PASS: ${checks} reconciliation checks; real SQL binding/state, uncertain creation recovery without implicit resend, polling, temporary validation failure, long event IDs, duplicate terminal callbacks and asynchronous policy denial. Provider, approval and cryptographic verification are explicit doubles.`);
}finally{await db.close()}
