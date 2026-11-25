const defaultProcedureCatalog=procedures.slice();
const connectBeforeCatalog=window.AURA_CONNECT;
window.AURA_CONNECT=function(options){
 const allCatalog=()=>[...defaultProcedureCatalog,...(state.customProcedures||[])];
 const refreshCatalog=()=>procedures.splice(0,procedures.length,...allCatalog().filter(name=>!(state.hiddenProcedures||[]).includes(name)));
 const readStoredPrice=name=>{
  if(!state.procedurePrices||typeof state.procedurePrices!=='object')return null;
  if(!Object.prototype.hasOwnProperty.call(state.procedurePrices,name))return null;
  const v=Number(state.procedurePrices[name]);
  return Number.isFinite(v)&&v>=0&&v<=100000000?Math.round(v*100)/100:null;
 };
 const saveStoredPrice=(name,rawValue,label='Preço padrão do procedimento')=>{
  const cleanName=String(name||'').trim();
  if(!cleanName)return false;
  const before=state.procedurePrices?{...state.procedurePrices}:undefined;
  const next={...(state.procedurePrices||{})};
  if(rawValue===null||rawValue===undefined||String(rawValue).trim()===''){
   delete next[cleanName];
  }else{
   const parsed=Number(rawValue);
   if(!Number.isFinite(parsed)||parsed<0||parsed>100000000){
    toast('Informe um valor padrão válido.');
    return false;
   }
   next[cleanName]=Math.round(parsed*100)/100;
  }
  if(Object.keys(next).length)state.procedurePrices=next;
  else delete state.procedurePrices;
  if(persist(label)===false){
   if(before===undefined)delete state.procedurePrices;
   else state.procedurePrices=before;
   return false;
  }
  return true;
 };
 window.AURA_PROCEDURE_PRICE={
  get:readStoredPrice,
  set:saveStoredPrice
 };
 refreshCatalog();
 connectBeforeCatalog(options);
 // Reports include historical names even after a service leaves the active catalog.
 procedureBars=function(rs){const data=[...new Set(rs.map(r=>r.procedure))].map(p=>({p,v:total(rs.filter(r=>r.procedure===p),r=>calc(r).total)})).filter(x=>x.v).sort((a,b)=>b.v-a.v);return data.length?data.slice(0,4).map(x=>`<div style="margin:18px 0"><div class="inline" style="justify-content:space-between"><span class="sub">${esc(x.p)}</span><b class="sub">${money(x.v)}</b></div><div class="progress"><span style="width:${x.v/data[0].v*100}%"></span></div></div>`).join(''):'<div class="empty">Registre atendimentos para ver os resultados.</div>'};
 const oldSettingsCatalog=settings;
 settings=function(){
  oldSettingsCatalog();
  $('#app').insertAdjacentHTML('beforeend',`<section class="card sectiongap procedure-catalog" id="procedureCatalog"><h2>Procedimentos da clínica</h2><p>Cadastre os serviços e defina o valor padrão para preencher automaticamente na agenda e na precificação.</p><form id="procedureCatalogForm" class="procedure-add"><label class="field">Nome do procedimento<input name="procedure" maxlength="120" placeholder="Ex.: Drenagem linfática" required autocomplete="off"></label><label class="field procedure-price-field">Valor padrão (R$)<input name="defaultPrice" type="number" min="0" max="100000000" step="0.01" placeholder="Opcional" autocomplete="off"></label><button>Adicionar procedimento</button></form><div class="procedure-list-head"><h3>Disponíveis (<span id="procedureCount">${procedures.length}</span>)</h3><label class="field">Buscar procedimento<input id="procedureSearch" type="search" placeholder="Digite o nome" autocomplete="off"></label></div><div id="procedureList"></div><details id="removedProcedures" class="sectiongap"><summary>Procedimentos excluídos (${(state.hiddenProcedures||[]).length})</summary><p>Você pode restaurar um serviço a qualquer momento.</p><div id="removedProcedureList"></div></details></section>`);
  const list=$('#procedureList'), removed=$('#removedProcedureList');
  function openPriceModal(name){
   const current=readStoredPrice(name);
   showModal(`<h2>Preço padrão</h2><p><strong>${esc(name)}</strong></p><p>Esse valor preenche automaticamente na Precificação e aparece como previsão na Agenda. Você sempre poderá ajustar ou dar desconto em cada atendimento.</p><form id="procedurePriceForm"><label class="field">Valor padrão (R$)<input name="price" type="number" min="0" max="100000000" step="0.01" value="${current!==null?current:''}" placeholder="Deixe vazio para remover"></label><div class="actions"><button type="button" class="secondary" id="cancelProcedurePrice">Cancelar</button>${current!==null?'<button type="button" class="secondary danger" id="clearProcedurePrice">Remover preço</button>':''}<button type="submit">Salvar preço</button></div></form>`);
   $('#cancelProcedurePrice').onclick=closeModal;
   const clearBtn=$('#clearProcedurePrice');
   if(clearBtn){
    clearBtn.onclick=()=>{
     if(saveStoredPrice(name,null,'Remoção de preço padrão')){
      closeModal();render();toast('Preço padrão removido.');
     }
    };
   }
   $('#procedurePriceForm').onsubmit=e=>{
    e.preventDefault();
    const val=e.target.elements.price.value;
    if(saveStoredPrice(name,val,'Preço padrão do procedimento')){
     closeModal();render();toast(val.trim()===''?'Preço padrão removido.':'Preço padrão salvo.');
    }
   };
  }
  function row(name,restore){const el=document.createElement('div');el.className='procedure-item';const info=document.createElement('div');info.className='procedure-item-meta';const label=document.createElement('span');label.textContent=name;info.append(label);if(!restore){const p=readStoredPrice(name);const sub=document.createElement('small');sub.textContent=p!==null?`Valor padrão: ${money(p)}`:'Sem valor padrão';info.append(sub);}const actions=document.createElement('div');actions.className='procedure-item-actions';if(!restore){const priceBtn=document.createElement('button');priceBtn.type='button';priceBtn.className='secondary';priceBtn.textContent=readStoredPrice(name)!==null?'Editar preço':'Definir preço';priceBtn.setAttribute('aria-label',`${priceBtn.textContent} de ${name}`);priceBtn.onclick=()=>openPriceModal(name);actions.append(priceBtn);}const button=document.createElement('button');button.type='button';button.className=restore?'secondary':'secondary danger';button.textContent=restore?'Restaurar':'Excluir';button.setAttribute('aria-label',(restore?'Restaurar ':'Excluir ')+name);button.onclick=()=>{
   if(restore){const before=state.hiddenProcedures;state.hiddenProcedures=before.filter(x=>x!==name);if(persist('Restauração de procedimento')===false){state.hiddenProcedures=before;return}refreshCatalog();render();toast('Procedimento restaurado.');return}
   if(procedures.length<=1)return toast('Mantenha pelo menos um procedimento disponível. Adicione outro antes de excluir este.');
   showModal(`<h2>Excluir procedimento?</h2><p><strong>${esc(name)}</strong> deixará de aparecer nas opções de novos agendamentos e simulações.</p><p>Atendimentos, agendamentos e valores anteriores serão preservados. Você poderá restaurar o procedimento nesta lista.</p><div class="actions"><button type="button" class="secondary" id="cancelProcedureDelete">Cancelar</button><button type="button" id="confirmProcedureDelete">Excluir procedimento</button></div>`);
   $('#cancelProcedureDelete').onclick=closeModal;
   $('#confirmProcedureDelete').onclick=()=>{const before=state.hiddenProcedures;state.hiddenProcedures=[...(before||[]),name];if(persist('Exclusão de procedimento')===false){if(before===undefined)delete state.hiddenProcedures;else state.hiddenProcedures=before;return}refreshCatalog();closeModal();render();$('#procedureSearch').focus({preventScroll:true});toast('Procedimento excluído. Histórico preservado.');};
  };actions.append(button);el.append(info,actions);return el;}
  function render(){const query=$('#procedureSearch').value.trim().toLocaleLowerCase('pt-BR');const matches=procedures.filter(name=>name.toLocaleLowerCase('pt-BR').includes(query));list.replaceChildren(...matches.map(name=>row(name,false)));if(!matches.length){const p=document.createElement('p');p.className='empty';p.textContent='Nenhum procedimento encontrado.';list.append(p)}removed.replaceChildren(...(state.hiddenProcedures||[]).map(name=>row(name,true)));$('#procedureCount').textContent=procedures.length;$('#removedProcedures summary').textContent=`Procedimentos excluídos (${(state.hiddenProcedures||[]).length})`;$('#removedProcedures').hidden=!(state.hiddenProcedures||[]).length;}
  $('#procedureSearch').oninput=render;
  $('#procedureCatalogForm').onsubmit=e=>{e.preventDefault();const input=e.target.elements.procedure,priceInput=e.target.elements.defaultPrice,name=input.value.trim(),rawPrice=priceInput?.value?.trim()||'';if(!name)return;const existing=allCatalog().find(p=>p.localeCompare(name,'pt-BR',{sensitivity:'base'})===0);if(existing){if((state.hiddenProcedures||[]).includes(existing)){toast('Este procedimento está nos excluídos. Use Restaurar.');$('#removedProcedures').open=true;$('#removedProcedures').scrollIntoView({block:'center'});}else toast('Esse procedimento já está cadastrado.');return}if((state.customProcedures||[]).length>=100)return toast('Limite de 100 procedimentos personalizados por clínica.');let parsedPrice=null;if(rawPrice!==''){parsedPrice=Number(rawPrice);if(!Number.isFinite(parsedPrice)||parsedPrice<0||parsedPrice>100000000)return toast('Informe um valor padrão válido.');parsedPrice=Math.round(parsedPrice*100)/100;}const before=state.customProcedures,beforePrices=state.procedurePrices?{...state.procedurePrices}:undefined;state.customProcedures=[...(before||[]),name];if(parsedPrice!==null)state.procedurePrices={...(state.procedurePrices||{}),[name]:parsedPrice};if(persist('Cadastro de procedimento')===false){if(before===undefined)delete state.customProcedures;else state.customProcedures=before;if(beforePrices===undefined)delete state.procedurePrices;else state.procedurePrices=beforePrices;return}refreshCatalog();input.value='';if(priceInput)priceInput.value='';$('#procedureSearch').value='';render();input.focus({preventScroll:true});toast('Procedimento adicionado à agenda e à precificação.');};
  render();
 };
 route();
};
