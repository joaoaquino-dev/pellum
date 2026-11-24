import {randomUUID} from 'node:crypto';
import {createFullSchemaFixture} from './full-schema-fixture.mjs';
export async function createStockFixture(options={}){
 const env=await createFullSchemaFixture(['administrator','owner','writer','reader','outsider'],options);const {db,accounts,login,rpc}=env;
 await login('administrator','aal2');for(const name of ['owner','writer','reader','outsider'])await rpc('aura_admin_rpc',['authorize',JSON.stringify({email:accounts[name].email,max_clinics:1})]);
 await login('owner');const {id:clinic}=await rpc('aura_rpc',['create',null,JSON.stringify({name:'QA consumo clínico',requestId:randomUUID()})]);
 const base=(await rpc('aura_rpc',['get',clinic,'{}']));base.data.names=['Profissional QA'];base.data.patients=[{id:'patient-qa',name:'Paciente fictícia',phone:'',note:''},{id:'other-patient',name:'Outra paciente fictícia',phone:'',note:''}];
 const product={id:'lot-qa',name:'Insumo fictício',price:900,quantity:100,packCount:1,balance:100,owner:0,minimum:5,unit:'unidades',lot:'QA-01',expiry:'2099-01-01',movements:[]};
 base.data.products=[product,{...product,id:'expired',expiry:'2020-01-01'},{...product,id:'archived',deleted:true}];
 await rpc('aura_rpc',['save',clinic,JSON.stringify({data:base.data,revision:base.revision,requestId:randomUUID()})]);
 await db.exec('reset role');for(const name of ['writer','reader'])await db.query("insert into public.aura_members(clinic_id,email,role) values($1,$2,'manager')",[clinic,accounts[name].email]);
 await login('owner');for(const name of ['owner','writer','reader'])await rpc('aura_clinical_rpc',['grant',clinic,'patient-qa',JSON.stringify({userId:accounts[name].user,professionalId:0,profession:'outra',registry:'QA',write:name!=='reader',export:true,enabled:true,requestId:randomUUID()})]);
 const clinical=(action,body={},patient='patient-qa',target=clinic)=>rpc('aura_clinical_rpc',[action,target,patient,JSON.stringify(body)]);
 const stock=(action,body={},patient='patient-qa',target=clinic)=>rpc('aura_clinical_stock_rpc',[action,target,patient,JSON.stringify(body)]);
 const snapshot=async()=>rpc('aura_rpc',['get',clinic,'{}']);
 const procedure=async({kind='procedure',status='reviewed'}={})=>{const id=randomUUID();return clinical('save',{id,version:0,kind,status,occurredAt:new Date(Date.now()-60000).toISOString(),payload:{summary:'Procedimento fictício',procedure:'Limpeza de pele'},requestId:randomUUID()})};
 return {...env,clinic,clinical,stock,snapshot,procedure,product};
}
