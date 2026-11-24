import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createStockFixture} from './clinical/stock-fixture.mjs';
const {db,accounts,login,rpc,clinic,clinical,stock,snapshot,procedure}=await createStockFixture();let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++};const denied=async(fn,code)=>{await assert.rejects(fn,e=>e.code===code);checks++};
try{
 const entry=await procedure(),initial=await snapshot(),options=await stock('options');eq(options.products.map(p=>p.id),['lot-qa']);eq(options.revision,initial.revision);
 const body={entryId:entry.id,version:1,revision:initial.revision,items:[{id:'lot-qa',qty:40}],requestId:randomUUID()};
 await denied(()=>stock('consume',{...body,items:[{id:'lot-qa',qty:40},{id:'expired',qty:1}]}),'22023');eq((await snapshot()).data.products[0].balance,100);eq((await clinical('history',{id:entry.id})).length,1);
 for(const items of [[{id:'missing-lot',qty:1}],[{id:'lot-qa',qty:0}],[{id:'lot-qa',qty:1.0001}],[{id:'lot-qa',qty:1,cost:0}],[{id:'lot-qa',qty:1},{id:'lot-qa',qty:1}],[{id:'archived',qty:1}]])await denied(()=>stock('consume',{...body,items}),'22023');
 await denied(()=>stock('consume',{...body,revision:0}),'40001');
 await denied(()=>stock('consume',{...body,version:0}),'40001');
 await login('reader');await denied(()=>stock('options'),'42501');await denied(()=>stock('consume',body),'42501');
 await login('writer');await denied(()=>stock('consume',body),'42501');
 await login('outsider');await denied(()=>stock('options'),'42501');await denied(()=>stock('consume',body),'42501');
 await login('owner');await denied(()=>stock('consume',body,'other-patient'),'42501');
 const draft=await procedure({status:'draft'});await denied(()=>stock('consume',{...body,entryId:draft.id,requestId:randomUUID()}),'22023');
 const evaluation=await procedure({kind:'evaluation'});await denied(()=>stock('consume',{...body,entryId:evaluation.id,requestId:randomUUID()}),'22023');
 // Fault after the stock ledger/version trigger: the transaction must roll back
 // ledger, version, snapshot and idempotency response together.
 await db.exec("reset role;create function public.qa_stock_failure() returns trigger language plpgsql as $$begin if new.payload->>'materialsOrigin'='clinical_stock' then raise exception 'QA simulated write failure';end if;return new;end$$;create trigger zz_qa_stock_failure before insert on public.aura_clinical_versions for each row execute function public.qa_stock_failure();");await login('owner');
 await denied(()=>stock('consume',body),'P0001');eq((await snapshot()).data.products[0].balance,100);eq((await clinical('history',{id:entry.id})).length,1);
 await db.exec('reset role');eq((await db.query('select count(*)::int n from aura_private.clinical_stock')).rows[0].n,0);await db.exec('drop trigger zz_qa_stock_failure on public.aura_clinical_versions;drop function public.qa_stock_failure()');await login('owner');
 const result=await stock('consume',body);eq(result.version,2);eq(result.clinicRevision,initial.revision+1);
 const after=await snapshot();eq(after.data.records.length,0);eq(after.data.products[0].balance,60);eq(after.data.products[0].movements.length,1);eq(after.data.products[0].movements[0].type,'clinical_consumption');eq(after.data.products[0].movements[0].qty,-40);
 const versions=await clinical('history',{id:entry.id});eq(versions.length,2);eq(versions[0].payload.materials,undefined);eq(versions[1].payload.materials[0].lot,'QA-01');eq(versions[1].payload.materials[0].cost,360);eq(versions[1].payload.materialsOrigin,'clinical_stock');eq(versions[1].status,'addendum');
 eq(await stock('consume',body),result);eq((await snapshot()).data.products[0].balance,60);eq((await clinical('history',{id:entry.id})).length,2);
 await denied(()=>stock('consume',{...body,items:[{id:'lot-qa',qty:1}]}),'22023');
 await denied(()=>stock('consume',{...body,version:2,revision:after.revision,requestId:randomUUID()}),'22023');
 // Ordinary management saves retain the new movement and can still edit unrelated fields.
 const changed=structuredClone(after.data);changed.patients[0].name='Paciente fictícia atualizada';changed.products[0].name='Nome do insumo atualizado';
 await rpc('aura_rpc',['save',clinic,JSON.stringify({data:changed,revision:after.revision,requestId:randomUUID()})]);eq((await snapshot()).data.patients[0].name,changed.patients[0].name);
 const forged=await snapshot();forged.data.products[0].movements[0].qty=-20;forged.data.products[0].balance=80;
 await denied(async()=>rpc('aura_rpc',['save',clinic,JSON.stringify({data:forged.data,revision:forged.revision,requestId:randomUUID()})]),'22023');
 await denied(async()=>rpc('aura_rpc',['save',clinic,JSON.stringify({data:initial.data,revision:(await snapshot()).revision,requestId:randomUUID()})]),'22023');
 // Restoring a pre-consumption snapshot must never replenish the consumed lot.
 await login('owner','aal2');await db.exec('reset role');await db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified')",[accounts.owner.user]);await login('owner','aal2');
 const history=await rpc('aura_rpc',['history',clinic,'{}']);await denied(async()=>rpc('aura_rpc',['restore',clinic,JSON.stringify({backup:history.history.find(h=>h.action==='Consumo de materiais clínicos').id,revision:(await snapshot()).revision,requestId:randomUUID()})]),'22023');eq((await snapshot()).data.products[0].balance,60);
 const compatible=history.history.find(h=>h.revision===after.revision);await rpc('aura_rpc',['restore',clinic,JSON.stringify({backup:compatible.id,revision:(await snapshot()).revision,requestId:randomUUID()})]);eq((await snapshot()).data.products[0].balance,60);eq((await snapshot()).data.products[0].movements.length,1);
 // Further addenda preserve the original material snapshot and integrity digest.
 await clinical('save',{id:entry.id,kind:'procedure',version:2,status:'addendum',occurredAt:versions[1].occurred_at,payload:{summary:'Complementação fictícia'},reason:'Complemento sem alterar consumo',requestId:randomUUID()});
 eq((await clinical('history',{id:entry.id})).at(-1).payload.materials,versions[1].payload.materials);
 await db.exec('reset role');eq((await db.query("select count(*)::int n from public.aura_clinical_versions v where v.entry_id=$1 and v.digest<>encode(sha256(convert_to(jsonb_build_array(v.entry_id,v.version,v.author_id,v.occurred_at,v.status,v.correction_reason,v.payload)::text,'UTF8')),'hex')",[entry.id])).rows[0].n,0);
 await denied(()=>db.query('delete from aura_private.clinical_stock where entry_id=$1',[entry.id]),'42501');
 // A stale inventory is a reminder, never a reason to block clinical recording
 // or invent a negative balance. A retry must not debit an unresolved item.
 await login('owner','aal2');const pendingEntry=await procedure();const pendingBody={entryId:pendingEntry.id,version:1,revision:(await snapshot()).revision,items:[{id:'lot-qa',qty:70}],requestId:randomUUID()};
 const pendingResult=await stock('consume',pendingBody);eq(pendingResult.stockReviewRequired,true);eq(pendingResult.version,2);eq((await snapshot()).data.products[0].balance,60);eq((await snapshot()).data.products[0].movements.length,1);
 const pendingMaterials=(await clinical('history',{id:pendingEntry.id})).at(-1).payload;eq(pendingMaterials.materials[0].qty,70);eq(pendingMaterials.materials[0].stockApplied,false);eq(pendingMaterials.stockReview,'pending');eq(await stock('consume',pendingBody),pendingResult);eq((await snapshot()).data.products[0].balance,60);
 const extraLot=await snapshot();extraLot.data.products.push({...extraLot.data.products[0],id:'second-lot',name:'Segundo material fictício',balance:100,movements:[]});await rpc('aura_rpc',['save',clinic,JSON.stringify({data:extraLot.data,revision:extraLot.revision,requestId:randomUUID()})]);
 const mixedEntry=await procedure();const mixed=await stock('consume',{entryId:mixedEntry.id,version:1,revision:(await snapshot()).revision,items:[{id:'lot-qa',qty:70},{id:'second-lot',qty:2}],requestId:randomUUID()});eq(mixed.stockReviewRequired,true);eq((await snapshot()).data.products[0].balance,60);eq((await snapshot()).data.products.find(p=>p.id==='second-lot').balance,98);
 const mixedMaterials=(await clinical('history',{id:mixedEntry.id})).at(-1).payload.materials;eq(mixedMaterials.map(m=>m.stockApplied),[false,true]);eq(mixedMaterials.map(m=>m.cost),[630,18]);
 const lastDebit=await procedure();await stock('consume',{entryId:lastDebit.id,version:1,revision:(await snapshot()).revision,items:[{id:'lot-qa',qty:60}],requestId:randomUUID()});eq((await snapshot()).data.products[0].balance,0);eq((await stock('options')).products[0].balance,0);
 const zeroStock=await procedure();const zeroResult=await stock('consume',{entryId:zeroStock.id,version:1,revision:(await snapshot()).revision,items:[{id:'lot-qa',qty:1}],requestId:randomUUID()});eq(zeroResult.stockReviewRequired,true);eq((await snapshot()).data.products[0].balance,0);
 await login('reader');await denied(()=>db.query('select * from aura_private.clinical_stock'),'42501');
 // Replay rechecks current clinical authorization before returning cached data.
 await login('owner','aal2');await clinical('grant',{userId:accounts.owner.user,professionalId:0,profession:'outra',registry:'QA',write:false,enabled:true,requestId:randomUUID()});await denied(()=>stock('consume',body),'42501');
 console.log(`PASS: ${checks} direct clinical-stock checks; atomic debit/addendum, rollback, exact historical cost, no financial record, idempotence, permissions, immutable movements, restore protection and digest. Local PostgreSQL only.`);
}catch(error){throw Error('Clinical stock QA: '+error.code+' '+error.message,{cause:error instanceof assert.AssertionError?error:undefined})}
finally{await db.close()}
