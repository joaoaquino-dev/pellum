// Replay repository SQL in a new local PostgreSQL instance, not the linked
// project. Auth and Storage schemas below are fixtures, not their live services.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createFullSchemaFixture} from './clinical/full-schema-fixture.mjs';
const {db,accounts,login,rpc,migrations}=await createFullSchemaFixture();let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++},reject=async fn=>{await assert.rejects(fn,e=>e.code==='42501');checks++};
try{
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
