// Exercise the existing admin SQL with synthetic accounts. No payments, mail,
// gateway, remote database or deletion of production accounts is involved.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createMediaTestDatabase} from './clinical-media-database.mjs';
const {db,ids,login,rpc}=await createMediaTestDatabase();let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
const rejects=async(fn,code='42501')=>{await assert.rejects(fn,e=>e.code===code);checks++};
const owner=()=>login('owner','aal2');
try{
 await db.exec('reset role');
 await db.exec(`alter table auth.users add column created_at timestamptz default now();
 alter table aura_private.licenses add column max_clinics integer default 3;
 alter table aura_private.licenses add column updated_at timestamptz default now();
 create unique index qa_licenses_email on aura_private.licenses(email);
 alter table storage.objects add column owner uuid;
 alter table storage.objects add column owner_id text;
 create table aura_private.platform_audit(id uuid default gen_random_uuid(),actor_id uuid,action text,target text,details jsonb,created_at timestamptz default now());`);
 const source=await readFile('supabase/migrations/20261028202415_owner_user_deletion.sql','utf8');
 const definition=source.match(/CREATE OR REPLACE FUNCTION aura_private\.admin_rpc[\s\S]*?\$function\$\s*;/i)?.[0];assert.ok(definition);await db.exec(definition);
 await db.exec('revoke all on function aura_private.admin_rpc(text,jsonb) from public; grant execute on function aura_private.admin_rpc(text,jsonb) to authenticated');
 await db.query("insert into aura_private.platform_admins values('owner@example.invalid',true)");await db.query("insert into auth.mfa_factors values($1,'verified')",[ids.owner]);await owner();
 const admin=async(action,body={})=>(await db.query('select aura_private.admin_rpc($1,$2) result',[action,JSON.stringify(body)])).rows[0].result;
 await rpc('grant',{userId:ids.other,professionalId:1,profession:'outra',write:true,export:false,enabled:true,requestId:randomUUID()});
 await db.exec('reset role');await db.exec("update aura_private.licenses set status='pending' where email='other@example.invalid'");await login('other');await rejects(()=>rpc('list'));
 await owner();eq((await admin('list')).licenses.length,3);eq((await admin('authorize',{email:'other@example.invalid',max_clinics:1,expires_at:new Date(Date.now()+30*86400000).toISOString()})).ok,true);
 await login('other');eq((await rpc('list')).length,0);await rejects(()=>admin('suspend',{email:'owner@example.invalid'}));
 await owner();eq((await admin('suspend',{email:'other@example.invalid'})).ok,true);await login('other');await rejects(()=>rpc('list'));
 await owner();eq((await admin('authorize',{email:'other@example.invalid',max_clinics:1})).ok,true);await login('other');await rejects(()=>rpc('list')); // Suspension revoked the old session; payment does not resurrect it.
 await db.exec('reset role');ids.otherSession=randomUUID();await db.query('insert into auth.sessions(id,user_id,created_at) values($1,$2,now())',[ids.otherSession,ids.other]);await login('other');eq((await rpc('list')).length,0);
 await owner();eq((await admin('revoke_sessions',{email:'other@example.invalid'})).ok,true);await login('other');await rejects(()=>rpc('list'));
 await db.exec('reset role');const audits=(await db.query('select action,details from aura_private.platform_audit')).rows;eq(audits.map(a=>a.action),['admin.authorize','admin.suspend','admin.authorize','admin.revoke_sessions']);eq(JSON.stringify(audits).includes('payload'),false);
 eq((await db.query('select count(*)::int n from public.aura_clinics')).rows[0].n,2);eq((await db.query('select count(*)::int n from public.aura_members')).rows[0].n,3);
 console.log(`PASS: ${checks} manual access administration checks using existing admin SQL; authorization, suspension, reactivation, fresh login, session revocation, audit and retained clinic/membership data. No payment service and no remote Auth validation.`);
}finally{await db.close()}
