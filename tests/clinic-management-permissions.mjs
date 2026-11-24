// Characterization of existing broad clinic management, not approval of that
// product policy. Only synthetic fixtures; no changes to production permissions.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createFullSchemaFixture} from './clinical/full-schema-fixture.mjs';
const {db,accounts,login,rpc}=await createFullSchemaFixture(['administrator','owner','manager','outsider']);let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
const denied=async fn=>{await assert.rejects(fn,e=>e.code==='42501');checks++};
const admin=(action,body)=>rpc('aura_admin_rpc',[action,JSON.stringify(body)]);
let clinic;
const call=(action,body={})=>rpc('aura_rpc',[action,clinic,JSON.stringify({...body,requestId:body.requestId||randomUUID()})]);
try{
 for(const name of ['owner','manager','outsider'])await db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified')",[accounts[name].user]);
 await login('administrator','aal2');for(const name of ['owner','manager','outsider'])await admin('authorize',{email:accounts[name].email,max_clinics:1});
 await login('owner','aal2');clinic=(await rpc('aura_rpc',['create',null,JSON.stringify({name:'QA poderes de gestão',requestId:randomUUID()})])).id;
 eq((await call('member',{email:accounts.manager.email})).ok,true);
 const initial=await call('get');initial.data.patients.push({id:'patient-qa',name:'Paciente fictícia',phone:'',note:''});
 await call('save',{data:initial.data,revision:initial.revision,label:'Fixture fictícia'});
 await login('manager','aal2');let cloud=await call('get');eq(cloud.members.length,2);eq(cloud.data.patients.length,1);
 // Current manager can change the aggregate (including finance/stock) and read
 // history. Do not invent a restricted editor role from a displayed label.
 cloud.data.expenses.push({id:'expense-qa',name:'Despesa fictícia',value:10,date:'2026-11-09',owner:'shared'});
 eq((await call('save',{data:cloud.data,revision:cloud.revision,label:'Gestão fictícia'})).revision,2);
 eq((await call('history')).history.length,2);
 eq((await call('member',{email:accounts.outsider.email})).ok,true);
 await denied(()=>rpc('aura_admin_rpc',['list','{}']));
 await denied(()=>rpc('aura_clinical_rpc',['list',clinic,'patient-qa','{}']));
 await denied(()=>rpc('aura_clinical_rpc',['grant',clinic,'patient-qa',JSON.stringify({userId:accounts.manager.user,professionalId:0,profession:'outra',registry:'QA',write:true,enabled:true,requestId:randomUUID()})]));
 await login('outsider','aal2');eq((await call('get')).data.expenses.length,1);
 await login('owner','aal2');eq((await call('member',{email:accounts.outsider.email,remove:true})).ok,true);
 await login('outsider','aal2');await denied(()=>call('save',{data:cloud.data,revision:2}));
 await denied(()=>call('get'));
 await login('manager','aal2');await denied(()=>call('member',{email:accounts.owner.email,remove:true}));
 await login('owner','aal2');eq((await call('get')).data.expenses.length,1);
 console.log(`PASS: ${checks} management-scope checks; aggregate/history and non-owner membership management preserved; owner membership protected, clinical grants/platform admin denied, removed members lose access. Local SQL only; other broad legacy powers remain.`);
}finally{await db.close()}
