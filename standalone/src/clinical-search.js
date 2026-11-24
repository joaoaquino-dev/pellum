const date=value=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
export function mountClinicalSearch({container,service,patient,initial={},onBack,onOpenRecord,onHistory,onBusy=()=>{}}){
 let alive=true,busy=false,items=[],cursor=null,lastCriteria=null;
 const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node};
 const button=(text,fn)=>{const node=el('button',text);node.type='button';node.className='secondary';node.onclick=fn;return node};
 const setBusy=value=>{busy=value;if(alive)onBusy(value)};
 const title=el('h3','Pesquisar no prontuário'),status=el('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const form=el('form');form.id='clinicalHistorySearch';const field=(text,input,parent=form)=>{const label=el('label',text);label.className='field';label.append(input);parent.append(label)};
 const query=el('input');query.type='search';query.name='query';query.maxLength=200;query.autocomplete='off';query.placeholder='Texto, produto ou observação';query.value=initial.query||'';field('O que você procura?',query);
 const filters=el('details');filters.className='clinical-optional';filters.append(el('summary','Tipo, período e versões'));filters.open=!!(initial.kind||initial.from||initial.to||initial.includeHistory);form.append(filters);
 const kind=el('select');kind.name='kind';kind.append(new Option('Todos os registros',''));for(const [value,label] of Object.entries(service.model.clinicalKinds))kind.append(new Option(label,value));kind.value=initial.kind||'';field('Tipo de registro',kind,filters);
 const period=el('div');period.className='clinical-search-period';filters.append(period);const from=el('input');from.type='date';from.name='from';from.value=initial.from||'';field('Data do atendimento: de',from,period);const to=el('input');to.type='date';to.name='to';to.value=initial.to||'';field('Até',to,period);
 const old=el('input');old.type='checkbox';old.name='includeHistory';old.checked=!!initial.includeHistory;const oldLabel=el('label');oldLabel.className='field';const line=el('span');line.append(old,document.createTextNode(' Incluir versões anteriores'));oldLabel.append(line);filters.append(oldLabel);
 const submit=el('button','Pesquisar');submit.type='submit';const clear=button('Limpar filtros',()=>{if(busy)return;query.value='';kind.value='';from.value='';to.value='';old.checked=false;run(false)});const actions=el('div');actions.className='actions';actions.append(submit,clear);form.append(actions);
 const results=el('section');results.className='clinical-search-results';results.setAttribute('aria-label','Resultados da pesquisa');const more=button('Mais resultados',()=>run(true));more.hidden=true;
 container.replaceChildren(button('Voltar ao prontuário',()=>{if(!busy)onBack()}),title,form,status,results,more);
 const criteria=()=>({query:query.value.trim(),kind:kind.value,from:from.value,to:to.value,includeHistory:old.checked});
 function draw(){
  results.hidden=false;results.replaceChildren();for(const item of items){const card=el('article');card.className='card clinical-search-card';card.append(el('h4',service.model.clinicalKinds[item.kind]||'Registro'),el('small',date(item.occurredAt)+' · '+item.professionalName+' · v'+item.version+(item.historical?' · versão anterior':'')));const text=el('p',item.payload.summary||'Sem resumo');text.className='clinical-search-summary';card.append(text);
   const controls=el('div');controls.className='toolbar';const open=button(item.historical?'Ver versão encontrada':'Abrir registro',()=>openWith(()=>onOpenRecord(item)));const history=button('Ver versões',()=>openWith(()=>onHistory(item)));controls.append(open,history);card.append(controls);results.append(card);
  }
  if(!items.length)results.append(el('p','Nenhum registro encontrado. Confira os filtros ou inclua versões anteriores.'));
 }
 async function openWith(action){if(busy)return;setBusy(true);try{await action()}catch(error){if(alive)status.textContent=error.message}finally{setBusy(false)}}
 async function run(append){
  if(busy)return;if(!form.reportValidity())return;if(from.value&&to.value&&from.value>to.value){status.textContent='A data inicial deve vir antes da data final.';return}
  const body=append?lastCriteria:criteria();if(!body)return;const fingerprint=JSON.stringify(body);setBusy(true);submit.disabled=true;more.disabled=true;clear.disabled=true;status.textContent='Pesquisando…';
  try{
   const response=await service.searchCall(patient,{...body,...(append&&cursor?{cursor}:{})});if(!alive)return;
   if(fingerprint!==JSON.stringify(criteria())){status.textContent='Toque em Pesquisar para aplicar os novos filtros.';return}
   if(!append)items=[];for(const item of response.items)if(!items.some(existing=>existing.id===item.id&&existing.version===item.version))items.push(item);cursor=response.cursor;lastCriteria=body;more.hidden=!response.hasMore;draw();status.textContent=items.length+' registro(s) exibido(s).'+(response.hasMore?' Há mais resultados.':'');
  }catch(error){if(alive)status.textContent=error.message}finally{setBusy(false);if(alive){submit.disabled=false;more.disabled=false;clear.disabled=false}}
 }
 form.onsubmit=event=>{event.preventDefault();run(false)};const changed=()=>{more.hidden=true;results.hidden=true;status.textContent='Toque em Pesquisar para aplicar os filtros.'};form.addEventListener('input',changed);form.addEventListener('change',changed);run(false);
 return {dispose(){alive=false;items=[];container.replaceChildren()},get pending(){return busy}};
}
