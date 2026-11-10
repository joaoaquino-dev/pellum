// Offline only: reads a sanitized remote catalog capture and disposable fixtures.
// Never connects to Supabase, deploys, repairs history or exports business data.
import assert from 'node:assert/strict';
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {createFullSchemaFixture} from '../tests/clinical/full-schema-fixture.mjs';
const capture=JSON.parse(await readFile('security/release-catalog-2026-11-10.json','utf8'));
const files=(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
const pending=files.filter(f=>f.slice(0,14)>'20261103010054');
const baseline=files.filter(f=>!pending.includes(f));
const query=await readFile('scripts/release-catalog.sql','utf8');
const fixture=await createFullSchemaFixture(['administrator','owner'],{excludeMigrations:pending});
const {db,accounts,login,rpc}=fixture;
try{
 const local=(await db.query(query)).rows[0].catalog;
 const comparison={};
 for(const key of ['functions','tables','policies','columns','indexes','triggers','constraints','privileges']){
  const actual=local[key]||[],expected=capture.catalog[key]||[];
  comparison[key]={local:actual.length,remote:expected.length,identical:JSON.stringify(actual)===JSON.stringify(expected)};
 }
 const mismatches=Object.entries(comparison).filter(([,v])=>!v.identical).map(([k])=>k);
 const report={createdAt:new Date().toISOString(),captureDate:capture.observedAt,scope:'Offline baseline comparison and incremental migration rehearsal with synthetic local data. No remote writes.',comparison,mismatches,baseline,pending:[],migrationHistoryAliases:[{name:'patient_phone_validation',local:'20261029004713',remote:'20261029004749'},{name:'recoverable_procedure_catalog',local:'20261103000000',remote:'20261103010054'}],rehearsalPassed:false,releaseReady:false};
 await mkdir('outputs',{recursive:true});
 if(mismatches.length){await writeFile('outputs/release-preparation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(comparison));throw Error('Baseline differs in '+mismatches.join(', ')+'. Review before release. No history repair performed.')}
 await login('administrator','aal2');await rpc('aura_admin_rpc',['authorize',JSON.stringify({email:accounts.owner.email,max_clinics:1})]);
 await login('owner');const {id:clinic}=await rpc('aura_rpc',['create',null,JSON.stringify({name:'QA atualização preservada',requestId:randomUUID()})]);
 const initial=await rpc('aura_rpc',['get',clinic,'{}']);initial.data.patients=[{id:'patient-qa',name:'Paciente fictícia prévia',phone:'',note:''}];
 await rpc('aura_rpc',['save',clinic,JSON.stringify({data:initial.data,revision:initial.revision,requestId:randomUUID()})]);
 const before=await rpc('aura_rpc',['get',clinic,'{}']);await db.exec('reset role');
 for(const file of pending){const sql=await readFile('supabase/migrations/'+file,'utf8');await db.exec(sql);report.pending.push({file,sha256:createHash('sha256').update(sql).digest('hex')})}
 await login('owner');const after=await rpc('aura_rpc',['get',clinic,'{}']);assert.deepEqual(after.data,before.data);assert.equal(after.revision,before.revision);
 await rpc('aura_clinical_rpc',['grant',clinic,'patient-qa',JSON.stringify({userId:accounts.owner.user,professionalId:0,profession:'outra',registry:'QA',write:true,export:true,enabled:true,requestId:randomUUID()})]);
 const saved=await rpc('aura_clinical_rpc',['save',clinic,'patient-qa',JSON.stringify({id:randomUUID(),version:0,kind:'evolution',status:'reviewed',occurredAt:new Date(Date.now()-60000).toISOString(),payload:{summary:'Evolução fictícia após atualização',returnDate:'2099-01-01'},requestId:randomUUID()})]);
 const found=await rpc('aura_clinical_search',[clinic,'patient-qa',JSON.stringify({query:'evolucao'})]);assert.equal(found.items[0].id,saved.id);
 const returns=await rpc('aura_clinical_followup_rpc',['list',clinic,'patient-qa','{}']);assert.ok(JSON.stringify(returns).includes('2099-01-01'));
 await db.exec('reset role');const final=(await db.query(query)).rows[0].catalog;assert.equal(final.tables.every(t=>t.rls),true);
 report.rehearsalPassed=true;report.finalTables=final.tables.length;report.validation=['baseline catalog exact match','existing patient snapshot and revision preserved','new clinical write/search/followup','all application tables RLS enabled'];report.blockers=['Migration history aliases not repaired or approved for remote application','Real Auth/SMTP and two-clinic service validation pending','External consistent backup and restoration pending','Clinical/document review and explicit publication authorization pending'];
 await writeFile('outputs/release-preparation.json',JSON.stringify(report,null,2)+'\n');
 console.log(`PASS: exact baseline catalog comparison; ${pending.length} incremental migrations, existing synthetic patient snapshot/revision preserved, clinical write/search/followup and RLS. Release remains pending; no remote writes.`);
}finally{await db.close()}
