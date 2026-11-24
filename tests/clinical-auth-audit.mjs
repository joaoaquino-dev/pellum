import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createClinicalTestDatabase} from './clinical-database.mjs';
const {db,ids,login,rpc}=await createClinicalTestDatabase();let checks=0;
const reject=async(fn,code='42501')=>{await assert.rejects(fn,e=>e.code===code);checks++};
const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
const admin=async sql=>{await db.exec('reset role');await db.exec(sql);await login()};
try{
 await rpc('grant',{userId:ids.owner,professionalId:0,profession:'enfermagem',write:true,export:true,enabled:true,requestId:randomUUID()});
 eq((await rpc('list')).length,0);
 for(const change of ["update auth.users set email_confirmed_at=null where email='owner@example.invalid'","update auth.users set is_anonymous=true where email='owner@example.invalid'","update auth.users set banned_until=now()+interval '1 day' where email='owner@example.invalid'","update auth.sessions set not_after=now()-interval '1 minute'","update aura_private.licenses set expires_at=now()-interval '1 minute' where email='owner@example.invalid'","update aura_private.licenses set status='pending' where email='owner@example.invalid'","update aura_private.licenses set status='suspended' where email='owner@example.invalid'"]){
  await admin(change);await reject(()=>rpc('list'));
  await admin("update auth.users set email_confirmed_at=now(),is_anonymous=false,banned_until=null; update auth.sessions set not_after=null; update aura_private.licenses set expires_at=null,status='active'");
 }
 await admin(`insert into auth.mfa_factors(user_id,status) values('${ids.owner}','unverified')`);eq((await rpc('list')).length,0);
 await admin("update auth.mfa_factors set status='verified'");await reject(()=>rpc('list'));await login('owner','aal2');eq((await rpc('list')).length,0);
 await admin('delete from auth.mfa_factors');eq((await rpc('list')).length,0);
 const source=await readFile('supabase/migrations/20261028202415_owner_user_deletion.sql','utf8');
 const definition=source.match(/CREATE OR REPLACE FUNCTION aura_private\.admin_rpc[\s\S]*?\$function\$\s*;/i)?.[0];assert.ok(definition);
 await admin(definition);await admin('revoke all on function aura_private.admin_rpc(text,jsonb) from public; grant execute on function aura_private.admin_rpc(text,jsonb) to authenticated');
 const adminRpc=()=>db.query("select aura_private.admin_rpc('unrecognized_action','{}')");
 await reject(adminRpc);
 await admin("insert into aura_private.platform_admins values('owner@example.invalid',true)");await reject(adminRpc);
 await login('owner','aal2');await reject(adminRpc); // AAL2 claim without a verified factor is insufficient.
 await admin(`insert into auth.mfa_factors(user_id,status) values('${ids.owner}','verified')`);await login('owner','aal2');await reject(adminRpc,'22023');
 await login('other','aal2');await db.exec('reset role');
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:ids.other,session_id:ids.otherSession,aal:'aal2',email:'owner@example.invalid',user_metadata:{is_admin:true,role:'owner'}})]);await db.exec('set role authenticated');
 await reject(adminRpc);await reject(()=>rpc('list'));
 await admin(`delete from auth.sessions where id='${ids.session}'`);await reject(()=>rpc('list'));
 console.log(`PASS: ${checks} local authorization audit checks using existing identity/account/admin SQL, unconfirmed/anonymous/banned users, expired sessions/licenses, MFA, metadata spoofing and revoked sessions. No real Auth/SMTP or destructive account QA.`);
}finally{await db.close()}
