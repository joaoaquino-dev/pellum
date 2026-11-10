import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createMediaTestDatabase} from './clinical-media-database.mjs';
const {db,ids,login,mediaRpc,workerCommit}=await createMediaTestDatabase();let checks=0;
const metadata={id:randomUUID(),capturedAt:'2026-01-01T12:00:00Z',stage:'before',region:'QA',notes:'',clinicalBasis:'care_basis_reviewed',basisReference:'Base fictícia QA',processingBasisReference:'Guarda fictícia QA',mime:'image/jpeg',size:100,sha256:'a'.repeat(64)};
const reject=async fn=>{await assert.rejects(fn,e=>e.code==='54000');checks++};
try{
 await db.exec('reset role');await db.exec(await readFile('supabase/migrations/20261110003930_clinical_media_limits.sql','utf8'));await login();
 await reject(()=>mediaRpc('reserve',metadata));
 await db.exec('reset role');await db.query('insert into aura_private.clinical_media_limits(clinic_id,max_bytes,max_files,max_pending) values($1,5000000,2,1)',[ids.clinic]);await login();
 await mediaRpc('reserve',metadata);await mediaRpc('reserve',metadata);checks++;
 await reject(()=>mediaRpc('reserve',{...metadata,id:randomUUID()}));
 await workerCommit(metadata.id,{originalSha256:metadata.sha256,displaySha256:'b'.repeat(64),displaySize:80,width:50,height:40,scanEngine:'synthetic-test'});
 await mediaRpc('reserve',{...metadata,id:randomUUID()});checks++;
 await reject(()=>mediaRpc('reserve',{...metadata,id:randomUUID()}));
 await db.exec('reset role');const state=(await db.query('select * from aura_private.clinical_media_limits')).rows[0];assert.equal(state.file_count,2);assert.equal(state.pending_count,1);assert.equal(Number(state.reserved_bytes),4000280);checks+=3;
 await db.query('select aura_private.configure_clinical_media_limits($1,$2,$3,$4)',[ids.clinic,6000000,3,2]);
 const recalculated=(await db.query('select reserved_bytes from aura_private.clinical_media_limits')).rows[0];assert.equal(Number(recalculated.reserved_bytes),4000280);checks++;
 await login();const usage=(await db.query('select public.aura_clinical_media_usage($1) result',[ids.clinic])).rows[0].result;assert.equal(usage.files,2);checks++;
 await assert.rejects(()=>db.query('select public.aura_configure_media_limits($1,$2,$3,$4)',[ids.clinic,9999999,10,10]),e=>e.code==='42501');checks++;
 await login('other');await assert.rejects(()=>db.query('select public.aura_clinical_media_usage($1)',[ids.clinic]),e=>e.code==='42501');checks++;
 console.log(`PASS: ${checks} media budget checks; absent budget fails closed, pending/file/byte reservations, replay and completion accounting. Local PostgreSQL only.`);
}finally{await db.close()}
