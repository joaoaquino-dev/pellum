// Real repository SQL in disposable local PostgreSQL; no remote fixtures.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createFullSchemaFixture} from './clinical/full-schema-fixture.mjs';
const {db,accounts,login,rpc}=await createFullSchemaFixture(['administrator','owner','manager','outsider']);let checks=0,clinic;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
const reject=async(fn,code,message)=>{await assert.rejects(fn,e=>e.code===code&&(!message||e.message===message));checks++};
const call=(action,body={},target=clinic)=>rpc('aura_rpc',[action,target,JSON.stringify({...body,requestId:body.requestId||randomUUID()})]);
const admin=(action,body={})=>rpc('aura_admin_rpc',[action,JSON.stringify(body)]);
try{
 for(const name of ['owner','manager','outsider'])await db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified')",[accounts[name].user]);
 await login('administrator','aal2');for(const name of ['owner','manager','outsider'])await admin('authorize',{email:accounts[name].email,max_clinics:1});
 await login('owner','aal2');clinic=(await call('create',{name:'QA proteção proprietária'})).id;
 await call('member',{email:accounts.manager.email});
 await login('manager','aal2');const requestId=randomUUID();
 await reject(()=>call('member',{email:accounts.owner.email,remove:true,requestId}),'42501','CLINIC_OWNER_MEMBERSHIP_PROTECTED');
 await reject(()=>call('member',{email:accounts.owner.email.toUpperCase(),remove:true}),'42501','CLINIC_OWNER_MEMBERSHIP_PROTECTED');
 await reject(()=>call('member',{email:accounts.owner.email,remove:true,requestId}),'42501','CLINIC_OWNER_MEMBERSHIP_PROTECTED');
 eq((await call('get')).members.length,2);
 const preview=await call('delete_preview');
 await reject(()=>call('delete_clinic',{preview,confirmation:preview.name,confirmed:true}),'42501','CLINIC_OWNER_REQUIRED');
 eq((await call('get')).clinic.id,clinic);
 await reject(()=>db.query('delete from public.aura_members where clinic_id=$1',[clinic]),'42501');
 await reject(()=>db.query('select aura_private.protect_clinic_owner_membership()'),'42501');
 // Even trusted SQL cannot detach/reassign the owner's membership while its
 // parent exists. Check rollback of a bulk mutation, not just one RPC branch.
 await db.exec('reset role');
 await reject(()=>db.query('update public.aura_members set email=$1 where clinic_id=$2 and email=$3',[accounts.outsider.email,clinic,accounts.owner.email]),'42501','CLINIC_OWNER_MEMBERSHIP_PROTECTED');
 await reject(()=>db.query('update public.aura_members set clinic_id=$1 where clinic_id=$2 and email=$3',[randomUUID(),clinic,accounts.owner.email]),'42501','CLINIC_OWNER_MEMBERSHIP_PROTECTED');
 await reject(()=>db.query('delete from public.aura_members where clinic_id=$1',[clinic]),'42501','CLINIC_OWNER_MEMBERSHIP_PROTECTED');
 eq((await db.query('select count(*)::int n from public.aura_members where clinic_id=$1',[clinic])).rows[0].n,2);
 eq((await db.query('select count(*)::int n from aura_private.request_results where request_id=$1',[requestId])).rows[0].n,0);
 await login('owner','aal2');eq((await call('get')).clinic.id,clinic);
 await call('member',{email:accounts.manager.email,remove:true});
 await login('manager','aal2');await reject(()=>call('get'),'42501');
 await login('owner','aal2');const ownerPreview=await call('delete_preview');eq((await call('delete_clinic',{preview:ownerPreview,confirmation:ownerPreview.name,confirmed:true})).deleted,true);
 await db.exec('reset role');eq((await db.query('select count(*)::int n from public.aura_members where clinic_id=$1',[clinic])).rows[0].n,0);
 // Preserve the existing explicit platform-admin account-deletion workflow for
 // a synthetic account and an empty clinic; no clinical retention is bypassed.
 await login('outsider','aal2');const disposable=(await call('create',{name:'QA conta descartável'},null)).id;
 await login('administrator','aal2');const account=(await admin('list')).licenses.find(l=>l.email===accounts.outsider.email);
 eq(account.owned_clinics[0].id,disposable);
 eq((await admin('delete_user',{email:accounts.outsider.email,user_id:accounts.outsider.user,confirmation:accounts.outsider.email,delete_owned_clinics:true,owned_clinics:account.owned_clinics})).ok,true);
 await db.exec('reset role');eq((await db.query('select count(*)::int n from public.aura_clinics where id=$1',[disposable])).rows[0].n,0);
 eq((await db.query('select count(*)::int n from public.aura_members where clinic_id=$1',[disposable])).rows[0].n,0);
 // The new guard must not weaken clinical retention for either the owner or
 // the platform administrator, even with exact deletion confirmations.
 await login('owner','aal2');clinic=(await call('create',{name:'QA retenção clínica'},null)).id;
 const retained=await call('get');retained.data.patients.push({id:'retained-patient',name:'Paciente fictícia',phone:'',note:''});await call('save',{data:retained.data,revision:retained.revision});
 await rpc('aura_clinical_rpc',['grant',clinic,'retained-patient',JSON.stringify({userId:accounts.owner.user,professionalId:0,profession:'outra',registry:'QA',write:true,enabled:true,requestId:randomUUID()})]);
 await rpc('aura_clinical_rpc',['save',clinic,'retained-patient',JSON.stringify({id:randomUUID(),version:0,kind:'evolution',status:'reviewed',occurredAt:'2026-11-09T12:00:00Z',payload:{summary:'Registro fictício retido'},requestId:randomUUID()})]);
 const retainedPreview=await call('delete_preview');await reject(()=>call('delete_clinic',{preview:retainedPreview,confirmation:retainedPreview.name,confirmed:true}),'23503');eq((await call('get')).clinic.id,clinic);
 await login('administrator','aal2');const protectedAccount=(await admin('list')).licenses.find(l=>l.email===accounts.owner.email);
 await reject(()=>admin('delete_user',{email:accounts.owner.email,user_id:accounts.owner.user,confirmation:accounts.owner.email,delete_owned_clinics:true,owned_clinics:protectedAccount.owned_clinics}),'23503');
 await login('owner','aal2');eq((await rpc('aura_clinical_rpc',['list',clinic,'retained-patient','{}'])).length,1);
 console.log(`PASS: ${checks} owner protection checks; removal/reassignment/bulk SQL/whole-clinic evasion blocked, rollback and owner access preserved, explicit owner deletion and platform-admin disposable-account cascade retained. Local SQL/Auth fixtures only.`);
}catch(error){throw Error('Owner protection QA: '+error.code+' '+error.message,{cause:error instanceof assert.AssertionError?error:undefined})}
finally{await db.close()}
