import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createStockFixture} from './clinical/stock-fixture.mjs';
import {PGlite} from './clinical/node_modules/@electric-sql/pglite/dist/index.js';
const {db,clinic,accounts,login,rpc,clinical,snapshot,stock}=await createStockFixture();let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++};const denied=async(fn,code)=>{await assert.rejects(fn,e=>e.code===code);checks++};
const call=(action,body={},target=clinic)=>rpc('aura_clinical_form_template_rpc',[action,target,'patient-qa',JSON.stringify(body)]);
const saveRecord=(body)=>clinical('save',{id:randomUUID(),version:0,kind:'procedure',status:'reviewed',occurredAt:new Date(Date.now()-60000).toISOString(),requestId:randomUUID(),...body});
try{
 const schema=[{id:'check',label:'Conferência profissional fictícia',type:'tri',required:true},{id:'detail',label:'Detalhes fictícios',type:'text',when:{field:'check',equals:'yes'}}];
 const body={id:randomUUID(),version:0,kind:'procedure',name:'Modelo QA',procedure:'Peeling',professionalId:null,schema,requestId:randomUUID()};
 const first=await call('save',body);eq(first.version,1);eq(await call('save',body),first);await denied(()=>call('save',{...body,name:'Outro nome'}),'22023');
 eq((await call('list',{kind:'procedure',procedure:'Peeling'})).length,1);eq((await call('list',{kind:'procedure',procedure:'Limpeza de pele'})).length,0);
 const payload={summary:'Procedimento fictício com modelo',procedure:'Peeling',formTemplateId:body.id,formTemplateVersion:1,formQuestions:[{id:'fake',label:'Forjado',type:'text'}],formTemplateName:'Nome forjado',formAnswers:{check:'yes',detail:'Explicação fictícia'}};
 const record=await saveRecord({payload});const history=await clinical('history',{id:record.id});eq(history[0].payload.formQuestions,schema);eq(history[0].payload.formTemplateName,'Modelo QA');eq(history[0].payload.formAnswers.detail,'Explicação fictícia');
 await denied(()=>saveRecord({payload:{...payload,formAnswers:{}}}),'22023');await denied(()=>saveRecord({payload:{...payload,procedure:'Limpeza de pele'}}),'42501');
 await denied(()=>saveRecord({kind:'evolution',payload}),'22023');
 const secondBody={...body,version:1,name:'Modelo QA revisado',schema:[{id:'newField',label:'Pergunta nova',type:'text'}],requestId:randomUUID()};eq((await call('save',secondBody)).version,2);eq((await call('list',{kind:'procedure'}))[0].version,2);eq((await clinical('history',{id:record.id}))[0].payload.formQuestions,schema);
 await denied(()=>call('save',{...secondBody,requestId:randomUUID()}),'40001');
 await denied(()=>saveRecord({id:record.id,version:1,status:'addendum',reason:'Tentativa de mudar o modelo',payload:{...payload,formTemplateVersion:2,formAnswers:{newField:'X'}}}),'22023');
 await saveRecord({id:record.id,version:1,status:'addendum',reason:'Complementação fictícia',payload:{...payload,formAnswers:{check:'no'}}});eq((await clinical('history',{id:record.id})).length,2);
 await stock('consume',{entryId:record.id,version:2,revision:(await snapshot()).revision,items:[{id:'lot-qa',qty:1}],requestId:randomUUID()});eq((await clinical('history',{id:record.id})).at(-1).payload.formTemplateVersion,1);eq((await clinical('history',{id:record.id})).at(-1).payload.formQuestions,schema);eq((await snapshot()).data.products[0].balance,99);
 await login('writer');eq((await call('list',{kind:'procedure'})).length,1);await denied(()=>call('save',{...secondBody,version:2,requestId:randomUUID()}),'42501');
 await login('reader');eq((await call('list',{kind:'procedure'})).length,1);await denied(()=>call('save',{...body,id:randomUUID(),requestId:randomUUID()}),'42501');
 await login('outsider');await denied(()=>call('list',{kind:'procedure'}),'42501');await denied(()=>call('save',body),'42501');
 await login('owner');await denied(()=>db.query('select * from public.aura_clinical_form_templates'),'42501');await denied(()=>call('save',{...body,id:randomUUID(),professionalId:1,requestId:randomUUID()}),'42501');
 const consent={...body,id:randomUUID(),kind:'consent',purpose:'Procedimento',procedure:'',name:'Termo fictício',schema:[{id:'clarification',label:'Esclarecimentos',type:'text'}],requestId:randomUUID()};await call('save',consent);
 const term=await saveRecord({kind:'consent',payload:{summary:'Minuta fictícia',purpose:'Procedimento',formTemplateId:consent.id,formTemplateVersion:1,formAnswers:{clarification:'Informação fictícia'}}});eq((await clinical('history',{id:term.id}))[0].payload.formTemplateName,'Termo fictício');await denied(()=>saveRecord({kind:'consent',payload:{summary:'Minuta',purpose:'Uso externo de imagem',formTemplateId:consent.id,formTemplateVersion:1,formAnswers:{}}}),'42501');
 await db.exec('reset role');await denied(()=>db.query('delete from public.aura_clinical_form_templates where id=$1',[body.id]),'42501');
 eq((await db.query("select count(*)::int n from public.aura_clinical_versions v where v.entry_id=$1 and v.digest<>encode(sha256(convert_to(jsonb_build_array(v.entry_id,v.version,v.author_id,v.occurred_at,v.status,v.correction_reason,v.payload)::text,'UTF8')),'hex')",[record.id])).rows[0].n,0);
 const recovered=new PGlite({loadDataDir:await db.dumpDataDir()});try{eq((await recovered.query('select schema from public.aura_clinical_form_templates where id=$1 and version=1',[body.id])).rows[0].schema,schema);eq((await recovered.query('select payload from public.aura_clinical_versions where entry_id=$1 order by version desc limit 1',[record.id])).rows[0].payload.formTemplateVersion,1)}finally{await recovered.close()}
 await login('owner');await clinical('grant',{userId:accounts.owner.user,professionalId:0,profession:'outra',registry:'QA',write:false,enabled:true,requestId:randomUUID()});await denied(()=>call('save',body),'42501');
 console.log(`PASS: ${checks} reusable form-template SQL checks; versioned procedure/consent templates, exact source snapshot, required/conditional answers, purpose/procedure/tenant/author permissions, replay, conflict, immutable history and digest. Local PostgreSQL only.`);
}catch(error){throw Error('Form template QA: '+error.code+' '+error.message,{cause:error instanceof assert.AssertionError?error:undefined})}
finally{await db.close()}
