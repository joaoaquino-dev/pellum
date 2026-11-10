const connectBeforeClinical=window.AURA_CONNECT;
window.AURA_CONNECT=function(options){
 connectBeforeClinical(options);
 const service=window.AURA_CLINICAL;if(!service)return;
 const model=service.model;
 const dialog=document.createElement('dialog');dialog.id='clinicalDialog';dialog.className='clinical-dialog';
 dialog.setAttribute('aria-labelledby','clinicalTitle');document.body.append(dialog);
 let patientId=null,entries=[],summaryEntries=[],templates=[],access=null,epoch=0,dirty=false,busy=false,timer=null,activeWriter=null,mediaView=null;
 const find=s=>dialog.querySelector(s);
 const button=(label,fn,secondary=true)=>{const b=document.createElement('button');b.type='button';b.textContent=label;if(secondary)b.className='secondary';b.onclick=fn;return b};
 const info=text=>{const el=find('#clinicalMessage');if(el)el.textContent=text};
 const safeClose=()=>{
  if(busy||activeWriter?.state.pending||mediaView?.pending)return info('Aguarde o salvamento antes de fechar.');
  if(dirty&&!confirm('Há um rascunho não salvo nesta tela. Fechar e descartar essas alterações?'))return;
  mediaView?.dispose();mediaView=null;clearTimeout(timer);epoch++;dirty=false;activeWriter=null;entries=[];templates=[];patientId=null;dialog.close();dialog.replaceChildren();
 };
 dialog.addEventListener('cancel',e=>{e.preventDefault();safeClose()});
 window.addEventListener('pellum:session-ended',()=>{
  // Logout/expiry must clear already displayed clinical data even if a user
  // cancels a navigation prompt from another part of the legacy application.
  epoch++;clearTimeout(timer);mediaView?.dispose();mediaView=null;dirty=false;busy=false;activeWriter=null;
  entries=[];summaryEntries=[];templates=[];access=null;patientId=null;service.actorId=null;
  if(dialog.open)dialog.close();dialog.replaceChildren();
 });
 window.addEventListener('beforeunload',e=>{if(dirty||busy||activeWriter?.state.pending){e.preventDefault();e.returnValue=''}});
 function shell(){
  dialog.innerHTML=`<div class="clinical-header"><div><span class="eyebrow">PRONTUÁRIO · HOMOLOGAÇÃO</span><h2 id="clinicalTitle">${esc(patient(patientId))}</h2></div><button type="button" id="clinicalClose" class="secondary" aria-label="Fechar prontuário">Fechar</button></div><p id="clinicalMessage" role="status" aria-live="polite"></p><div id="clinicalBody"></div>`;
  find('#clinicalClose').onclick=safeClose;
 }
 async function open(id){
  if(dialog.open)return;
  patientId=id;entries=[];summaryEntries=[];templates=[];access=null;dirty=false;activeWriter=null;const token=++epoch;
  shell();dialog.showModal();info('Carregando acesso clínico…');
  try{
   const result=await service.call('open',id);if(token!==epoch)return;
   access=result.access;summaryEntries=result.summary||[];
   [entries,templates]=await Promise.all([service.call('list',id),service.call('templates',id)]);if(token!==epoch)return;
   timeline(result.chart);
  }catch(error){if(token!==epoch)return;info(error.message);find('#clinicalBody').append(button('Tentar novamente',()=>{dialog.close();open(id)}));if(options.cloud.clinic.owner_id===service.actorId||options.cloud.clinic.role==='owner'||options.cloud.clinic.role==='manager')find('#clinicalBody').append(button('Gerenciar acesso clínico',manageAccess));}
 }
 async function reload(){
  const token=epoch;info('Atualizando prontuário…');
  try{const r=await service.call('open',patientId);const list=await service.call('list',patientId);if(token!==epoch)return;access=r.access;summaryEntries=r.summary||[];entries=list;timeline(r.chart)}catch(e){if(token===epoch)info(e.message)}
 }
 function toolbar(){
  const bar=document.createElement('div');bar.className='toolbar clinical-toolbar';
  if(access?.can_write)for(const kind of Object.keys(model.clinicalKinds))bar.append(button('＋ '+model.clinicalKinds[kind],()=>edit(kind),false));
  if(access?.can_write)bar.append(button('Modelos de anamnese',()=>templateEditor()));
  if(service.mediaEnabled)bar.append(button('Fotografias e anexos',()=>{clearTimeout(timer);epoch++;mediaView=service.mountClinicalMedia({container:find('#clinicalBody'),patient:patientId,entries,access,client:service.mediaClient,onBack:()=>{mediaView=null;reload()},onDirty:value=>dirty=value});info('Fotografias e documentos clínicos com acesso restrito.')}));
  bar.append(button('Gerenciar acesso clínico',manageAccess));
  bar.append(button('Documentos preparados',documentList));
  if(access?.can_export){bar.append(button('Exportar documento clínico',()=>exportChart('html')));bar.append(button('Exportar dados completos',()=>exportChart('json')))}
  bar.append(button('Agendar retorno',()=>{if(dirty)return;safeClose();appointmentForm();const f=$('#appointmentform');if(f)f.elements.patient.value=patientIdForReturn}));
  const patientIdForReturn=patientId;
  return bar;
 }
 function timeline(chart){
  activeWriter=null;clearTimeout(timer);dirty=false;busy=false;
  const body=find('#clinicalBody');body.replaceChildren();info('Conteúdo clínico restrito. Revisão autenticada ainda não equivale a assinatura digital.');
  const summary=document.createElement('section');summary.className='card clinical-summary';
  const identity=summaryEntries.find(e=>e.kind==='identity'),age=model.patientAge(identity?.payload.birthDate,today());
  const alerts=model.criticalAlerts(summaryEntries);
  summary.innerHTML=`<h3>Resumo clínico</h3><p>${chart?'Número interno: '+esc(chart.chart_number):'O número interno será criado ao salvar o primeiro registro.'}${age===null?'':' · '+age+' anos'}</p>${alerts.length?`<div class="clinical-alert"><b>Informações declaradas para revisão profissional</b><ul>${alerts.map(a=>`<li>${esc(a)}</li>`).join('')}</ul><small>Alertas auxiliam a revisão. Não são diagnóstico nem autorização para realizar procedimentos.</small></div>`:'<p>Nenhum alerta declarado na última anamnese revisada. Reavalie as informações antes de cada procedimento relevante.</p>'}<small>Assinaturas eletrônicas continuam aguardando configuração e validação externa.</small>`;
  body.append(summary,toolbar());
  const filters=document.createElement('div');filters.className='toolbar';filters.innerHTML=`<label class="field">Pesquisar nesta página<input id="clinicalSearch" type="search" placeholder="Texto do registro" autocomplete="off"></label><label class="field">Seção<select id="clinicalKind"><option value="">Todas</option>${Object.entries(model.clinicalKinds).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select></label>`;body.append(filters);
  const list=document.createElement('section');list.className='clinical-timeline';list.setAttribute('aria-label','Histórico clínico');body.append(list);
  const draw=()=>{
   const search=find('#clinicalSearch').value.trim().toLocaleLowerCase('pt-BR'),kind=find('#clinicalKind').value;
   list.replaceChildren();
   const filtered=entries.filter(e=>(!kind||e.kind===kind)&&(!search||JSON.stringify(e.payload).toLocaleLowerCase('pt-BR').includes(search)));
   for(const e of filtered){const card=entryCard(e);const actions=document.createElement('div');actions.className='toolbar';actions.append(button('Versões',()=>history(e)));if(access?.can_write&&e.authorId===service.actorId){actions.append(button(e.finalized?'Adicionar adendo':'Continuar rascunho',()=>edit(e.kind,e)));if(e.finalized){const request={id:crypto.randomUUID(),entryId:e.id,version:e.version,kind:e.kind==='consent'?({'Procedimento':'procedure_consent','Fotografia para cuidado':'clinical_photo_consent','Uso externo de imagem':'advertising_consent'}[e.payload.purpose]):'professional_record'};actions.append(button('Preparar documento · sem assinatura',async()=>{if(busy)return;busy=true;try{await service.documentCall('prepare',patientId,request);info('Fonte versionada preparada. Nenhum documento foi enviado ou assinado. Consulte Documentos preparados.')}catch(error){info(error.message)}finally{busy=false}}))}}if(access?.can_write&&e.kind==='procedure'&&e.finalized&&e.authorId===service.actorId&&!e.payload.financialRecordId&&e.payload.materialsOrigin!=='clinical_stock')actions.append(button('Adicionar materiais',()=>consumeMaterials(e)));card.append(actions);list.append(card)}
   if(!filtered.length){const p=document.createElement('p');p.className='empty';p.textContent=entries.length?'Nenhum registro corresponde à busca.':'Comece com a identificação ou uma nova anamnese.';list.append(p)}
  };
  find('#clinicalSearch').oninput=draw;find('#clinicalKind').onchange=draw;draw();
  if(entries.length&&entries.length%100===0)body.append(button('Carregar registros anteriores',async()=>{
   const last=entries.at(-1);try{const next=await service.call('list',patientId,{before:last.createdAt,beforeId:last.id});entries.push(...next.filter(e=>!entries.some(x=>x.id===e.id)));timeline(chart)}catch(e){info(e.message)}
  }));
 }
 async function consumeMaterials(entry){
  if(busy||dirty)return;clearTimeout(timer);const token=++epoch;busy=true;
  let options;
  try{await window.AURA_REFRESH_CLINIC();options=await service.stockCall('options',patientId)}catch(error){if(token===epoch)info(error.message);return}finally{busy=false}
  if(token!==epoch)return;
  const body=find('#clinicalBody');body.replaceChildren();
  const form=document.createElement('form');form.id='clinicalStockForm';
  form.innerHTML='<h3>Materiais usados</h3><p>Escolha o material e informe quanto foi usado.</p>';
  const rows=document.createElement('div');form.append(rows);let rowNumber=0;
  const addRow=()=>{
   if(rows.children.length>=20)return info('Você pode registrar até 20 materiais neste atendimento.');
   const number=++rowNumber,row=document.createElement('fieldset');row.className='clinical-stock-row';row.dataset.stockRow='';
   const legend=document.createElement('legend');legend.textContent='Material '+number;row.append(legend);
   const fields=document.createElement('div');fields.className='clinical-stock-fields';
   const productLabel=document.createElement('label');productLabel.className='field';productLabel.textContent='Produto ou material';
   const select=document.createElement('select');select.dataset.stockProduct='';select.setAttribute('aria-label','Produto ou material '+number);select.append(new Option('Selecione…',''));
   for(const product of options.products)select.append(new Option(product.name+' · lote '+(product.lot||'não informado'),product.id));
   if(options.products.length===1)select.value=options.products[0].id;productLabel.append(select);
   const quantityLabel=document.createElement('label');quantityLabel.className='field';const quantityText=document.createElement('span');quantityLabel.append(quantityText);
   const input=document.createElement('input');input.type='number';input.min='0.001';input.step='0.001';input.inputMode='decimal';input.dataset.stockQuantity='';input.setAttribute('aria-label','Quantidade utilizada '+number);quantityLabel.append(input);fields.append(productLabel,quantityLabel);row.append(fields);
   const detail=document.createElement('small');row.append(detail);
   const update=()=>{const product=options.products.find(p=>p.id===select.value);quantityText.textContent=product?'Quantidade usada ('+product.unit+')':'Quantidade usada';detail.textContent=product?'Saldo informado: '+product.balance+' '+product.unit+' · Material de '+product.ownerName+(product.expiry?' · Validade: '+product.expiry.split('-').reverse().join('/'):''):''};select.onchange=update;update();
   if(number>1){const remove=button('Remover este material',()=>{row.remove();dirty=true});remove.dataset.stockControl='';row.append(remove)}rows.append(row);
  };
  if(options.products.length){addRow();const another=button('Adicionar outro material',addRow);another.dataset.stockControl='';form.append(another)}
  if(!options.products.length)form.insertAdjacentHTML('beforeend','<p>Nenhum lote ativo e dentro da validade foi encontrado. O atendimento pode ser salvo normalmente. Lembre-se de revisar seu estoque.</p>');
  let request=null,committed=false,failed=false,result=null;
  const back=button('Voltar ao prontuário',()=>{if(busy)return;if(!request&&dirty&&!confirm('Voltar sem salvar os materiais?'))return;if(request&&!committed&&!confirm('Os materiais podem já ter sido salvos. Voltar para conferir o histórico?'))return;dirty=false;epoch++;reload()});
  const submit=button('Salvar materiais',async()=>{
   if(busy)return;
   if(!request){
    if(!form.reportValidity())return;
    const items=Array.from(rows.children).filter(row=>row.querySelector('input').value!=='').map(row=>({id:row.querySelector('select').value,qty:Number(row.querySelector('input').value)}));
    if(!items.length)return info('Informe a quantidade de pelo menos um material.');
    if(items.some(item=>!item.id))return info('Escolha o produto ou material utilizado.');
    if(new Set(items.map(item=>item.id)).size!==items.length)return info('O mesmo lote foi escolhido duas vezes. Junte a quantidade em uma única linha.');
    request={entryId:entry.id,version:entry.version,revision:options.revision,items,requestId:crypto.randomUUID()};
   }
   busy=true;dirty=true;submit.disabled=true;back.disabled=true;for(const input of form.querySelectorAll('input,select,[data-stock-control]'))input.disabled=true;
   try{
    if(!committed){result=await service.stockCall('consume',patientId,request);committed=true}
    await window.AURA_REFRESH_CLINIC();if(token!==epoch)return;dirty=false;epoch++;await reload();info(result.stockReviewRequired?'Materiais registrados. Lembre-se de revisar seu estoque.':'Materiais registrados.');
   }catch(error){
    if(token!==epoch)return;info(error.message);
    if(['22023','40001','42501'].includes(error.code)){failed=true;info(error.message+' Volte ao prontuário para conferir antes de outra tentativa.')}
    else submit.textContent=committed?'Atualizar tela':'Tentar salvar novamente';
   }finally{busy=false;if(token===epoch){submit.disabled=failed;back.disabled=false}}
  },false);
  submit.disabled=!options.products.length;form.addEventListener('input',()=>{dirty=true});form.onsubmit=event=>{event.preventDefault();submit.click()};const actions=document.createElement('div');actions.className='actions';actions.append(back,submit);form.append(actions);body.append(form);
  info('Se o saldo não conferir, você poderá salvar normalmente. Lembre-se de revisar seu estoque.');
 }
 function entryCard(entry){
  const card=document.createElement('article');card.className='card clinical-entry';
  const p=entry.payload||{},status={draft:'Rascunho',reviewed:'Revisado · sem assinatura digital',addendum:'Adendo · sem assinatura digital'}[entry.status]||'Registro';
  card.innerHTML=`<div class="cardhead"><h3>${esc(model.clinicalKinds[entry.kind]||'Versão clínica')}</h3><span class="tag">${esc(status)} · v${entry.version}</span></div><small>Atendimento: ${esc(new Date(entry.occurredAt).toLocaleString('pt-BR'))}<br>Registrado: ${esc(new Date(entry.recordedAt).toLocaleString('pt-BR'))}<br>${esc(entry.professionalName)} ${esc(entry.registry||'')}</small>${entry.reason?`<p><b>Motivo do adendo:</b> ${esc(entry.reason)}</p>`:''}<p class="clinical-text">${esc(p.summary)}</p>`;
  const labels=Object.fromEntries(model.clinicalDisplayFields(entry.kind).map(([key,label])=>[key,label]));labels.procedure='Procedimento';labels.notes='Observações';
  for(const [key,label] of Object.entries(labels))if(p[key])card.insertAdjacentHTML('beforeend',`<p class="clinical-text"><b>${esc(label)}:</b> ${esc(p[key])}</p>`);
  for(const q of p.questions||[]){const value=p.answers?.[q.id];if(value!==undefined&&model.visibleQuestion(q,p.answers||{}))card.insertAdjacentHTML('beforeend',`<p class="clinical-text"><b>${esc(q.label)}:</b> ${esc(q.type==='tri'?model.triLabels[value]:Array.isArray(value)?value.join(', '):value)}</p>`)}
  if(p.nursing)model.nursingSteps.forEach((label,i)=>{if(p.nursing[i])card.insertAdjacentHTML('beforeend',`<p class="clinical-text"><b>${esc(label)}:</b> ${esc(p.nursing[i])}</p>`)});
  if(p.imagePurposes?.length)card.insertAdjacentHTML('beforeend',`<p><b>Finalidades de imagem relatadas:</b> ${esc(p.imagePurposes.join(', '))}</p>`);
  for(const m of p.materials||[])card.insertAdjacentHTML('beforeend',`<p>Material: ${esc(m.name||m.id)} · lote ${esc(m.lot||'não informado')} · ${esc(m.qty)} ${esc(m.unit||'')} · validade ${esc(m.expiry||'não informada')}</p>`);
  if(p.stockReview==='pending')card.insertAdjacentHTML('beforeend','<small>Lembre-se de revisar seu estoque.</small>');
  return card;
 }
 async function documentList(){
  if(busy)return;const token=++epoch;info('Carregando documentos preparados…');
  try{
   const documents=await service.documentCall('list',patientId);if(token!==epoch)return;
   const body=find('#clinicalBody');body.replaceChildren(button('Voltar ao prontuário',reload));
   body.append(Object.assign(document.createElement('p'),{textContent:'Estes pacotes preservam a fonte clínica de uma versão. Preparado não significa assinado. A integração com fornecedor e a validação jurídica ainda estão pendentes.'}));
   const names={professional_record:'Registro profissional',procedure_consent:'Consentimento de procedimento',clinical_photo_consent:'Fotografia para cuidado',advertising_consent:'Divulgação de imagem'};
   const states={prepared:'Preparado · não assinado',dispatch_requested:'Envio solicitado',provider_created:'Aguardando assinatura externa',received_unverified:'Recebido · assinatura não validada',verified:'Validação externa registrada',refused:'Recusado',expired:'Expirado',cancelled:'Cancelado',validation_failed:'Falha na validação'};
   for(const item of documents){const card=document.createElement('article');card.className='card';const title=document.createElement('h3');title.textContent=(names[item.kind]||'Documento')+' · fonte v'+item.sourceVersion;const state=document.createElement('p');state.textContent=states[item.state]||'Estado pendente';const profile=document.createElement('small');profile.textContent=item.requiredSignature==='qualified'?'Requisito técnico: assinatura qualificada do profissional; validação externa pendente.':'Método de assinatura sujeito à revisão do tipo documental.';card.append(title,state,profile);card.append(button('Histórico documental',async()=>{try{const events=await service.documentCall('history',patientId,{id:item.id});let list=card.querySelector('ul');if(!list){list=document.createElement('ul');card.append(list)}list.replaceChildren();for(const event of events){const row=document.createElement('li');row.textContent=new Date(event.createdAt).toLocaleString('pt-BR')+' · '+(states[event.state]||event.state);list.append(row)}}catch(error){info(error.message)}}));
    if(access?.can_export)card.append(button('Exportar fonte · sem assinatura',async()=>{try{const packet=await service.documentCall('export',patientId,{id:item.id}),url=URL.createObjectURL(new Blob([JSON.stringify({notice:'Fonte clínica versionada. Este pacote não comprova assinatura.',...packet},null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='pellum-fonte-nao-assinada.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(error){info(error.message)}}));body.append(card);
   }
   if(!documents.length)body.append(Object.assign(document.createElement('p'),{textContent:'Prepare uma versão revisada do seu próprio registro pela linha do tempo.'}));
   if(documents.length===50)body.append(Object.assign(document.createElement('p'),{textContent:'Exibindo os 50 pacotes mais recentes. Consulta de pacotes anteriores requer paginação assistida nesta versão.'}));
   info('Nenhuma assinatura é gerada por um checkbox ou por preparar a fonte.');
  }catch(error){if(token===epoch)info(error.message)}
 }
 async function history(e){
  try{const versions=await service.call('history',patientId,{id:e.id});const body=find('#clinicalBody');body.replaceChildren(button('Voltar ao prontuário',reload));for(const v of versions)body.append(entryCard({kind:e.kind,version:v.version,status:v.status,occurredAt:v.occurred_at,recordedAt:v.recorded_at,professionalName:v.professional_name,registry:v.registry,reason:v.correction_reason,payload:v.payload}));info('Versões preservadas. Nenhuma versão anterior é sobrescrita.')}catch(e){info(e.message)}
 }
 function edit(kind,entry=null){
  clearTimeout(timer);const token=++epoch;dirty=false;const payload=structuredClone(entry?.payload||{}),questions=payload.questions||structuredClone(model.defaultQuestions);
  const body=find('#clinicalBody');body.replaceChildren();
  const form=document.createElement('form');form.id='clinicalForm';form.autocomplete='off';
  const labelInput=(name,label,type='text',value='',options=[])=>`<label class="field">${esc(label)}${type==='textarea'?`<textarea name="${name}" rows="3" maxlength="4000">${esc(value)}</textarea>`:type==='select'?`<select name="${name}">${options.map(o=>`<option ${o===value?'selected':''}>${esc(o)}</option>`).join('')}</select>`:`<input name="${name}" type="${type}" ${type==='number'?'min="0" max="10000" step="any"':''} value="${esc(value)}" ${type==='date'?'max="'+today()+'"':''} maxlength="4000">`}</label>`;
  form.innerHTML=`<h3>${esc(model.clinicalKinds[kind])}${entry?.finalized?' · novo adendo':''}</h3><p>Preencha apenas as informações pertinentes ao atendimento.</p><label class="field">Data e horário do atendimento<input name="occurredAt" type="datetime-local" required value="${localDateTime(entry?.occurredAt)}"></label>${labelInput('summary','Resumo do registro','textarea',payload.summary||'')}`;
  if(['plan','procedure','adverse_event'].includes(kind))form.insertAdjacentHTML('beforeend',`<label class="field">Procedimento<select name="procedure"><option value="">Não informado</option>${[...new Set([...(payload.procedure?[payload.procedure]:[]),...procedures])].map(v=>`<option ${v===payload.procedure?'selected':''}>${esc(v)}</option>`).join('')}</select></label>`);
  for(const [name,label,type='textarea',values=[]] of model.clinicalFields[kind])form.insertAdjacentHTML('beforeend',labelInput(name,label,type,payload[name]||'',values));
  for(const group of model.clinicalExtraGroups[kind]||[]){
   const details=document.createElement('details');details.className='clinical-optional';const summary=document.createElement('summary');summary.textContent=group.title+' · se necessário';details.append(summary);
   for(const [name,label] of group.fields)details.insertAdjacentHTML('beforeend',labelInput(name,label,'textarea',payload[name]||''));
   const populated=()=>group.fields.some(([name])=>form.elements[name]?.value.trim());
   details.open=group.fields.some(([name])=>payload[name]);form.append(details);
   if(group.match){const [field,value]=group.match;const update=()=>{details.hidden=form.elements[field].value!==value&&!populated()};form.elements[field].addEventListener('change',update);update()}
  }
  if(kind==='procedure'){
   const updateLabels=()=>{const labels=model.procedureDetailLabels(form.elements.procedure.value);['preparationDetails','applicationDetails'].forEach((key,index)=>{form.elements[key].parentElement.firstChild.textContent=labels[index]})};form.elements.procedure.addEventListener('change',updateLabels);updateLabels();
  }
  if(kind==='adverse_event')form.insertAdjacentHTML('afterbegin','<small>Em situações urgentes, priorize o atendimento conforme os protocolos profissionais e serviços de emergência.</small>');
  // Future appointments/return dates are allowed; birth dates and event dates are not.
  form.elements.returnDate?.removeAttribute('max');
  if(['procedure','evolution','adverse_event'].includes(kind)){
   form.insertAdjacentHTML('beforeend',`<label class="field">Plano relacionado<select name="planId"><option value="">Sem vínculo</option>${entries.filter(e=>e.kind==='plan').map(e=>`<option value="${esc(e.id)}" ${e.id===payload.planId?'selected':''}>${esc(e.payload.summary||e.payload.objective||'Plano')} · v${e.version}</option>`).join('')}</select></label><label class="field">Agendamento relacionado<select name="appointmentId"><option value="">Sem vínculo</option>${state.appointments.filter(a=>a.patient===patientId).map(a=>`<option value="${esc(a.id)}" ${a.id===payload.appointmentId?'selected':''}>${esc(a.date)} · ${esc(a.procedure)}</option>`).join('')}</select></label>`);
  }
  if(kind==='procedure'){
   form.insertAdjacentHTML('beforeend','<small>Lembre-se de revisar seu estoque. O saldo não impede salvar este atendimento.</small>');
   form.insertAdjacentHTML('beforeend',`<label class="field">Atendimento com consumo já registrado<select name="financialRecordId" ${entry?.finalized?'disabled':''}><option value="">Sem vínculo de estoque</option>${state.records.filter(r=>r.patient===patientId).map(r=>`<option value="${esc(r.id)}" ${r.id===payload.financialRecordId?'selected':''}>${esc(r.date)} · ${esc(r.procedure)}</option>`).join('')}</select></label><p>O vínculo preserva os materiais do atendimento. O consumo é registrado uma única vez no fluxo de atendimento existente.</p>`);
  }
  if(kind==='anamnesis'){
   const templateSelect=document.createElement('label');templateSelect.className='field';templateSelect.textContent='Modelo de perguntas';
   const select=document.createElement('select');select.name='templateChoice';select.innerHTML='<option value="">Perguntas de referência · adaptar à relevância clínica</option>'+templates.map((t,i)=>`<option value="${i}">${esc(t.name)} · v${t.version}</option>`).join('');
   if(entry)select.disabled=true;templateSelect.append(select);form.append(templateSelect);
   const container=document.createElement('fieldset');container.className='clinical-questions';container.innerHTML='<legend>Histórico declarado</legend>';form.append(container);
   let currentQuestions=questions,templateId=payload.templateId,templateVersion=payload.templateVersion;
   const renderQuestions=answers=>{
    container.innerHTML='<legend>Histórico declarado · responda o que for pertinente</legend>';
    for(const q of currentQuestions){const value=answers[q.id]??'';const wrap=document.createElement('label');wrap.className='field';wrap.dataset.question=q.id;
     wrap.innerHTML=esc(q.label)+(q.required?' *':'');let input;
     if(['tri','single','multi'].includes(q.type)){
      input=document.createElement('select');input.multiple=q.type==='multi';if(q.type!=='multi')input.innerHTML='<option value="">Não respondido / não pertinente</option>';
      const values=q.type==='tri'?Object.entries(model.triLabels):q.options.map(o=>[o,o]);for(const [v,label] of values){const o=document.createElement('option');o.value=v;o.textContent=label;o.selected=Array.isArray(value)?value.includes(v):value===v;input.append(o)}
     }else{input=document.createElement(q.type==='text'?'textarea':'input');if(q.type!=='text')input.type=q.type;input.value=value;input.maxLength=4000;if(q.type==='number')input.step='any'}
     input.name='answer_'+q.id;wrap.append(input);container.append(wrap);
    }
    refreshConditions();
   };
   const rawAnswers=()=>Object.fromEntries(currentQuestions.map(q=>{const input=form.elements['answer_'+q.id];return [q.id,q.type==='multi'?Array.from(input.selectedOptions,o=>o.value):input.value]}));
   const refreshConditions=()=>{const a=rawAnswers();for(const q of currentQuestions){const label=container.querySelector('[data-question="'+q.id+'"]');label.hidden=!model.visibleQuestion(q,a);form.elements['answer_'+q.id].required=!!q.required&&!label.hidden}};
   container.addEventListener('input',refreshConditions);container.addEventListener('change',refreshConditions);
   select.onchange=()=>{const t=select.value===''?null:templates[Number(select.value)];currentQuestions=t?structuredClone(t.schema):structuredClone(model.defaultQuestions);templateId=t?.id;templateVersion=t?.version;renderQuestions({});dirty=true};
   renderQuestions(payload.answers||{});
   form.readQuestionnaire=review=>({questions:currentQuestions,answers:model.validateAnswers(currentQuestions,rawAnswers(),review),...(templateId?{templateId,templateVersion}:{})});
  }
  if(kind==='evaluation'&&access?.profession==='enfermagem'){
   const fs=document.createElement('fieldset');fs.className='clinical-questions';fs.innerHTML='<legend>Processo de Enfermagem · documentação pelo profissional habilitado</legend>'+model.nursingSteps.map((s,i)=>labelInput('nursing_'+i,s,'textarea',payload.nursing?.[i]||'')).join('');form.append(fs);
  }
  if(kind==='adverse_event')form.insertAdjacentHTML('afterbegin','<div class="clinical-alert"><p>Em situações urgentes, siga os protocolos clínicos e acione os serviços de emergência. O registro no sistema não substitui a assistência.</p></div>');
  if(kind==='consent'){
   form.insertAdjacentHTML('afterbegin','<div class="hint"><p>Minuta para revisão clínica e jurídica. Aceite relatado não é assinatura validada. A recusa de divulgação não impede o cuidado. Registre cada finalidade em um documento independente.</p></div>');
   const fs=document.createElement('fieldset');fs.className='clinical-questions';fs.innerHTML='<legend>Uso externo de imagem · finalidades relatadas</legend>'+model.imagePurposes.map((v,i)=>`<label class="field"><span><input name="imagePurpose_${i}" type="checkbox" ${payload.imagePurposes?.includes(v)?'checked':''}> ${esc(v)}</span></label>`).join('');
   const refreshPurpose=()=>{fs.hidden=form.elements.purpose.value!=='Uso externo de imagem'};form.elements.purpose.addEventListener('change',refreshPurpose);form.append(fs);refreshPurpose();
  }
  if(entry?.finalized)form.insertAdjacentHTML('beforeend','<label class="field">Motivo do adendo<textarea name="reason" required minlength="5" maxlength="1000" rows="2"></textarea></label>');
  const actions=document.createElement('div');actions.className='actions';
  const back=button('Voltar',()=>{if(busy)return;if(dirty&&!confirm('Voltar e descartar as alterações ainda não salvas?'))return;clearTimeout(timer);epoch++;reload()});
  const save=button(entry?.finalized?'Salvar adendo':'Salvar rascunho',()=>submit(entry?.finalized?'addendum':'draft'));
  const review=button('Revisar e finalizar',()=>submit('reviewed'),false);
  actions.append(back,save);if(!entry?.finalized)actions.append(review);form.append(actions);body.append(form);
  const writer=model.createClinicalWriter({send:b=>service.call('save',patientId,b),id:entry?.id||crypto.randomUUID(),kind,version:entry?.version||0});activeWriter=writer;
  function readData(status){
   const data={...payload};for(const [name] of model.clinicalDisplayFields(kind))data[name]=form.elements[name].value;
   for(const name of ['summary','procedure','planId','appointmentId','financialRecordId'])if(form.elements[name])data[name]=form.elements[name].value;
   if(form.readQuestionnaire)Object.assign(data,form.readQuestionnaire(status!=='draft'));
   if(kind==='consent')data.imagePurposes=data.purpose==='Uso externo de imagem'?model.imagePurposes.filter((_,i)=>form.elements['imagePurpose_'+i].checked):[];
   if(kind==='evaluation'&&access?.profession==='enfermagem')data.nursing=model.nursingSteps.map((_,i)=>form.elements['nursing_'+i].value);
   if(data.birthDate&&(!model.validDate(data.birthDate)||data.birthDate>today()))throw Error('Confira a data de nascimento.');
   if(status!=='draft'&&!data.summary.trim())throw Error('Escreva o resumo antes de finalizar a revisão.');
   const occurredAt=new Date(form.elements.occurredAt.value).toISOString();if(new Date(occurredAt)>new Date())throw Error('O atendimento não pode estar no futuro.');
   return {payload:data,status,occurredAt,reason:form.elements.reason?.value||''};
  }
  let editSequence=0;
  async function submit(status,automatic=false){
   clearTimeout(timer);if(busy||token!==epoch)return;
   let data;try{if(status!=='draft'&&!automatic&&!form.reportValidity())return;data=readData(status)}catch(e){if(!automatic)info(e.message);return}
   if(status!=='draft'&&!automatic&&!confirm(status==='addendum'?'Registrar o adendo com identificação e histórico preservado?':'Finalizar a revisão? Correções posteriores exigirão adendo. Isso ainda não é uma assinatura digital.'))return;
   busy=true;save.disabled=true;review.disabled=true;back.disabled=true;const sequence=editSequence;
   if(status!=='draft')for(const input of form.querySelectorAll('input,textarea,select'))input.disabled=true;
   info(automatic?'Salvando rascunho…':'Salvando registro…');
   try{
    const result=await writer.write(data);if(token!==epoch)return;dirty=sequence!==editSequence;
    info('Salvo na nuvem · versão '+result.version+(dirty?' · há alterações posteriores aguardando salvamento':''));
    if(status!=='draft'){dirty=false;epoch++;await reload()}
   }catch(e){if(token===epoch){dirty=true;info(e.message);if(writer.state.conflict){save.disabled=true;review.disabled=true;showConflict()}}}
   finally{busy=false;if(token===epoch){for(const input of form.querySelectorAll('input,textarea,select'))input.disabled=false;if(entry?.finalized&&form.elements.financialRecordId)form.elements.financialRecordId.disabled=true;if(entry&&form.elements.templateChoice)form.elements.templateChoice.disabled=true;save.disabled=writer.state.conflict;review.disabled=writer.state.conflict;back.disabled=false;if(dirty&&!writer.state.failed&&!writer.state.conflict&&!entry?.finalized)timer=setTimeout(()=>submit('draft',true),1200)}}
  }
  function showConflict(){
   if(find('#clinicalConflict'))return;
   const panel=document.createElement('section');panel.id='clinicalConflict';panel.className='card clinical-alert';panel.setAttribute('aria-label','Conflito de versões');
   const message=document.createElement('p');message.textContent='A escrita foi pausada. O que você digitou continua neste formulário; compare o histórico antes de sair.';panel.append(message);
   if(entry)panel.append(button('Consultar histórico sem descartar rascunho',async()=>{
    try{const versions=await service.call('history',patientId,{id:entry.id});let list=panel.querySelector('[data-conflict-history]');if(!list){list=document.createElement('div');list.dataset.conflictHistory='';panel.append(list)}list.replaceChildren();for(const v of versions)list.append(entryCard({kind,version:v.version,status:v.status,occurredAt:v.occurred_at,recordedAt:v.recorded_at,professionalName:v.professional_name,registry:v.registry,reason:v.correction_reason,payload:v.payload}));info('Histórico consultado. O rascunho continua no formulário, sem envio automático.')}
    catch(error){info(error.message)}
   }));
   if(access?.can_export)panel.append(button('Exportar rascunho não confirmado',async()=>{
    if(busy)return;busy=true;
    try{await service.call('export',patientId,{format:'unconfirmed-draft'});const data={unconfirmed:true,notice:'Rascunho local não confirmado no banco. Não é registro revisado ou assinado.',patientId,entryId:entry?.id||null,baseVersion:entry?.version||0,...readData('draft')};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='pellum-rascunho-nao-confirmado.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);info('Rascunho exportado com autorização e auditoria. Guarde o arquivo em local protegido.')}
    catch(error){info(error.message)}finally{busy=false}
   }));
   actions.before(panel);
  }
  form.addEventListener('input',()=>{dirty=true;editSequence++;clearTimeout(timer);info('Alterações aguardando salvamento.');if(!entry?.finalized)timer=setTimeout(()=>submit('draft',true),1200)});
  form.addEventListener('change',()=>{dirty=true;editSequence++;clearTimeout(timer);if(!entry?.finalized)timer=setTimeout(()=>submit('draft',true),1200)});
  form.onsubmit=e=>{e.preventDefault();submit(entry?.finalized?'addendum':'draft')};
  info(entry?.finalized?'O registro anterior será preservado. Este formulário cria um adendo.':'Rascunhos são salvos na nuvem enquanto há conexão. Dados não são guardados no armazenamento do navegador.');
 }
 function localDateTime(value){const d=value?new Date(value):new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
 async function exportChart(format){
  if(!entries.length)return info('Ainda não há registros clínicos para exportar.');
  if(!confirm('Exportar o histórico clínico completo desta paciente para este dispositivo? Guarde o arquivo em local protegido.'))return;
  const token=epoch;busy=true;info('Autorizando exportação…');
  try{const result=await service.call('export',patientId,{format});if(token!==epoch)return;const html=format==='html',blob=new Blob([html?service.renderClinicalExport(result):JSON.stringify(result,null,2)],{type:html?'text/html':'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='pellum-prontuario.'+format;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);info(html?'Documento exportado. Abra o arquivo para ler ou imprimir. A exportação foi registrada na auditoria.':'Exportação autorizada e registrada na auditoria.')}catch(e){if(token===epoch)info(e.message)}finally{busy=false}
 }
 async function manageAccess(){
  clearTimeout(timer);if(dirty&&!confirm('Descartar alterações não salvas e gerenciar acesso?'))return;
  dirty=false;epoch++;info('Conferindo autorização para gerenciar acessos…');
  try{
   const grants=await service.call('access',patientId);const body=find('#clinicalBody');body.replaceChildren(button('Voltar ao prontuário',reload));
   const form=document.createElement('form');form.autocomplete='off';form.innerHTML=`<h3>Acesso clínico desta paciente</h3><p>O proprietário concede acesso individual. O vínculo administrativo não concede leitura clínica automaticamente.</p><label class="field">E-mail de uma conta já vinculada<input name="email" type="email" required autocomplete="off"></label><label class="field">Profissional responsável<select name="professionalId">${state.names.map((n,i)=>(state.inactivePros||[]).includes(i)?'':`<option value="${i}">${esc(n)}</option>`).join('')}</select></label><label class="field">Categoria declarada<select name="profession"><option value="outra">Outra categoria</option><option value="enfermagem">Enfermagem</option></select></label><label class="field">Conselho e registro, se aplicável<input name="registry" maxlength="120"></label><label class="field"><span><input name="write" type="checkbox"> Pode registrar e revisar conteúdo clínico</span></label><label class="field"><span><input name="export" type="checkbox"> Pode exportar com autenticação em duas etapas</span></label><button type="submit">Conceder acesso à paciente</button>`;body.append(form);
   const grant=async data=>{busy=true;try{await service.call('grant',patientId,{...data,requestId:crypto.randomUUID()});await manageAccess();info('Permissões atualizadas.')}catch(e){info(e.message)}finally{busy=false}};
   form.onsubmit=async e=>{e.preventDefault();if(busy)return;const f=new FormData(form),email=String(f.get('email')).trim().toLowerCase();try{const id=await service.call('resolve_member',patientId,{email});await grant({userId:id,professionalId:Number(f.get('professionalId')),profession:f.get('profession'),registry:f.get('registry'),write:f.has('write'),export:f.has('export'),enabled:true})}catch(e){info(e.message)}};
   for(const g of grants){const row=document.createElement('div');row.className='row';const text=document.createElement('span');text.textContent=g.email+' · '+(g.enabled?(g.write?'Leitura e registro':'Leitura'):'Revogado');row.append(text);if(g.enabled)row.append(button('Revogar',()=>grant({...g,enabled:false})));body.append(row)}
   info('Confira a habilitação profissional antes de conceder permissões. Não há exceção de suporte administrativo.');
  }catch(e){info(e.message)}
 }
 async function templateEditor(existing=null){
  if(busy)return;if(dirty&&!confirm('Descartar alterações não salvas e abrir outro modelo?'))return;dirty=false;epoch++;clearTimeout(timer);
  const body=find('#clinicalBody');body.replaceChildren(button('Voltar ao prontuário',()=>{if(busy)return;if(dirty&&!confirm('Descartar alterações não salvas do modelo?'))return;dirty=false;epoch++;reload()}));
  for(const t of templates.filter(t=>t.author_id===service.actorId))body.append(button('Editar modelo: '+t.name+' · v'+t.version,()=>templateEditor(t)));
  const form=document.createElement('form');form.innerHTML='<h3>Modelo reutilizável de anamnese</h3><label class="field">Nome do modelo<input name="name" maxlength="120" required></label><label class="field">Procedimento, se específico<select name="procedure"><option value="">Qualquer procedimento</option>'+procedures.map(p=>'<option>'+esc(p)+'</option>').join('')+'</select></label><label class="field"><span><input name="personal" type="checkbox"> Modelo exclusivo da minha profissional</span></label><div id="questionBuilder"></div>';
  const builder=form.querySelector('#questionBuilder');let next=0,pendingTemplate=null;
  const add=(question=null)=>{let key=question?.id;next++;if(!key){key='q'+next;while(Array.from(builder.children).some(r=>r.dataset.key===key))key='q'+(++next)}const row=document.createElement('fieldset');row.className='clinical-questions';row.dataset.key=key;row.clinicalWhen=question?.when;row.innerHTML=`<legend>Pergunta ${next}</legend><label class="field">Pergunta<input data-label maxlength="300" required></label><label class="field">Tipo<select data-type><option value="tri">Sim / Não / Não sei</option><option value="text">Texto</option><option value="date">Data</option><option value="number">Número</option><option value="single">Seleção única</option><option value="multi">Seleção múltipla</option></select></label><label class="field">Opções, uma por linha (para seleção)<textarea data-options rows="3" maxlength="6000"></textarea></label><label class="field"><span><input data-required type="checkbox"> Obrigatória para revisar este modelo</span></label><label class="field"><span><input data-details type="checkbox"> Pedir detalhes se a resposta for Sim</span></label>`;if(question){row.querySelector('[data-label]').value=question.label;row.querySelector('[data-type]').value=question.type;row.querySelector('[data-options]').value=(question.options||[]).join('\n');row.querySelector('[data-required]').checked=!!question.required}row.append(button('Remover pergunta',()=>{row.remove();dirty=true}));builder.append(row);dirty=true};
  const actions=document.createElement('div');actions.className='toolbar';actions.append(button('Adicionar pergunta',()=>add()));const save=document.createElement('button');save.textContent='Salvar modelo';actions.append(save);form.append(actions);body.append(form);if(existing){form.elements.name.value=existing.name;form.elements.procedure.value=existing.procedure;form.elements.personal.checked=existing.professional_id!==null;existing.schema.forEach(q=>add(q))}else add();dirty=false;form.addEventListener('input',()=>dirty=true);
  form.onsubmit=async e=>{e.preventDefault();if(busy)return;try{
   const schema=[];for(const row of builder.children){const id=row.dataset.key,type=row.querySelector('[data-type]').value,q={id,label:row.querySelector('[data-label]').value,type,required:row.querySelector('[data-required]').checked};if(row.clinicalWhen)q.when=row.clinicalWhen;if(['single','multi'].includes(type))q.options=row.querySelector('[data-options]').value.split('\n').map(v=>v.trim()).filter(Boolean);schema.push(q);if(type==='tri'&&row.querySelector('[data-details]').checked)schema.push({id:id+'_detail',label:'Detalhes: '+q.label,type:'text',when:{field:id,equals:'yes'}})}
   model.validateQuestions(schema);busy=true;save.disabled=true;const f=new FormData(form);for(const input of form.querySelectorAll('input,textarea,select'))input.disabled=true;
   // Retry an uncertain request exactly before considering newer edits.
   if(pendingTemplate){await service.call('save_template',patientId,pendingTemplate);pendingTemplate=null;dirty=false;templates=await service.call('templates',patientId);await reload();info('Solicitação anterior recuperada. Confira o modelo antes de editar novamente.');return}
   pendingTemplate={id:existing?.id||crypto.randomUUID(),version:existing?.version||0,requestId:crypto.randomUUID(),name:f.get('name'),procedure:f.get('procedure'),professionalId:f.has('personal')?access.professional_id:null,schema};
   await service.call('save_template',patientId,pendingTemplate);pendingTemplate=null;templates=await service.call('templates',patientId);dirty=false;epoch++;await reload();info('Modelo salvo. Suas respostas futuras guardarão a versão utilizada.');
  }catch(e){if(e.code&&e.code!=='40001')pendingTemplate=null;info(e.message)}finally{busy=false;save.disabled=false;for(const input of form.querySelectorAll('input,textarea,select'))input.disabled=false}};
  info('Adapte as perguntas ao procedimento. Não torne todo o histórico obrigatório.');
 }
 const beforeList=patientsList;patientsList=function(){beforeList();const removed=$('#showRemoved')?.checked;const ps=state.patients.filter(p=>!!p.deleted===!!removed&&p.name.toLowerCase().includes($('#patientSearch').value.toLowerCase()));$('#patientsList').querySelectorAll('tbody tr').forEach((row,i)=>{const p=ps[i];if(!p)return;const b=button('Prontuário',()=>open(p.id));b.dataset.clinicalPatient=p.id;(row.querySelector('.patient-action-group')||row.lastElementChild).append(b)})};
 if(page==='pacientes')patientsList();
};
