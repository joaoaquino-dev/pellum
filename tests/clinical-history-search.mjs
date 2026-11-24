import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createStockFixture} from './clinical/stock-fixture.mjs';
const {db,accounts,clinic,login,rpc,clinical}=await createStockFixture();let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++};const denied=async(fn,code)=>{await assert.rejects(fn,e=>e.code===code);checks++};
const search=(body={},patient='patient-qa',target=clinic)=>rpc('aura_clinical_search',[target,patient,JSON.stringify(body)]);
const save=(payload,extra={})=>clinical('save',{id:randomUUID(),version:0,kind:'procedure',status:'reviewed',occurredAt:'2024-06-01T12:00:00Z',payload,requestId:randomUUID(),...extra});
try{
 const old=await save({summary:'Ácido hialurônico no registro antigo',productDetails:'Marca fictícia QA-OLD'},{occurredAt:'2020-01-01T12:00:00Z'});
 for(let i=0;i<101;i++)await save({summary:'Registro recente fictício '+i});
 eq((await clinical('list')).some(e=>e.id===old.id),false);
 let result=await search({query:'acido HIALURONICO'});eq(result.items.length,1);eq(result.items[0].id,old.id);eq((await search({query:'QA-OLD'})).items[0].id,old.id);
 eq((await search({query:"' OR 1=1 --"})).items.length,0);eq((await search({query:'%_'})).items.length,0);
 await save({summary:'Anotação corrigida'},{id:old.id,version:1,status:'addendum',reason:'Correção fictícia preservando o histórico',occurredAt:'2020-01-01T12:00:00Z'});
 eq((await search({query:'acido'})).items.length,0);const historical=await search({query:'acido',includeHistory:true});eq(historical.items[0].version,1);eq(historical.items[0].historical,true);eq(historical.items[0].latestVersion,2);eq((await search({entryId:old.id})).items[0].version,2);
 eq((await search({entryId:old.id,version:1})).items[0].version,1);await denied(()=>search({version:1}),'22023');await denied(()=>search({entryId:old.id,version:0}),'22023');
 const ids=[];let cursor;do{result=await search({from:'2024-06-01',to:'2024-06-01',kind:'procedure',limit:20,...(cursor?{cursor}:{})});ids.push(...result.items.map(e=>e.id+':'+e.version));cursor=result.cursor}while(result.hasMore);eq(ids.length,101);eq(new Set(ids).size,101);eq(result.items.length,1);
 for(const [at,summary] of [['2025-11-10T02:59:59Z','Antes do dia em Brasília'],['2025-11-10T03:00:00Z','Início do dia em Brasília'],['2025-11-11T02:59:59Z','Fim do dia em Brasília'],['2025-11-11T03:00:00Z','Depois do dia em Brasília']])await save({summary},{kind:'evolution',occurredAt:at});
 const dateRange=await search({kind:'evolution',from:'2025-11-10',to:'2025-11-10'});eq(dateRange.items.map(e=>e.payload.summary),['Fim do dia em Brasília','Início do dia em Brasília']);
 await denied(()=>search({from:'2026-02-30'}),'22023');await denied(()=>search({from:'2026-02-01',to:'2026-01-01'}),'22023');await denied(()=>search({includeHistory:'true'}),'22023');await denied(()=>search({kind:'unknown'}),'22023');await denied(()=>search({limit:51}),'22023');await denied(()=>search({cursor:{id:old.id}}),'22023');await denied(()=>search({query:'x'.repeat(201)}),'22023');
 await login('reader');eq((await search({query:'corrigida'})).items.length,1);await denied(()=>search({},'other-patient'),'42501');
 await login('outsider');await denied(()=>search({entryId:old.id}),'42501');await login('administrator','aal2');await denied(()=>search(),'42501');
 await login('owner');await denied(()=>db.query('select * from public.aura_clinical_versions'),'42501');await clinical('grant',{userId:accounts.owner.user,professionalId:0,profession:'outra',registry:'QA',write:false,enabled:false,requestId:randomUUID()});await denied(()=>search({query:'corrigida'}),'42501');
 await db.exec('reset role');eq((await db.query("select count(*)::int n from public.aura_clinical_audit where action='search'")).rows[0].n>0,true);
 eq((await db.query("select count(*)::int n from pg_indexes where indexname='clinical_versions_search_scope_date_idx'")).rows[0].n,1);
 console.log(`PASS: ${checks} full clinical-history search checks; beyond initial 100 records, accent/case-insensitive literal terms, old versions, stable pagination, Brasília date boundaries, type filters, permissions/revocation and audit without search text. Local PostgreSQL only.`);
}catch(error){throw Error('Clinical search QA: '+error.code+' '+error.message,{cause:error instanceof assert.AssertionError?error:undefined})}
finally{await db.close()}
