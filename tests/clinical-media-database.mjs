import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {createClinicalTestDatabase} from './clinical-database.mjs';
export async function createMediaTestDatabase({withLimits=false}={}){
 const env=await createClinicalTestDatabase();const {db,login,ids,rpc}=env;
 await db.exec('reset role');
 await db.exec(`create role service_role bypassrls; create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to anon,authenticated;
 grant select,insert,update,delete on storage.objects to anon,authenticated;
 create policy deliberately_broad_existing_policy on storage.objects for all to anon,authenticated using(true) with check(true);`);
 await db.exec(await readFile('supabase/migrations/20261109220831_clinical_media.sql','utf8'));
 if(withLimits){
  await db.exec(await readFile('supabase/migrations/20261110003930_clinical_media_limits.sql','utf8'));
  await db.query('select aura_private.configure_clinical_media_limits($1,$2,$3,$4)',[ids.clinic,50000000,100,100]);
 }
 await login();await rpc('grant',{userId:ids.owner,professionalId:0,profession:'enfermagem',registry:'QA',write:true,export:true,enabled:true,requestId:randomUUID()});
 const mediaRpc=async(action,body={},patient='p1',clinic=ids.clinic)=>(await db.query('select public.aura_clinical_media_rpc($1,$2,$3,$4) as result',[action,clinic,patient,JSON.stringify(body)])).rows[0].result;
 const workerCommit=async(id,evidence,{name='owner',aal='aal1'}={})=>{
  await login(name,aal);const claims=(await db.query("select current_setting('request.jwt.claims') as value")).rows[0].value;
  await db.exec('reset role');await db.exec('set role service_role');
  try{return (await db.query('select public.aura_clinical_media_commit($1,$2,$3) as result',[id,claims,JSON.stringify(evidence)])).rows[0].result}finally{await login(name,aal)}
 };
 return {...env,mediaRpc,workerCommit};
}
export async function runMediaDatabaseTests(){
 const {db,ids,rpc,mediaRpc,workerCommit,login}=await createMediaTestDatabase();let checks=0;
 const eq=(a,b)=>{assert.deepEqual(a,b);checks++},reject=async(fn,code)=>{await assert.rejects(fn,e=>e.code===code);checks++};
 const metadata={id:randomUUID(),capturedAt:'2026-01-01T12:00:00Z',stage:'before',region:'Região fictícia',notes:'QA',clinicalBasis:'care_basis_reviewed',basisReference:'Referência fictícia QA',processingBasisReference:'Armazenamento fictício QA',mime:'image/jpeg',size:100,sha256:'a'.repeat(64)};
 const evidence={originalSha256:metadata.sha256,displaySha256:'b'.repeat(64),displaySize:80,width:50,height:40,scanEngine:'ClamAV-test-contract'};
 try{
  eq((await mediaRpc('reserve',metadata)).state,'pending');eq((await mediaRpc('reserve',metadata)).id,metadata.id);
  await reject(()=>mediaRpc('reserve',{...metadata,notes:'Changed'}),'22023');
  await reject(()=>mediaRpc('reserve',{...metadata,id:randomUUID(),entryId:randomUUID()}),'22023');
  await reject(()=>mediaRpc('reserve',{...metadata,id:randomUUID(),stage:'attachment'}),'22023');
  await reject(()=>mediaRpc('reserve',{...metadata,id:randomUUID(),size:4000001}),'22023');
  await reject(()=>mediaRpc('reserve',{...metadata,id:randomUUID(),clinicalBasis:'advertising'}),'22023');
  await reject(()=>mediaRpc('view',{id:metadata.id}),'42501');
  await reject(()=>db.query('select public.aura_clinical_media_commit($1,$2,$3)',[metadata.id,'{}',JSON.stringify(evidence)]),'42501');
  await reject(()=>workerCommit(metadata.id,{...evidence,originalSha256:'c'.repeat(64)}),'22023');
  eq((await workerCommit(metadata.id,evidence)).state,'ready');eq((await workerCommit(metadata.id,evidence)).state,'ready');
  eq((await mediaRpc('reserve',metadata)).state,'ready');eq((await mediaRpc('list')).length,1);
  const view=await mediaRpc('view',{id:metadata.id});eq(view.bucket,'pellum-clinical-display');eq(view.path,ids.clinic+'/'+metadata.id+'/display.jpg');
  await reject(()=>mediaRpc('export',{id:metadata.id}),'42501');await login('owner','aal2');eq((await mediaRpc('export',{id:metadata.id})).bucket,'pellum-clinical-originals');
  await mediaRpc('publicity_revoke',{id:metadata.id});await mediaRpc('publicity_revoke',{id:metadata.id});eq((await mediaRpc('list'))[0].publicityRevoked,true);eq((await mediaRpc('list'))[0].state,'ready');
  await login();await rpc('grant',{userId:ids.owner,professionalId:0,profession:'enfermagem',write:true,export:true,enabled:true,requestId:randomUUID()},'p2');
  await reject(()=>mediaRpc('view',{id:metadata.id},'p2'),'42501');
  await login('outsider');await rpc('grant',{userId:ids.outsider,professionalId:0,profession:'outra',write:true,export:true,enabled:true,requestId:randomUUID()},'p1',ids.otherClinic);
  eq((await mediaRpc('list',{},'p1',ids.otherClinic)).length,0);
  await reject(()=>mediaRpc('list'),'42501');await reject(()=>mediaRpc('view',{id:metadata.id},'p1',ids.otherClinic),'42501');await reject(()=>mediaRpc('publicity_revoke',{id:metadata.id}),'42501');
  await reject(()=>workerCommit(metadata.id,evidence,{name:'outsider'}),'42501');
  await db.exec('reset role');
  await db.query("insert into storage.objects(bucket_id,name) values('pellum-clinical-originals',$1),('pellum-clinical-display',$2)",[ids.clinic+'/'+metadata.id+'/original',view.path]);
  await login('outsider');
  eq((await db.query('select * from storage.objects')).rows.length,0);
  eq((await db.query("update storage.objects set name='forged' returning id")).rows.length,0);
  eq((await db.query('delete from storage.objects returning id')).rows.length,0);
  await reject(()=>db.query("insert into storage.objects(bucket_id,name) values('pellum-clinical-originals','known-id')"),'42501');
  for(const table of ['aura_clinical_media','aura_clinical_media_events'])for(const sql of [`select * from public.${table}`,`insert into public.${table} default values`,`update public.${table} set ${table.endsWith('events')?'media_id=media_id':'notes=notes'}`,`delete from public.${table}`])await reject(()=>db.exec(sql),'42501');
  await db.exec('reset role');await db.exec('grant select,update,delete,insert on public.aura_clinical_media to authenticated');await login('outsider');
  eq((await db.query('select * from public.aura_clinical_media')).rows.length,0);
  eq((await db.query('update public.aura_clinical_media set notes=notes returning id')).rows.length,0);
  await login();await rpc('grant',{userId:ids.owner,professionalId:0,profession:'enfermagem',write:true,export:true,enabled:false,requestId:randomUUID()});
  await reject(()=>mediaRpc('view',{id:metadata.id}),'42501');await reject(()=>workerCommit(metadata.id,evidence),'42501');
  await db.exec('reset role');eq((await db.query("select count(*)::int n from public.aura_clinical_media_events where action='publicity_revoked'")).rows[0].n,1);
  eq((await db.query("select count(*)::int n from public.aura_clinical_media_events where action='ready'")).rows[0].n,1);
  await reject(()=>db.exec('delete from public.aura_clinical_media_events'),'42501');
  console.log(`PASS: ${checks} media PostgreSQL assertions; private bucket policy under a broad permissive policy, tenant/patient isolation, direct CRUD denial, idempotence, worker-only commit, MFA and revocation. Storage schema is a local fixture, not remote Storage.`);
  return checks;
 }finally{await db.close()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await runMediaDatabaseTests();
