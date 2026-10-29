// Exclusion hides a stock item while retaining its consumption and cost history.
const connectBeforeProducts=window.AURA_CONNECT;
window.AURA_CONNECT=function(options){
 connectBeforeProducts(options);
 const syncReady=()=>{const s=window.AURA_CLINIC_SYNC?.();if(!s||s.pending||s.blocked){toast('Aguarde o salvamento antes de alterar o item.');return false}return true};
 window.editProduct=id=>{
  const item=state.products.find(p=>p.id===id&&!p.deleted);if(!item||!syncReady())return;
  window.productForm();const form=$('#supplyForm');
  const locked=!!item.movements?.length||state.records.some(r=>r.materials?.some(m=>m.id===id));
  $('#dialogbody h2').textContent='Editar produto ou insumo';
  const immutable=['price','quantity','owner','packCount','unit','lot','expiry'];
  for(const [key,value] of Object.entries(item)){const el=form.elements[key];if(el&&key!=='unitPrice')el.value=String(value)}
  form.elements.category.value=item.category||'product';form.elements.packCount.value=item.packCount||1;
  form.elements.quantity.dispatchEvent(new Event('input'));
  $('#supplySummary').textContent='Saldo atual: '+item.balance+' '+item.unit+(locked?' · Lote já movimentado: valores de compra e identificação preservados. Para uma nova compra, cadastre outro lote.':' · Você pode corrigir os dados desta compra antes da primeira movimentação.');
  if(locked)for(const key of [...immutable,'unitPrice'])form.elements[key].disabled=true;
  form.onsubmit=e=>{
   e.preventDefault();if(!form.reportValidity()||!syncReady())return;
   const fields=Object.fromEntries(new FormData(form));delete fields.unitPrice;fields.name=fields.name.trim();if(!fields.name)return;
   for(const key of ['price','quantity','owner','packCount','minimum'])if(fields[key]!==undefined)fields[key]=Number(fields[key]);
   const updated={...item,...fields};
   if(locked)for(const key of immutable)updated[key]=item[key];
   else updated.balance=Math.round(updated.quantity*updated.packCount*1000)/1000;
   state.products[state.products.indexOf(item)]=updated;
   persist('Edição de produto ou insumo');closeModal();route();toast('Alteração enviada para salvar.');
  };
 };
 window.removeProduct=id=>{
  const item=state.products.find(p=>p.id===id&&!p.deleted);if(!item||!syncReady())return;
  showModal(`<h2>Excluir produto ou insumo</h2><p>Excluir <b>${esc(item.name)}</b>${item.lot?' · lote '+esc(item.lot):''} da lista ativa?</p><p>Saldo atual: ${item.balance} ${esc(item.unit)}. O item sairá do estoque e da precificação. Atendimentos, custos e movimentações anteriores serão preservados.</p><div class="actions"><button class="secondary" id="cancelProductDelete">Cancelar</button><button class="danger" id="confirmProductDelete">Excluir item</button></div>`);
  $('#cancelProductDelete').onclick=closeModal;
  $('#confirmProductDelete').onclick=()=>{if(!syncReady())return;item.deleted=true;persist('Exclusão de produto ou insumo da lista ativa');closeModal();route();toast('Exclusão enviada para salvar.');};
 };
 const priorMovement=window.stockMovement;
 window.stockMovement=id=>{if(!state.products.some(p=>p.id===id&&!p.deleted))return toast('Este item foi excluído da lista ativa.');priorMovement(id)};
};
