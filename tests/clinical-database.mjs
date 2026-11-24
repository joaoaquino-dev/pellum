// PostgreSQL WASM, entirely in memory. No remote URL, credentials, fixtures or patient data.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const modulePath=process.env.PELLUM_PGLITE_MODULE||path.resolve('tests/clinical/node_modules/@electric-sql/pglite/dist/index.js');
const {PGlite}=await import(pathToFileURL(modulePath).href);
export async function createClinicalTestDatabase(){
 const db=new PGlite();
 await db.exec(`
  create role anon; create role authenticated; create schema auth; create schema aura_private;
  grant usage on schema auth,aura_private to authenticated;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);
  create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz,not_after timestamptz);
  create table auth.mfa_factors(user_id uuid,status text);
  create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
  create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
  grant execute on function auth.uid(),auth.jwt() to authenticated;
  create table aura_private.licenses(email text,status text,expires_at timestamptz,revoked_before timestamptz default '-infinity');
  create table aura_private.platform_admins(email text,enabled boolean);
  create table aura_private.rate_limits(user_id uuid,bucket text,window_start timestamptz,n integer,primary key(user_id,bucket));
  create table public.aura_clinics(id uuid primary key,owner_id uuid references auth.users(id),name text,data jsonb,revision bigint default 0);
  create table public.aura_members(clinic_id uuid references public.aura_clinics(id) on delete cascade,email text,role text,primary key(clinic_id,email));
 `);
 // Use the existing authorization functions verbatim, not a permissive mock.
 const old=await readFile('supabase/migrations/20261028161248_licensing_admin_security.sql','utf8');
 for(const name of ['identity','account_active','can_access','is_admin','limit_request']){
  const fn=old.match(new RegExp('create (?:or replace )?function aura_private\\.'+name+'\\([\\s\\S]*?\\$\\$;','i'))?.[0];assert.ok(fn,name);await db.exec(fn);
 }
 await db.exec(await readFile('supabase/migrations/20261109211636_clinical_records.sql','utf8'));
 const ids={owner:randomUUID(),other:randomUUID(),outsider:randomUUID(),session:randomUUID(),otherSession:randomUUID(),outSession:randomUUID(),clinic:randomUUID(),otherClinic:randomUUID()};
 for(const [name,session] of [['owner','session'],['other','otherSession'],['outsider','outSession']]){
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[ids[name],name+'@example.invalid']);
  await db.query('insert into auth.sessions(id,user_id,created_at) values($1,$2,now())',[ids[session],ids[name]]);
  await db.query("insert into aura_private.licenses(email,status) values($1,'active')",[name+'@example.invalid']);
 }
 const snapshot={names:['Profissional fictícia A','Profissional fictícia B'],patients:[{id:'p1',name:'Paciente fictícia A'},{id:'p2',name:'Paciente fictícia B'}],appointments:[{id:'a1',patient:'p1'},{id:'a2',patient:'p2'}],products:[{id:'product1',name:'Produto fictício',lot:'LOTE-QA',expiry:'2028-01-01',unit:'ml',owner:0}],records:[{id:'r1',patient:'p1',materials:[{id:'product1',qty:1,cost:15,owner:0}]},{id:'r2',patient:'p2',materials:[]}]};
 for(const key of ['clinic','otherClinic'])await db.query('insert into public.aura_clinics(id,owner_id,name,data) values($1,$2,$3,$4)',[ids[key],key==='clinic'?ids.owner:ids.outsider,'Clínica fictícia',JSON.stringify(snapshot)]);
 await db.query("insert into public.aura_members values ($1,'owner@example.invalid','owner'),($1,'other@example.invalid','manager'),($2,'outsider@example.invalid','owner')",[ids.clinic,ids.otherClinic]);
 const login=async(name='owner',aal='aal1')=>{await db.exec('reset role');const session={owner:'session',other:'otherSession',outsider:'outSession'}[name];await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:ids[name],session_id:ids[session],aal})]);await db.exec('set role authenticated')};
 const rpc=async(action,body={},patient='p1',clinic=ids.clinic)=>(await db.query('select public.aura_clinical_rpc($1,$2,$3,$4) as result',[action,clinic,patient,JSON.stringify(body)])).rows[0].result;
 await login();
 return {db,ids,login,rpc,snapshot};
}
export async function runClinicalDatabaseTests(){
 const {db,ids,login,rpc}=await createClinicalTestDatabase();let checks=0;
 const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
 const rejects=async(fn,code)=>{await assert.rejects(fn,e=>e.code===code);checks++};
 const admin=async sql=>{await db.exec('reset role');await db.exec(sql);await login()};
 const grant=(id=ids.owner,extra={})=>rpc('grant',{userId:id,professionalId:0,profession:'enfermagem',registry:'COREN-QA',write:true,export:true,enabled:true,requestId:randomUUID(),...extra});
 const save=(extra={})=>({id:randomUUID(),version:0,kind:'anamnesis',status:'draft',occurredAt:'2026-01-01T12:00:00Z',payload:{summary:'Somente dados fictícios'},requestId:randomUUID(),...extra});
 try{
  await rejects(()=>rpc('open'),'42501'); // Owner has no implicit clinical access.
  await grant();eq((await rpc('open')).chart,null);eq((await rpc('open')).summary,[]);
  const body=save();const initial=await rpc('save',body);eq(initial.version,1);eq(await rpc('save',body),initial);
  await rejects(()=>rpc('save',{...body,payload:{summary:'Changed'}}),'22023');
  const list=await rpc('list');eq(list.length,1);eq(list[0].payload.summary,body.payload.summary);
  eq((await rpc('open')).chart.patient_id,'p1');
  await rejects(()=>rpc('list',{},'p2'),'42501');
  await rejects(()=>rpc('list',{},'p1',ids.otherClinic),'42501');
  await rejects(()=>rpc('save',save({payload:{summary:'Invalid link',appointmentId:'a2'}})),'22023');
  await rejects(()=>rpc('save',save({payload:{summary:'Invalid finance',financialRecordId:'r2'}})),'22023');
  await rejects(()=>rpc('save',save({payload:{summary:'Invalid plan',planId:randomUUID()}})),'22023');
  const questions=[{id:'risk',label:'Pergunta fictícia',type:'tri',required:true},{id:'detail',label:'Detalhes fictícios',type:'text',when:{field:'risk',equals:'yes'}}];
  await rejects(()=>rpc('save',save({payload:{summary:'Invalid answer',questions,answers:{risk:'maybe'}}})),'22023');
  await rejects(()=>rpc('save',save({status:'reviewed',payload:{summary:'Missing required',questions,answers:{}}})),'22023');
  await rejects(()=>rpc('save',save({payload:{summary:'Hidden answer',questions,answers:{risk:'no',detail:'Inconsistent'}}})),'22023');
  await rejects(()=>rpc('save',save({payload:{summary:'Forged signature',signed:true}})),'22023');
  for(const extra of [{summary:{}},{summary:'Invalid shape',questions:{}},{summary:'Invalid shape',answers:{}},{summary:'Invalid shape',birthDate:'tomorrow'},{summary:'Invalid shape',imagePurposes:'public'},{summary:'Invalid shape',nursing:['Only one']}])await rejects(()=>rpc('save',save({payload:extra})),'22023');
  const review={...body,version:1,status:'reviewed',requestId:randomUUID()};eq((await rpc('save',review)).version,2);
  await rejects(()=>rpc('save',{...body,version:2,requestId:randomUUID()}),'22023');
  await rejects(()=>rpc('save',{...review,requestId:randomUUID()}),'40001');
  eq((await rpc('save',{...review,version:2,status:'addendum',reason:'Correção documentada',payload:{summary:'Adendo fictício'},requestId:randomUUID()})).version,3);
  eq((await rpc('history',{id:body.id})).map(x=>x.status),['draft','reviewed','addendum']);
  const procedure=save({kind:'procedure',status:'reviewed',payload:{summary:'Procedimento fictício',financialRecordId:'r1',materials:[{lot:'FORGED'}]}});
  await rpc('save',procedure);const material=(await rpc('history',{id:procedure.id}))[0].payload.materials[0];eq(material.lot,'LOTE-QA');eq(material.cost,15);eq(material.qty,1);
  await admin(`update public.aura_clinics set data=jsonb_set(jsonb_set(data,'{products,0,name}','"Nome alterado"'),'{appointments}','[]') where id='${ids.clinic}'`);
  eq((await rpc('history',{id:procedure.id}))[0].payload.materials[0].name,'Produto fictício');
  eq((await rpc('save',{...procedure,version:1,status:'addendum',reason:'Complemento histórico',requestId:randomUUID()})).version,2);
  eq((await rpc('history',{id:procedure.id}))[1].payload.materials[0].name,'Produto fictício');
  eq((await rpc('history',{id:body.id})).length,3); // Calendar deletion cannot delete the chart.
  await rejects(()=>rpc('export'),'42501');await login('owner','aal2');const exported=await rpc('export');eq(exported.versions.length,5);
  for(const table of ['aura_clinical_entries','aura_clinical_versions','aura_clinical_patients','aura_clinical_access','aura_clinical_audit','aura_clinical_templates'])for(const command of [`select * from public.${table}`,`insert into public.${table} default values`,`update public.${table} set clinic_id=clinic_id`,`delete from public.${table}`])await rejects(()=>db.exec(command),'42501');
  await login();await grant(ids.other,{professionalId:1,profession:'outra',write:false,export:false});await login('other');eq((await rpc('list')).length,2);await rejects(()=>rpc('save',save()),'42501');await rejects(()=>rpc('access'),'42501');
  await login();await grant(ids.other,{professionalId:1,profession:'outra',write:true,export:false});await login('other');
  await rejects(()=>rpc('save',save({kind:'evaluation',payload:{summary:'Invalid nursing',nursing:['Privative content']}})),'42501');
  await rejects(()=>rpc('save',{...body,version:3,status:'addendum',reason:'Tentativa indevida',requestId:randomUUID()}),'42501');
  await login();await grant(ids.other,{enabled:false});await login('other');await rejects(()=>rpc('list'),'42501');
  await admin("insert into aura_private.platform_admins values('outsider@example.invalid',true)");await login('outsider');eq((await db.query('select aura_private.is_admin() as admin')).rows[0].admin,true);await rejects(()=>rpc('list'),'42501');
  await login();await admin(`delete from public.aura_members where clinic_id='${ids.clinic}' and email='other@example.invalid'`);await login('other');await rejects(()=>rpc('list'),'42501');
  await admin(`insert into public.aura_members values('${ids.clinic}','other@example.invalid','manager')`);await login('other');await rejects(()=>rpc('list'),'42501'); // Rejoining never revives a grant.
  await login();await admin("update aura_private.licenses set status='suspended' where email='owner@example.invalid'");await rejects(()=>rpc('list'),'42501');await admin("update aura_private.licenses set status='active' where email='owner@example.invalid'");
  await admin(`update public.aura_clinics set data=jsonb_set(data,'{inactivePros}','[0]') where id='${ids.clinic}'`);await rejects(()=>rpc('list'),'42501');await admin(`update public.aura_clinics set data=data-'inactivePros' where id='${ids.clinic}'`);
  const template={id:randomUUID(),version:0,name:'Modelo fictício',schema:[{id:'q1',label:'Pergunta fictícia',type:'tri'}],requestId:randomUUID()};await rejects(()=>rpc('save_template',{...template,professionalId:1}),'42501');eq((await rpc('save_template',template)).version,1);eq((await rpc('templates')).length,1);await rejects(()=>rpc('save_template',{...template,requestId:randomUUID()}),'40001');
  await db.exec('reset role');await db.exec('grant select,insert,update,delete on public.aura_clinical_entries,public.aura_clinical_patients,public.aura_clinical_versions,public.aura_clinical_access to authenticated');
  await login();eq((await db.query('select * from public.aura_clinical_entries')).rows.length,2);
  await login('outsider');
  for(const table of ['aura_clinical_entries','aura_clinical_patients','aura_clinical_versions','aura_clinical_access']){
   eq((await db.query('select * from public.'+table)).rows.length,0);
   eq((await db.query('update public.'+table+' set clinic_id=clinic_id returning clinic_id')).rows.length,0);
   eq((await db.query('delete from public.'+table+' returning clinic_id')).rows.length,0);
  }
  await rejects(()=>db.query("insert into public.aura_clinical_patients(clinic_id,patient_id) values($1,'p1')",[ids.clinic]),'42501');
  await db.exec('reset role');await db.exec('revoke all on public.aura_clinical_entries,public.aura_clinical_patients,public.aura_clinical_versions,public.aura_clinical_access from authenticated');
  await db.exec('reset role');
  await rejects(()=>db.query("update public.aura_clinical_versions set payload='{}'"),'42501');
  await rejects(()=>db.query('delete from public.aura_clinical_audit'),'42501');
  await rejects(()=>db.query('delete from public.aura_clinics where id=$1',[ids.clinic]),'23503');
  await rejects(()=>db.query("update public.aura_clinics set data=jsonb_set(data,'{patients}','[]') where id=$1",[ids.clinic]),'23503');
  const audits=(await db.query('select * from public.aura_clinical_audit')).rows;eq(audits.some(a=>a.action==='export'),true);eq(audits.some(a=>'payload' in a),false);
  const beforeRestore=(await db.query('select entry_id,version,payload,digest from public.aura_clinical_versions order by entry_id,version')).rows;
  const backup=await db.dumpDataDir();const restored=new PGlite({loadDataDir:backup});
  try{eq((await restored.query('select entry_id,version,payload,digest from public.aura_clinical_versions order by entry_id,version')).rows,beforeRestore);eq((await restored.query('select count(*)::int as n from public.aura_clinical_audit')).rows[0].n,audits.length)}finally{await restored.close()}
  // Seed a later page without exercising the request limiter 101 times. The summary
  // must still include the older reviewed anamnesis outside the first timeline page.
  await admin(`with inserted as (
   insert into public.aura_clinical_entries(id,clinic_id,patient_id,kind,author_id,professional_id,latest_version,created_at)
   select gen_random_uuid(),'${ids.clinic}','p1','evolution','${ids.owner}',0,1,now()+n*interval '1 second' from generate_series(1,101) n returning *
  ) insert into public.aura_clinical_versions(entry_id,clinic_id,patient_id,version,author_id,professional_id,professional_name,registry,occurred_at,status,payload,digest)
   select id,clinic_id,patient_id,1,author_id,0,'Fictícia','QA',now(),'draft','{"summary":"Página fictícia"}','qa' from inserted`);
  const pageOne=await rpc('list');eq(pageOne.length,100);eq(pageOne.every(e=>e.kind==='evolution'),true);
  eq((await rpc('open')).summary.map(e=>e.kind),['anamnesis']);
  const cursor=pageOne.at(-1);eq((await rpc('list',{before:cursor.createdAt,beforeId:cursor.id})).length,3);
  await login();await admin("update aura_private.licenses set revoked_before=now()+interval '1 hour' where email='owner@example.invalid'");await rejects(()=>rpc('list'),'42501');
  console.log(`PASS: ${checks} clinical PostgreSQL assertions; isolated in-memory database and database restore; no remote writes. Storage recovery not tested.`);
  return checks;
 }finally{await db.close()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await runClinicalDatabaseTests();
