const labels={planned:'Previsto',scheduled:'Agendado',completed:'Concluído'};
const date=value=>String(value||'').split('-').reverse().join('/');
export function followupLabel(item,today){return item.state==='planned'&&item.dueDate<today?'Atrasado':labels[item.state]||'Previsto'}
export function mountClinicalFollowups({container,service,patient=null,getState,refreshClinic,onBack,onOpenChart,onBusy=()=>{},onDirty=()=>{}}){
 let alive=true,busy=false,dirty=false,data=null;const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node};
 const button=(text,fn,secondary=true)=>{const node=el('button',text);node.type='button';if(secondary)node.className='secondary';node.onclick=fn;return node};
 const status=el('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const setBusy=value=>{busy=value;if(alive)onBusy(value)},setDirty=value=>{dirty=value;if(alive)onDirty(value)};
 const say=text=>{if(alive)status.textContent=text};const stateBody=item=>({id:item.id,revision:item.revision,requestId:crypto.randomUUID()});
 function shell(){container.replaceChildren(el('h3','Retornos'),status);container.append(button('Voltar',()=>{if(busy)return;if(dirty&&!confirm('Voltar sem salvar este horário?'))return;setDirty(false);onBack()}))}
 async function load(message=''){
  setBusy(true);try{const result=await service.followupCall('list',patient);if(!alive)return;data=result;setDirty(false);draw();say(message||'Confira as datas e agende o próximo atendimento.')}catch(error){say(error.message)}finally{setBusy(false)}
 }
 function draw(){
  shell();const controls=el('div');controls.className='toolbar';const filter=el('select');filter.setAttribute('aria-label','Mostrar retornos');for(const [value,label] of [['active','Previstos e agendados'],['overdue','Atrasados'],['completed','Concluídos']])filter.append(new Option(label,value));const search=el('input');search.type='search';search.placeholder='Buscar paciente';search.hidden=patient!==null;search.setAttribute('aria-label','Buscar paciente nos retornos');controls.append(filter,search,button('Atualizar',()=>{if(!busy)load()}));container.append(controls);const list=el('section');list.className='clinical-followup-list';container.append(list);
  const render=()=>{list.replaceChildren();const items=data.items.filter(item=>(filter.value==='active'?item.state!=='completed':filter.value==='overdue'?followupLabel(item,data.today)==='Atrasado':item.state==='completed')&&item.patientName.toLocaleLowerCase('pt-BR').includes(search.value.toLocaleLowerCase('pt-BR')));
   for(const item of items){const card=el('article');card.className='card clinical-followup-card';card.append(el('h4',item.patientName),el('span',followupLabel(item,data.today)),el('p','Retorno previsto: '+date(item.dueDate)),el('small',item.professionalName||'Profissional a conferir'));
    if(item.state==='scheduled'&&item.appointment)card.append(el('p','Horário: '+date(item.appointment.date)+' às '+item.appointment.time));
    const actions=el('div');actions.className='toolbar';
    if(onOpenChart)actions.append(button('Abrir prontuário',()=>{if(!busy)onOpenChart(item.patientId)}));
    if(item.canWrite){
     if(item.state==='planned')actions.append(button('Agendar retorno',()=>schedule(item),false));
     const action=item.state==='completed'?'reopen':'complete',text=action==='complete'?'Marcar concluído':'Reabrir retorno';let request=null;
     const change=button(text,async()=>{if(busy)return;request||=stateBody(item);setBusy(true);change.disabled=true;try{await service.followupCall(action,patient,request);if(alive)await load(action==='complete'?'Retorno marcado como concluído.':'Retorno reaberto.')}catch(error){if(error.code==='40001'){if(alive)await load('Este retorno foi atualizado. Confira a situação antes de continuar.')}else say(error.message)}finally{setBusy(false);if(alive)change.disabled=false}});actions.append(change);
    }
    card.append(actions);list.append(card);
   }
   if(!items.length)list.append(el('p','Nenhum retorno nesta lista. A data pode ser informada ao registrar uma evolução.'));
  };filter.onchange=render;search.oninput=render;render();
 }
 async function schedule(original){
  if(busy)return;setBusy(true);
  try{await refreshClinic();const fresh=await service.followupCall('list',patient);if(!alive)return;data=fresh;const item=data.items.find(row=>row.id===original.id);if(!item||item.state!=='planned'){draw();say('Confira a situação atual deste retorno.');return}
   shell();const form=el('form');form.id='clinicalFollowupForm';const field=(text,input,parent=form)=>{const label=el('label',text);label.className='field';label.append(input);parent.append(label)};
   form.append(el('h4','Agendar retorno de '+item.patientName));
   const times=el('div');times.className='clinical-followup-timegrid';form.append(times);
   const day=el('input');day.type='date';day.name='date';day.required=true;day.value=item.dueDate<data.today?data.today:item.dueDate;field('Data',day,times);
   const time=el('input');time.type='time';time.name='time';time.required=true;time.value='09:00';field('Horário',time,times);
   const pro=el('select');pro.name='professionalId';pro.required=true;pro.append(new Option('Selecione a profissional',''));const state=getState();for(const id of window.AURA_TEAM_MODEL.activeProfessionalIds(state))pro.append(new Option(state.names[id],String(id)));pro.value=String(item.professionalId);field('Profissional',pro);
   const procedure=el('input');procedure.name='procedure';procedure.value='Retorno';procedure.maxLength=100;procedure.required=true;field('Atendimento',procedure);
   const duration=el('input');duration.type='number';duration.inputMode='numeric';duration.name='duration';duration.min='15';duration.max='480';duration.step='15';duration.required=true;duration.value='30';field('Duração em minutos',duration);
   let request=null,committed=false;const save=button('Salvar retorno',async()=>{
    if(busy)return;if(!request){if(!form.reportValidity())return;request={...stateBody(item),clinicRevision:data.clinicRevision,date:day.value,time:time.value,duration:Number(duration.value),professionalId:Number(pro.value),procedure:procedure.value}}
    setBusy(true);save.disabled=true;for(const input of form.querySelectorAll('input,select'))input.disabled=true;
    try{if(!committed){await service.followupCall('schedule',patient,request);committed=true}await refreshClinic();if(alive){setDirty(false);await load('Retorno salvo na agenda.')}}
    catch(error){
     if(!alive)return;
     if(error.code==='40001'){
      try{await refreshClinic();const next=await service.followupCall('list',patient);if(!alive)return;const current=next.items.find(row=>row.id===item.id);if(current?.state!=='planned'){data=next;setDirty(false);draw();say('Este retorno já foi atualizado. Confira a situação.');return}item.revision=current.revision;data.clinicRevision=next.clinicRevision;request=null;say('A agenda mudou. Confira o horário e toque em Salvar retorno.')}catch(refreshError){say(refreshError.message)}
     }else{say(error.message);if(['22023','42501'].includes(error.code))request=null;else save.textContent=committed?'Atualizar tela':'Tentar salvar novamente'}
    }finally{setBusy(false);if(alive){save.disabled=false;if(!request)for(const input of form.querySelectorAll('input,select'))input.disabled=false}}
   },false);
   form.addEventListener('input',()=>setDirty(true));form.onsubmit=event=>{event.preventDefault();save.click()};form.append(save);container.append(form);say('Confira o horário e salve.');
  }catch(error){say(error.message)}finally{setBusy(false)}
 }
 shell();load();return {dispose(){alive=false},get pending(){return busy}};
}
