const connectBeforeTeam=window.AURA_CONNECT;
window.AURA_CONNECT=function(options){
 connectBeforeTeam(options);
 const model=window.AURA_TEAM_MODEL;
 const consumption=window.AURA_CALC_CONSUMPTION;
 const active=()=>model.activeProfessionalIds(state);
 const proOptions=(selected,none=false,exclude=-1)=>`${none?'<option value="">Sem parceria · atendimento individual</option>':''}${active().filter(i=>i!==exclude).map(i=>`<option value="${i}" ${String(i)===String(selected)?'selected':''}>${esc(state.names[i])}</option>`).join('')}`;
 const currentIds=()=>{const ids=active(),one=Number($('#professional1')?.value??ids[0]),two=$('#professional2')?.value;return two===undefined?(ids.length>1?[one,ids[1]]:[one]):two===''?[one]:[one,Number(two)]};
 const oldReadTeam=readCalc;
 readCalc=function(){const r=oldReadTeam(),ids=currentIds();return {...r,professionalIds:ids,professionalNames:ids.map(i=>state.names[i]),...(ids.length===1?{percent:100,cost2:0,feeOwner:'0',mode:'gross'}:{})}};
 const oldValidTeam=validCalc;
 validCalc=function(){const ids=currentIds();if(new Set(ids).size!==ids.length){toast('Escolha profissionais diferentes para a parceria.');return false}return oldValidTeam()};
 updateResult=function(){const r=readCalc();if(r.discount>r.price||r.percent<0||r.percent>100||new Set(r.professionalIds).size!==r.professionalIds.length){$('#result').innerHTML='<h2>Confira os valores e as profissionais.</h2>';return}const c=calc(r),names=recordNames(r);$('#result').innerHTML=`<small>VALOR FINAL À PACIENTE</small><div class="bigmoney">${money(c.total)}</div><p>${names.length===1?'Atendimento individual · 100%':`Divisão ${r.percent}% / ${100-r.percent}%`}</p>${names.map((name,i)=>`<div class="sectiongap"><h2>${esc(name)}</h2><div class="row"><span>Parte do atendimento</span><span>${money(i?c.b:c.a)}</span></div><div class="row"><span>Produtos e insumos</span><span>− ${money(i?r.cost2:r.cost1)}</span></div><div class="row"><b>Sobra estimada</b><b>${money(i?c.net2:c.net1)}</b></div></div>`).join('')}<small class="sectiongap">Taxa do pagamento: ${money(c.fee)}. Antes de impostos e despesas fixas. ${r.mode==='reimburse'?'Os produtos são reembolsados antes da divisão.':''}</small>`};
 calculator=function(){
  consumption.reset();
  $('#app').innerHTML=head('Quanto cobrar?','Informe o valor e os materiais usados. O resultado aparece na hora.')+`<div class="grid pricing-layout"><form class="card" id="calcform">
   <h2>1. Atendimento</h2>
   <label class="field">Procedimento<select id="procedure">${procopts()}</select></label>
   <label class="field" ${active().length===1?'hidden':''}>Quem atende?<select id="professional1">${proOptions(active()[0])}</select></label>
   ${num('price','Valor cobrado da paciente (R$)',0)}
   <hr class="divider"><h2>2. Produtos e insumos usados</h2>
   <p>Selecione o material e a quantidade. O custo é calculado para você.</p>
   <label class="field">Produto / lote<select id="consumeProduct"></select></label>
   ${num('consumeQty','Quantidade utilizada',1,'min="0.001" step="0.001"')}
   <button class="secondary" type="button" id="addPricingMaterial">Adicionar produto ao cálculo</button>
   <div id="consumptionList" aria-live="polite"></div>
   <small>O estoque só muda ao salvar o atendimento. Lembre-se de revisar seu estoque.</small>
   <details class="sectiongap" id="manualPricingCosts"><summary>Informar o custo dos materiais manualmente</summary><p>Use o custo total, incluindo os itens adicionados acima. Esse valor não movimenta o estoque por conta própria.</p>
    ${num('cost1','Custo total dos materiais (R$)',0)}${num('cost2','Custo dos materiais da outra pessoa (R$)',0)}
   </details>
   <hr class="divider"><h2>3. Vai dividir com alguém?</h2>
   <label class="field">Divisão deste atendimento<select id="professional2">${proOptions('',true,active()[0])}</select></label>
   <button type="button" class="textbtn" id="pricingAddPartner">Adicionar pessoa para dividir</button>
   <small>Atende por conta própria? Deixe “Sem parceria”. A outra pessoa não precisa acessar sua conta.</small>
   <div id="pricingPartnership" hidden><div class="formgrid">${num('percent','Sua parte (%)',100,'max="100"')}${num('percent2','Parte da outra pessoa (%)',0,'max="100"')}</div>
    <label class="field">Como combinar os materiais?<select id="splitMode"><option value="gross">Dividir o valor e cada pessoa paga seus materiais</option><option value="reimburse">Devolver o custo dos materiais e dividir o que restar</option></select></label>
    <small id="pricingSplitExplanation"></small>
   </div>
   <details class="sectiongap" id="pricingPayment"><summary>Desconto e taxa do cartão</summary><div class="formgrid">${num('discount','Desconto (R$)',0)}${num('fee','Taxa do pagamento (%)',0,'max="100"')}</div>
    <label class="field" id="pricingFeeOwner">Quem paga a taxa?<select id="feeOwner"></select></label>
   </details>
   <details class="sectiongap"><summary>Calcular o preço a partir de quanto quero ganhar</summary>${num('targetNet','Quanto quer que sobre para quem atende? (R$)',0)}<button type="button" class="secondary" id="pricingTarget">Calcular preço necessário</button><small>Usa os materiais, a divisão e a taxa deste cálculo.</small></details>
   <div class="actions sectiongap"><button type="submit">Registrar atendimento</button><button type="button" class="secondary" id="pricingQuote">Preparar orçamento para WhatsApp</button></div>
  </form><div><div class="card result" id="result" aria-live="polite"></div><p class="sub">Simular não salva valores. Use “Registrar atendimento” quando quiser lançar no financeiro.</p></div></div>`;
  const drawMaterials=()=>{
   $('#consumptionList').replaceChildren();
   consumption.get().forEach((item,index)=>{
    const row=document.createElement('div');row.className='row';
    const label=document.createElement('span');label.textContent=(state.products.find(p=>p.id===item.id)?.name||'Material')+' · '+item.qty+' · '+money(item.cost);
    const remove=document.createElement('button');remove.type='button';remove.className='textbtn';remove.textContent='Remover';remove.setAttribute('aria-label','Remover '+label.textContent);
    remove.onclick=()=>{const slot=currentIds().indexOf(item.owner);if(slot<0)return;const input=$('#cost'+(slot+1));input.value=Math.max(0,Math.round((Number(input.value)-item.cost)*100)/100).toFixed(2);consumption.get().splice(index,1);drawMaterials();updateResult()};
    row.append(label,remove);$('#consumptionList').append(row);
   });
  };
  const sync=()=>{
   const selectedPartner=$('#professional2').value;
   $('#professional2').innerHTML=proOptions(selectedPartner,true,Number($('#professional1').value));
   $('#professional1').closest('.field').hidden=active().length===1;
   const ids=currentIds(),solo=ids.length===1;
   consumption.reset();drawMaterials();$('#cost1').value='0';$('#cost2').value='0';
   $('#percent').value=solo?100:(state.percent===100?70:state.percent);$('#percent2').value=100-Number($('#percent').value);
   $('#pricingPartnership').hidden=solo;$('#cost2').closest('.field').hidden=solo;
   for(const id of ['percent','percent2','cost2','splitMode'])$('#'+id).disabled=solo;
   $('#cost1').closest('.field').firstChild.textContent=solo?'Custo total dos materiais (R$)':'Custo total dos materiais de '+state.names[ids[0]]+' (R$)';
   if(!solo){$('#percent').closest('.field').firstChild.textContent=state.names[ids[0]]+' (%)';$('#percent2').closest('.field').firstChild.textContent=state.names[ids[1]]+' (%)';$('#cost2').closest('.field').firstChild.textContent='Custo total dos materiais de '+state.names[ids[1]]+' (R$)'}
   $('#feeOwner').innerHTML=ids.map((id,i)=>`<option value="${i}">${esc(state.names[id])}</option>`).join('')+(!solo?'<option value="split">Cada pessoa paga sua parte</option>':'');$('#pricingFeeOwner').hidden=solo;
   $('#consumeProduct').innerHTML='<option value="">Selecione um material…</option>'+state.products.filter(p=>!p.deleted&&ids.includes(p.owner)).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${p.lot?' · '+esc(p.lot):''} · ${money(p.price/p.quantity)} / ${esc(p.unit||'unidade')}</option>`).join('');
   updateResult();
  };
  const refresh=()=>{updateResult();$('#pricingSplitExplanation').textContent=$('#splitMode').value==='reimburse'?'Primeiro, cada pessoa recebe de volta o que gastou em materiais. A porcentagem vale sobre o restante.':'A porcentagem vale sobre o valor cobrado, após o desconto. Depois, saem os materiais de quem os forneceu.'};
  let previousIds=currentIds();
  const changePeople=()=>{
   if((consumption.get().length||Number($('#cost1').value)||Number($('#cost2').value))&&!confirm('Trocar as pessoas e limpar os materiais deste cálculo? O valor cobrado será mantido.')){$('#professional1').value=String(previousIds[0]);$('#professional2').value=previousIds.length>1?String(previousIds[1]):'';return}
   sync();previousIds=currentIds();
  };
  $('#professional1').onchange=changePeople;$('#professional2').onchange=changePeople;
  $('#percent').oninput=()=>{$('#percent2').value=100-Number($('#percent').value);refresh()};$('#percent2').oninput=()=>{$('#percent').value=100-Number($('#percent2').value);refresh()};
  $('#calcform').oninput=refresh;$('#calcform').onchange=refresh;
  $('#addPricingMaterial').onclick=()=>{window.addConsumption();drawMaterials()};$('#pricingTarget').onclick=()=>window.targetPrice();$('#pricingQuote').onclick=()=>window.quotePreview();
  $('#pricingAddPartner').onclick=()=>{
   showModal('<h2>Com quem vai dividir?</h2><p>Informe apenas o nome. Isso não cria uma conta nem dá acesso aos seus dados.</p><form id="pricingPartnerForm"><label class="field">Nome da pessoa<input name="name" required maxlength="60" autocomplete="off"></label><div class="actions"><button type="button" class="secondary" id="pricingPartnerCancel">Cancelar</button><button>Adicionar à divisão</button></div></form>');
   $('#pricingPartnerCancel').onclick=closeModal;
   $('#pricingPartnerForm').onsubmit=e=>{
    e.preventDefault();if(!e.target.reportValidity())return;
    const status=window.AURA_CLINIC_SYNC?.();if(!status||status.pending||status.blocked)return toast('Aguarde o salvamento antes de adicionar uma pessoa.');
    const name=e.target.elements.name.value.trim();if(!name)return;
    const existing=active().find(i=>state.names[i].localeCompare(name,'pt-BR',{sensitivity:'base'})===0),one=Number($('#professional1').value);
    if(existing===one)return toast('Escolha outra pessoa para dividir.');
    if(existing===undefined&&state.names.length>=20)return toast('Limite de 20 nomes neste espaço. Confira as profissionais em Configurações.');
    const partner=existing??state.names.length;
    if(currentIds().length>1&&currentIds()[1]!==partner&&(Number($('#cost2').value)||consumption.get().some(m=>m.owner===currentIds()[1]))&&!confirm('Trocar a parceria e retirar os materiais da pessoa anterior deste cálculo?'))return;
    if(existing===undefined){state.names.push(name);if(persist('Adição de pessoa para divisão')===false){state.names.pop();return}}
    const materials=consumption.get().slice(),firstCost=$('#cost1').value,secondCost=currentIds().length>1?$('#cost2').value:'0',oldPartner=currentIds()[1];
    $('#professional1').innerHTML=proOptions(one);$('#professional2').innerHTML=proOptions(partner,true,one);sync();
    consumption.get().push(...materials.filter(m=>currentIds().includes(m.owner)));$('#cost1').value=firstCost;$('#cost2').value=oldPartner===partner?secondCost:'0';
    previousIds=currentIds();drawMaterials();refresh();closeModal();
   };
  };
  $('#calcform').onsubmit=e=>{e.preventDefault();if(validCalc())recordForm()};sync();refresh();
 };
 window.addConsumption=()=>{const p=state.products.find(p=>p.id===$('#consumeProduct').value),qty=+$('#consumeQty').value;if(!p||p.deleted||qty<=0)return toast('Selecione o produto e a quantidade.');const slot=currentIds().indexOf(p.owner);if(slot<0)return toast('O produto pertence a uma profissional que não participa deste procedimento. Selecione a proprietária na parceria ou use outro lote.');if(p.expiry&&p.expiry<today())return toast('Esse lote está vencido.');const used=total(consumption.get().filter(c=>c.id===p.id),c=>c.qty);if(qty+used>p.balance){$('#manualPricingCosts').open=true;return toast('Lembre-se de revisar seu estoque. Você pode informar o custo manualmente e registrar sem baixar este lote.');}const cost=Math.round(p.price/p.quantity*qty*100)/100;consumption.get().push({id:p.id,mid:uid(),qty,cost,owner:p.owner});$('#cost'+(slot+1)).value=(+$('#cost'+(slot+1)).value+cost).toFixed(2);updateResult();$('#consumptionList').innerHTML=consumption.get().map(c=>`<small>${esc(state.products.find(p=>p.id===c.id).name)} · ${c.qty} · ${money(c.cost)}</small>`).join('')};
 const oldRecordTeam=recordForm;
 recordForm=function(id){oldRecordTeam(id);const f=$('#cloudRecord');if(!f)return;const r=state.records.find(x=>x.id===id)||readCalc();for(const [key,i] of [['cost1',0],['cost2',1]])if(f.elements[key])f.elements[key].closest('.field').firstChild.textContent='Produtos e insumos de '+(recordNames(r)[i]||'parceria')+' (R$)';if(recordNames(r).length===1&&f.elements.cost2){f.elements.cost2.closest('.field').hidden=true;f.elements.cost2.value=0}};
 const oldDetailTeam=window.recordDetail;
 window.recordDetail=id=>{oldDetailTeam(id);const r=state.records.find(x=>x.id===id);if(recordNames(r).length===1)$('#dialogbody').querySelectorAll('.row')[1]?.remove()};
 const requireActiveAppointment=()=>{const f=$('#appointmentform');if(!f)return;f.elements.pro.required=true;const submit=f.onsubmit;f.onsubmit=e=>{e.preventDefault();if(!f.reportValidity()||!active().includes(Number(f.elements.pro.value)))return toast('Selecione uma profissional ativa para o horário.');submit(e)}};
 const oldAppointmentTeam=appointmentForm;
 appointmentForm=function(){oldAppointmentTeam();requireActiveAppointment()};
 const oldEditAppointmentTeam=window.editAppointment;
 window.editAppointment=id=>{oldEditAppointmentTeam(id);requireActiveAppointment()};
 const oldFinanceTeam=financeContent;
 financeContent=function(){oldFinanceTeam();const rs=state.records.filter(r=>!r.deleted&&r.date.slice(0,7)===$('#financeMonth').value);$('#financeContent .stats')?.remove();$('#financeContent').insertAdjacentHTML('afterbegin',stats([['Receita registrada',money(total(rs,r=>calc(r).total)),'Recebidos e pendentes'],['Produtos e insumos',money(total(rs,r=>r.cost1+r.cost2)),'Quantidade utilizada nos atendimentos'],...state.names.flatMap((n,id)=>(state.inactivePros||[]).includes(id)&&!rs.some(r=>model.recordProfessionalIds(r).includes(id))?[]:[[esc(n)+((state.inactivePros||[]).includes(id)?' · histórico':''),money(total(rs,r=>{const slot=model.recordProfessionalIds(r).indexOf(id);return slot===0?calc(r).net1:slot===1?calc(r).net2:0})),'Sobra após produtos e taxas']])]));};
 const oldSettingsTeam=settings;
 settings=function(){oldSettingsTeam();const f=$('#settingsform');$('#app h1').textContent='Sua equipe, do seu jeito.';$('#app .heading p').textContent='Cadastre somente as profissionais que trabalham nesta clínica.';f.innerHTML=`<h2>Profissionais da clínica</h2><p>${active().length===1?'Você tem uma pessoa na equipe.':active().length+' pessoas na equipe.'} Adicione outra somente quando precisar.</p><div id="professionalRows">${active().map(i=>{const name=state.names[i];return `<div class="row"><label class="field" style="flex:1">Nome${(state.inactivePros||[]).includes(i)?' · removida da equipe ativa':''}<input name="professional-${i}" value="${esc(name)}" maxlength="60" required></label><button type="button" class="secondary" data-team-toggle="${i}">${(state.inactivePros||[]).includes(i)?'Reativar':'Remover'}</button></div>`}).join('')}</div>${(state.inactivePros||[]).length?`<details class="sectiongap"><summary>Profissionais removidas (${state.inactivePros.length})</summary><p>Fora da equipe ativa. Os registros anteriores continuam preservados.</p>${state.inactivePros.map(i=>`<div class="row"><span>${esc(state.names[i])}</span><button type="button" class="secondary" data-team-toggle="${i}">Reativar</button></div>`).join('')}</details>`:''}<button type="button" class="secondary" id="teamAdd">＋ Adicionar profissional</button><label class="field sectiongap" ${active().length===1?'hidden':''}>Percentual padrão da primeira profissional nas parcerias<input name="percent" type="number" min="0" max="100" step="0.01" value="${state.percent}" required></label><small>Em atendimento individual, 100% fica com a profissional selecionada. Remover da equipe preserva o histórico e não revoga o login; gerencie os acessos em “Clínica e acesso”.</small><button class="sectiongap">Salvar nomes e regra padrão</button>`;
 $('#app h1').textContent='Seu espaço de trabalho';$('#app .heading p').textContent='Use sozinha ou com uma equipe, mesmo atendendo em locais alugados.';
 f.querySelector('h2').textContent=active().length===1?'Seu nome profissional':'Profissionais e parcerias';
 f.querySelector('p').textContent='Cadastre nomes para a agenda e para dividir valores. Isso não cria contas nem compartilha seus dados.';
 f.querySelector('small').textContent='Atende em locais diferentes? Você pode manter sua agenda, pacientes e materiais neste mesmo espaço. Adicione outras pessoas apenas quando precisar.';
 const accessCard=$('#memberForm')?.closest('.card');
 if(accessCard){
  accessCard.querySelector('h2').textContent='Meu espaço e acesso';
  const note=accessCard.querySelector('small');if(note)note.textContent='Para usar sozinha, não é preciso convidar ninguém. Compartilhe a gestão apenas com quem poderá ver os dados deste espaço.';
  const details=document.createElement('details');details.id='sharedManagement';details.className='sectiongap';const summary=document.createElement('summary');summary.textContent='Compartilhar a gestão com outra conta';details.append(summary);accessCard.insertBefore(details,$('#memberForm'));details.append($('#memberForm'),$('#memberList'));
  $('#memberForm label').firstChild.textContent='E-mail de quem vai acessar este espaço';$('#memberForm button').textContent='Dar acesso à gestão';
 }
 if(options.cloud.clinics.length===1)$('#clinicSwitch')?.closest('.field').setAttribute('hidden','');
 const saveNames=()=>{for(let i=0;i<state.names.length;i++){const input=f.elements['professional-'+i];if(input)state.names[i]=input.value.trim()}state.percent=+f.elements.percent.value};
 f.onsubmit=e=>{e.preventDefault();saveNames();persist('Atualização da equipe');toast('Equipe enviada para salvar.');settings()};
 $('#teamAdd').onclick=()=>{if(!f.reportValidity())return;if(state.names.length>=20)return toast('Limite de 20 cadastros por clínica. Reative uma profissional existente.');saveNames();state.names.push('Nova profissional');persist('Adição de profissional');settings()};
 f.querySelectorAll('[data-team-toggle]').forEach(b=>b.onclick=()=>{if(!f.reportValidity())return;saveNames();const id=+b.dataset.teamToggle;state.inactivePros??=[];if(state.inactivePros.includes(id))state.inactivePros=state.inactivePros.filter(i=>i!==id);else{const reason=model.checkArchive(state,id,today());if(reason)return toast(reason);if(!confirm('Remover '+state.names[id]+' da equipe ativa? O histórico será preservado e o acesso de login não será alterado.'))return;state.inactivePros.push(id)}persist('Alteração da equipe ativa');settings()});
 };
 route();
};
