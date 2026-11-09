import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {createMediaFixture} from './clinical/media-fixture.mjs';
import {sha256} from '../clinical-server/files.js';
const require=createRequire(new URL('../clinical-server/package.json',import.meta.url)),sharp=require('sharp');
const env=await createMediaFixture();const {db,ids,request,login,rpc,objects}=env;let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
const bytes=await sharp({create:{width:60,height:40,channels:3,background:'#345e4d'}}).jpeg().toBuffer();
const file=new File([bytes],'ficticia.jpg',{type:'image/jpeg'});
const body={clinic:ids.clinic,patient:'p1',id:randomUUID(),capturedAt:'2026-01-01T12:00:00Z',stage:'before',region:'QA',clinicalBasis:'care_basis_reviewed',basisReference:'Decisão fictícia de QA',processingBasisReference:'Armazenamento fictício QA'};
try{
 eq((await request({...body,action:'list'},{token:'outsider-aal1'})).status,403);
 eq((await request(body,{file:new File(['<svg>'], 'fake.jpg',{type:'image/jpeg'})})).status,422);
 env.failNextPut();eq((await request(body,{file})).status,503);eq(objects.size,0);
 eq((await request(body,{file})).status,200);eq(objects.size,2);
 eq((await request(body,{file})).status,200);eq(objects.size,2);
 const list=await (await request({...body,action:'list'})).json();eq(list.length,1);eq(list[0].originalSha256,sha256(bytes));
 const viewed=await (await request({...body,action:'view'})).json();eq(viewed.expiresIn,30);eq(!!env.readSigned(new URL(viewed.url).pathname),true);
 eq((await request({...body,action:'view',clinic:ids.otherClinic},{token:'outsider-aal1'})).status,403);
 eq((await request({...body,action:'export'})).status,403);
 const exported=await request({...body,action:'export'},{token:'owner-aal2'});eq(exported.status,200);eq(Buffer.from(await exported.arrayBuffer()).equals(bytes),true);eq(exported.headers.get('content-disposition').startsWith('attachment;'),true);
 eq((await request({...body,action:'publicity_revoke'})).status,200);eq((await (await request({...body,action:'list'})).json())[0].publicityRevoked,true);
 const lost={...body,id:randomUUID(),notes:'Resposta perdida'};env.loseNextResponse();eq((await request(lost,{file})).status,503);eq((await request(lost,{file})).status,200);eq((await (await request({...body,action:'list'})).json()).length,2);
 const revoked={...body,id:randomUUID(),notes:'Revogação durante processamento'};env.revokeDuringPut();eq((await request(revoked,{file})).status,403);
 eq((await request({...body,action:'view'})).status,403);
 // Revocation denies new URLs; an already emitted URL remains valid until its
 // short expiry. This is intentional and not called instantaneous revocation.
 eq(!!env.readSigned(new URL(viewed.url).pathname),true);env.advance(30001);eq(env.readSigned(new URL(viewed.url).pathname),null);
 eq(JSON.stringify(env.logs).includes('Decisão fictícia'),false);eq(JSON.stringify(env.logs).includes('Bearer'),false);
 await db.exec('reset role');eq((await db.query("select state from public.aura_clinical_media where id=$1",[revoked.id])).rows[0].state,'pending');
 // Genuine local database restore plus exact original/display bytes copied to
 // a second local store. This does not exercise a remote backup service.
 const dump=await db.dumpDataDir(),copied=new Map([...objects].map(([key,value])=>[key,{...value,bytes:Buffer.from(value.bytes)}]));
 const {PGlite}=await import('../tests/clinical/node_modules/@electric-sql/pglite/dist/index.js');const restored=new PGlite({loadDataDir:dump});
 try{const rows=(await restored.query("select id,clinic_id,original_sha256,display_sha256 from public.aura_clinical_media where state='ready'")).rows;eq(rows.length,2);for(const row of rows){eq(sha256(copied.get('pellum-clinical-originals/'+row.clinic_id+'/'+row.id+'/original').bytes),row.original_sha256);eq(sha256(copied.get('pellum-clinical-display/'+row.clinic_id+'/'+row.id+'/display.jpg').bytes),row.display_sha256)}}finally{await restored.close()}
 console.log(`PASS: ${checks} media integration checks; real handler/decoder/PostgreSQL, upload failures, idempotent recovery, export hashes, revoked access and local DB/object restore. Auth, antivirus and Storage transport are explicit doubles; no remote validation.`);
}finally{await db.close()}
