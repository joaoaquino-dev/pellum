// Replay repository SQL in a new local PostgreSQL instance, not the linked
// project. Auth and Storage schemas below are fixtures, not their live services.
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from './clinical/node_modules/@electric-sql/pglite/dist/index.js';
const db=new PGlite();let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++},reject=async fn=>{await assert.rejects(fn,e=>e.code==='42501');checks++};
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;grant usage on schema auth,storage to authenticated,service_role;
 create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz,created_at timestamptz default now());
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),created_at timestamptz default now(),not_after timestamptz);
 create table auth.mfa_factors(id uuid default gen_random_uuid(),user_id uuid,status text);
 create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text);
 alter table storage.objects enable row level security;`);
 const migrations=(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
 for(const file of migrations){try{await db.exec(await readFile('supabase/migrations/'+file,'utf8'))}catch(error){throw Error('Local migration rehearsal: '+file+' · '+error.code+' · '+error.message)}}
 const accounts={};for(const name of ['administrator','solo_a','solo_b']){
  const user=randomUUID(),session=randomUUID(),email=name+'@example.invalid';accounts[name]={user,session,email};
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[user,email]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,user]);
 }
 const login=async(name,aal='aal1')=>{const account=accounts[name];await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:account.user,session_id:account.session,aal})]);await db.exec('set role authenticated')};
 const rpc=async(name,args)=>(await db.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') result',args)).rows[0].result;
 await db.query('insert into aura_private.platform_admins(email,enabled) values($1,true) on conflict(email) do update set enabled=true',[accounts.administrator.email]);
 await db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified')",[accounts.administrator.user]);
 await login('administrator','aal2');
 for(const name of ['solo_a','solo_b'])eq((await rpc('aura_admin_rpc',['authorize',JSON.stringify({email:accounts[name].email,max_clinics:1})])).ok,true);
 const clinics={};
 for(const name of ['solo_a','solo_b']){
  await login(name);const created=await rpc('aura_rpc',['create',null,JSON.stringify({name:'Clínica fictícia '+name,requestId:randomUUID()})]);clinics[name]=created.id;
  const cloud=await rpc('aura_rpc',['get',created.id,'{}']);eq(cloud.data.names.length,1);eq(cloud.members.length,1);
  cloud.data.patients.push({id:'same-patient-id',name:'Paciente fictícia '+name,phone:'',note:''});
  eq((await rpc('aura_rpc',['save',created.id,JSON.stringify({data:cloud.data,revision:cloud.revision,requestId:randomUUID(),label:'QA local'})])).revision,1);
  eq((await rpc('aura_clinical_rpc',['grant',created.id,'same-patient-id',JSON.stringify({userId:accounts[name].user,professionalId:0,profession:'outra',registry:'QA',write:true,export:false,enabled:true,requestId:randomUUID()})])).ok,true);
 }
 await login('solo_a');await reject(()=>rpc('aura_rpc',['get',clinics.solo_b,'{}']));await reject(()=>rpc('aura_clinical_rpc',['list',clinics.solo_b,'same-patient-id','{}']));
 const entryId=randomUUID();eq((await rpc('aura_clinical_rpc',['save',clinics.solo_a,'same-patient-id',JSON.stringify({id:entryId,version:0,kind:'evolution',status:'reviewed',occurredAt:'2026-01-01T12:00:00Z',payload:{summary:'Somente dados fictícios'},requestId:randomUUID()})])).version,1);
 const prepared=await rpc('aura_clinical_document_rpc',['prepare',clinics.solo_a,'same-patient-id',JSON.stringify({id:randomUUID(),kind:'professional_record',entryId,version:1})]);eq(prepared.state,'prepared');eq(prepared.requiredSignature,'advanced_or_qualified');
 await login('solo_b');eq((await rpc('aura_clinical_rpc',['list',clinics.solo_b,'same-patient-id','{}'])).length,0);await reject(()=>rpc('aura_clinical_document_rpc',['history',clinics.solo_b,'same-patient-id',JSON.stringify({id:prepared.id})]));
 await login('administrator','aal2');await reject(()=>rpc('aura_clinical_rpc',['list',clinics.solo_a,'same-patient-id','{}']));eq((await rpc('aura_admin_rpc',['suspend',JSON.stringify({email:accounts.solo_a.email})])).ok,true);
 await login('solo_a');await reject(()=>rpc('aura_clinical_rpc',['list',clinics.solo_a,'same-patient-id','{}']));
 await db.exec('reset role');eq((await db.query('select count(*)::int n from public.aura_clinical_entries')).rows[0].n,1);eq((await db.query('select count(*)::int n from public.aura_clinics')).rows[0].n,2);
 console.log(`PASS: ${checks} full-schema rehearsal checks across ${migrations.length} repository migrations; solo clinics, licensing, patient snapshot, clinical source, document, tenant isolation and suspension. Entirely local PostgreSQL; Auth/Storage services not validated.`);
}finally{await db.close()}
