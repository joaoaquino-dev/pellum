// Full current schema, synthetic data only. No remote connections or backup files.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {createStockFixture} from './clinical/stock-fixture.mjs';
import {PGlite} from './clinical/node_modules/@electric-sql/pglite/dist/index.js';
import {sealRecoveryPackage,openRecoveryPackage} from '../clinical-server/backup.js';
const {db,clinic,accounts,login,rpc,clinical,stock,snapshot}=await createStockFixture();
let restored,checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};const key=randomBytes(32);
const inventory=async database=>{
 const tables=(await database.query("select n.nspname schema,c.relname name from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and(n.nspname='aura_private' or(n.nspname='public' and c.relname like 'aura_%')) order by 1,2")).rows;
 const result=[];for(const {schema,name} of tables){const quoted='"'+schema.replaceAll('"','""')+'"."'+name.replaceAll('"','""')+'"';const {rows}=await database.query(`select count(*)::int count,md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' order by to_jsonb(t)::text),'')) digest from ${quoted} t`);result.push({schema,name,...rows[0]})}return result;
};
try{
 const modelId=randomUUID();await rpc('aura_clinical_form_template_rpc',['save',clinic,'patient-qa',JSON.stringify({id:modelId,version:0,kind:'procedure',name:'Modelo recuperação QA',procedure:'Peeling',professionalId:null,schema:[{id:'detail',label:'Resposta fictícia',type:'text'}],requestId:randomUUID()})]);
 const entry=await clinical('save',{id:randomUUID(),version:0,kind:'procedure',status:'reviewed',occurredAt:new Date(Date.now()-60000).toISOString(),payload:{summary:'Procedimento recuperação QA',procedure:'Peeling',formTemplateId:modelId,formTemplateVersion:1,formAnswers:{detail:'Resposta preservada'}},requestId:randomUUID()});
 const consumption={entryId:entry.id,version:1,revision:(await snapshot()).revision,items:[{id:'lot-qa',qty:2}],requestId:randomUUID()};const consumed=await stock('consume',consumption);
 await clinical('save',{id:randomUUID(),version:0,kind:'evolution',status:'reviewed',occurredAt:new Date(Date.now()-60000).toISOString(),payload:{summary:'Evolução recuperação QA',returnDate:'2099-01-01'},requestId:randomUUID()});
 await login('owner','aal2');await rpc('aura_clinical_document_rpc',['prepare',clinic,'patient-qa',JSON.stringify({id:randomUUID(),entryId:entry.id,version:2,kind:'professional_record'})]);
 const before=await snapshot();await db.exec('reset role');const expected=await inventory(db);
 const bytes=Buffer.from(await(await db.dumpDataDir()).arrayBuffer());const sealed=sealRecoveryPackage([{name:'database/full-schema.pglite',bytes}],key);const recovered=openRecoveryPackage(sealed,key);restored=new PGlite({loadDataDir:new Blob([recovered.files[0].bytes])});
 eq(await inventory(restored),expected);eq(expected.length>=28,true);
 for(const table of ['aura_clinical_form_templates','aura_clinical_documents','aura_clinical_followups','clinical_followup_events','clinical_stock'])eq(expected.some(t=>t.name===table&&t.count>0),true);
 eq((await restored.query('select count(*)::int n from storage.objects')).rows[0].n,0);
 await restored.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:accounts.owner.user,session_id:accounts.owner.session,aal:'aal2'})]);await restored.exec('set role authenticated');
 const call=async(name,args)=>(await restored.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') result',args)).rows[0].result;
 eq(await call('aura_rpc',['get',clinic,'{}']),before);eq(await call('aura_clinical_stock_rpc',['consume',clinic,'patient-qa',JSON.stringify(consumption)]),consumed);
 const result=await call('aura_clinical_search',[clinic,'patient-qa',JSON.stringify({query:'preservada'})]);eq(result.items[0].payload.formAnswers.detail,'Resposta preservada');eq(result.items[0].version,2);
 await assert.rejects(()=>restored.query('select * from public.aura_clinical_versions'),e=>e.code==='42501');checks++;
 console.log(`PASS: ${checks} current full-schema recovery checks; all application table counts/digests, forms, clinical versions, followup events, stock ledger and idempotent replay, unsigned documents and restored permissions. Synthetic encrypted PGlite package only; no external backup or real Auth validation.`);
}finally{key.fill(0);await restored?.close();await db.close()}
