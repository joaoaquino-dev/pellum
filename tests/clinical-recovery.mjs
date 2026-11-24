import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createMediaFixture} from './clinical/media-fixture.mjs';
import {sealRecoveryPackage,openRecoveryPackage} from '../clinical-server/backup.js';
import {sha256} from '../clinical-server/files.js';
const require=createRequire(new URL('../clinical-server/package.json',import.meta.url)),sharp=require('sharp');
const env=await createMediaFixture();const {db,ids,request,objects,login,rpc}=env;let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++};const key=randomBytes(32),started=performance.now();
try{
 await db.exec('reset role');await db.exec(await readFile('supabase/migrations/20261109223043_clinical_documents.sql','utf8'));await login();
 const sourceId=randomUUID(),documentId=randomUUID();await rpc('save',{id:sourceId,version:0,kind:'evolution',status:'reviewed',occurredAt:'2026-01-01T12:00:00Z',payload:{summary:'Fonte clínica fictícia para recuperação'},requestId:randomUUID()});
 await db.query('select public.aura_clinical_document_rpc($1,$2,$3,$4)',['prepare',ids.clinic,'p1',JSON.stringify({id:documentId,entryId:sourceId,version:1,kind:'professional_record'})]);
 const photo=await sharp({create:{width:30,height:20,channels:3,background:'#c39960'}}).jpeg().toBuffer();
 const metadata={clinic:ids.clinic,patient:'p1',id:randomUUID(),capturedAt:'2026-01-01T12:00:00Z',stage:'before',clinicalBasis:'care_basis_reviewed',basisReference:'Referência clínica fictícia',processingBasisReference:'Referência de guarda fictícia'};
 eq((await request(metadata,{file:new File([photo],'ficticia.jpg',{type:'image/jpeg'})})).status,200);
 await db.exec('reset role');const dump=await db.dumpDataDir();
 const entries=[{name:'database/local.pglite',bytes:Buffer.from(await dump.arrayBuffer())},...Array.from(objects,([name,value])=>({name:'objects/'+name,bytes:value.bytes})),{name:'migrations/clinical-media.sql',bytes:await readFile('supabase/migrations/20261109220831_clinical_media.sql')},{name:'config/environment.json',bytes:Buffer.from(JSON.stringify({environment:'isolated-synthetic-test',containsSecrets:false}))}];
 const encrypted=sealRecoveryPackage(entries,key);eq(encrypted.includes(Buffer.from('Referência clínica fictícia')),false);
 const recovered=openRecoveryPackage(encrypted,key);eq(recovered.files.length,entries.length);for(let i=0;i<entries.length;i++)eq(recovered.files[i].bytes.equals(entries[i].bytes),true);
 const tampered=Buffer.from(encrypted);tampered[tampered.length-30]^=1;assert.throws(()=>openRecoveryPackage(tampered,key));checks++;
 assert.throws(()=>openRecoveryPackage(encrypted,randomBytes(32)));checks++;
 assert.throws(()=>openRecoveryPackage(encrypted.subarray(0,-10),key));checks++;
 assert.throws(()=>sealRecoveryPackage([{name:'objects/../../escape',bytes:photo}],key));checks++;
 assert.throws(()=>sealRecoveryPackage([entries[0],entries[0]],key));checks++;
 const {PGlite}=await import('./clinical/node_modules/@electric-sql/pglite/dist/index.js');const restored=new PGlite({loadDataDir:new Blob([recovered.files.find(f=>f.name==='database/local.pglite').bytes])});
 try{
  const row=(await restored.query('select id,clinic_id,original_sha256,display_sha256 from public.aura_clinical_media')).rows[0];eq(row.id,metadata.id);
  const original=recovered.files.find(f=>f.name==='objects/pellum-clinical-originals/'+row.clinic_id+'/'+row.id+'/original');eq(sha256(original.bytes),row.original_sha256);
  const display=recovered.files.find(f=>f.name==='objects/pellum-clinical-display/'+row.clinic_id+'/'+row.id+'/display.jpg');eq(sha256(display.bytes),row.display_sha256);
  eq((await restored.query("select count(*)::int n from public.aura_clinical_media_events where action='ready'")).rows[0].n,1);
  eq((await restored.query('select source_snapshot from public.aura_clinical_documents where id=$1',[documentId])).rows[0].source_snapshot.version.payload.summary,'Fonte clínica fictícia para recuperação');
 }finally{await restored.close()}
 console.log(`PASS: ${checks} encrypted local recovery checks; AES-256-GCM, wrong key/tamper/truncation/path/duplicate rejection, real PostgreSQL restore and original/display hashes. Synthetic local exercise only (${Math.round(performance.now()-started)} ms); external backup/RPO/RTO not validated.`);
}finally{key.fill(0);await db.close()}
