const connectBeforeBatch = window.AURA_CONNECT;
window.AURA_CONNECT = function(options) {
 connectBeforeBatch(options);
 const batch = window.AURA_BATCH_RECORDS;
 const consumption = window.AURA_CALC_CONSUMPTION;
 if (!batch) return;

 let batchItems = [];
 let preselectedPatientId = null;
 window.addEventListener('pellum:session-ended', () => {
  batchItems = [];
  preselectedPatientId = null;
 });

 const formatDateBr = iso => (iso ? String(iso).split('-').reverse().join('/') : '');
 const activePreselectedPatient = () => (
  preselectedPatientId ? state.patients.find(p => p.id === preselectedPatientId && !p.deleted) || null : null
 );
 const currentFormHasDraft = () => (
  Number($('#price')?.value || 0) > 0 || (consumption?.get?.().length || 0) > 0
 );

 const baseAddConsumption = window.addConsumption;
 window.addConsumption = () => {
  const select = $('#consumeProduct');
  const qtyInput = $('#consumeQty');
  const p = state.products.find(x => x.id === select?.value);
  const qty = Number(qtyInput?.value || 0);
  if (p && !p.deleted && qty > 0 && batchItems.length) {
   const reserved = batch.reservedProductQty(batchItems, p.id);
   const draftUsed = total(consumption.get().filter(c => c.id === p.id), c => c.qty);
   if (batch.roundQty(qty + draftUsed + reserved) > batch.roundQty(p.balance)) {
    const manual = $('#manualPricingCosts');
    if (manual) manual.open = true;
    return toast('Saldo insuficiente somando os procedimentos já adicionados à lista. Você pode informar o custo manualmente.');
   }
  }
  return baseAddConsumption();
 };

 const baseQuotePreview = window.quotePreview;
 window.quotePreview = () => {
  if (!batchItems.length) return baseQuotePreview();
  const list = batchItems.slice();
  if (currentFormHasDraft()) {
   if (!validCalc()) return;
   list.push(readCalc());
  }
  const totalAmount = list.reduce((sum, item) => sum + calc(item).total, 0);
  const lines = list.map(item => `• ${item.procedure}: ${money(calc(item).total)}`).join('\n');
  const clinicName = options?.cloud?.clinic?.name || 'Pellum';
  showModal(`<h2>Orçamento para a paciente</h2><p>Confira a mensagem com todos os procedimentos e acrescente condições de pagamento e validade antes de enviar.</p><textarea id="quoteText" style="width:100%;min-height:190px;font:inherit">${esc(clinicName)}\nOrçamento de procedimentos:\n${esc(lines)}\nTotal: ${money(totalAmount)}\nEntre em contato para combinar o agendamento.</textarea><div class="actions"><button type="button" class="secondary" id="closeBatchQuote">Fechar</button><a class="button" id="quoteWhats" target="_blank" rel="noopener">Abrir no WhatsApp</a></div>`);
  $('#closeBatchQuote').onclick = closeModal;
  const link = () => { $('#quoteWhats').href = 'https://wa.me/?text=' + encodeURIComponent($('#quoteText').value); };
  $('#quoteText').oninput = link;
  link();
 };

 function openBatchRecordModal(items) {
  if (!state.patients.some(p => !p.deleted)) {
   toast('Cadastre uma paciente antes de registrar o atendimento.');
   location.hash = 'pacientes';
   return;
  }
  const totalCents = items.reduce((sum, item) => sum + batch.itemNetTotalCents(item), 0);
  const totalAmount = batch.fromCents(totalCents);
  const participantIds = [...new Set(items.flatMap(item => item.professionalIds || [0, 1]))];
  const collectorOptions = participantIds
   .map(id => `<option value="${id}">${esc(state.names[id] || 'Profissional')}</option>`)
   .join('');
  const summaryRows = items.map(item => {
   const names = recordNames(item);
   const modeLabel = names.length === 1 ? names[0] : `${names[0]} / ${names[1]} (${item.percent}%)`;
   return `<div class="row"><div><b>${esc(item.procedure)}</b><small>${esc(modeLabel)}</small></div><b>${money(calc(item).total)}</b></div>`;
  }).join('');

  showModal(`<h2>Registrar atendimento (${items.length} procedimentos)</h2>
   <div class="batch-modal-summary">${summaryRows}<div class="row batch-modal-total"><span>Total dos procedimentos</span><b>${money(totalAmount)}</b></div></div>
   <form id="batchRecordForm">
    <label class="field">Paciente<select name="patient" required>${patientOptions()}</select></label>
    <label class="field">Data<input name="date" type="date" value="${today()}" required></label>
    <label class="field" ${participantIds.length <= 1 ? 'hidden' : ''}>Quem recebeu / receberá da paciente?<select name="collector">${collectorOptions}</select></label>
    <label class="field">Já recebido (sinal ou pagamento) R$<input name="received" type="number" value="0" min="0" max="${totalAmount.toFixed(2)}" step="0.01" required></label>
    <label class="field">Quantidade de parcelas do saldo<input name="installments" type="number" value="1" min="1" max="36" step="1" required></label>
    <label class="field">Primeiro vencimento do saldo<input name="due" type="date" value="${today()}" required></label>
    <label class="field">Retorno de um atendimento anterior<select name="parent"><option value="">Atendimento principal</option>${state.records.filter(x => !x.deleted && !x.parent).map(x => `<option value="${x.id}">${esc(patient(x.patient))} · ${esc(x.procedure)} · ${x.date}</option>`).join('')}</select></label>
    <small>Cada procedimento é salvo com seus próprios materiais e divisão, preservando relatórios e estoque.</small>
    <div class="actions"><button type="button" class="secondary" id="cancelBatchRecord">Cancelar</button><button type="submit">Salvar ${items.length} procedimentos</button></div>
   </form>`);

  const form = $('#batchRecordForm');
  const preselected = activePreselectedPatient();
  if (preselected && form.elements.patient) form.elements.patient.value = preselected.id;
  $('#cancelBatchRecord').onclick = closeModal;
  form.onsubmit = e => {
   e.preventDefault();
   if (!form.reportValidity()) return;
   const f = Object.fromEntries(new FormData(form));
   const commit = batch.buildBatchCommit({
    items,
    products: state.products,
    patientId: f.patient,
    date: f.date,
    collectorProId: f.collector,
    receivedTotal: Number(f.received),
    installments: Number(f.installments),
    due: f.due,
    parent: f.parent || '',
    makeSchedule,
    uid
   });
   if (!commit.ok) return toast(commit.error);

   for (const d of commit.stockDeductions) {
    const product = state.products.find(p => p.id === d.productId);
    product.balance = batch.roundQty(product.balance - d.qty);
    (product.movements ??= []).push(d.movement);
   }
   state.records.push(...commit.records);
   persist(`Registro de atendimento com ${commit.records.length} procedimentos`);
   batchItems = [];
   consumption.reset();
   preselectedPatientId = null;
   closeModal();
   if (page === 'financeiro') financeContent();
   else if (page === 'calcular') calculator();
   toast(`${commit.records.length} procedimentos enviados para salvar.`);
  };
 }

 const baseRecordForm = recordForm;
 recordForm = function(existingId) {
  baseRecordForm(existingId);
  if (existingId) return;
  const form = $('#cloudRecord');
  if (!form) return;
  const preselected = activePreselectedPatient();
  if (preselected && form.elements.patient) form.elements.patient.value = preselected.id;
  const originalSubmit = form.onsubmit;
  form.onsubmit = e => {
   const before = state.records.length;
   const result = originalSubmit ? originalSubmit.call(form, e) : undefined;
   if (state.records.length > before) preselectedPatientId = null;
   return result;
  };
 };

 const baseCalculator = calculator;
 calculator = function() {
  baseCalculator();
  const form = $('#calcform');
  const resultCard = $('#result');
  if (!form || !resultCard) return;

  const preselected = activePreselectedPatient();
  if (preselected) {
   const banner = document.createElement('div');
   banner.className = 'hint batch-patient-banner';
   banner.innerHTML = `<div class="row"><span>Paciente selecionada: <b>${esc(preselected.name)}</b></span><button type="button" class="textbtn" id="clearPreselectedPatient">Trocar</button></div>`;
   form.prepend(banner);
   $('#clearPreselectedPatient').onclick = () => {
    preselectedPatientId = null;
    banner.remove();
   };
  }

  const actions = form.querySelector('.actions');
  const submitButton = actions?.querySelector('button[type="submit"]');
  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'secondary';
  addButton.id = 'addBatchProcedure';
  addButton.textContent = '＋ Adicionar à lista do atendimento';
  if (submitButton) submitButton.after(addButton);

  const batchCard = document.createElement('div');
  batchCard.className = 'card sectiongap batch-card';
  batchCard.id = 'batchCard';
  batchCard.setAttribute('aria-live', 'polite');
  batchCard.hidden = true;
  resultCard.after(batchCard);

  const updateSubmitLabel = () => {
   if (!submitButton) return;
   if (!batchItems.length) {
    submitButton.textContent = 'Registrar atendimento';
    return;
   }
   const count = batchItems.length + (currentFormHasDraft() ? 1 : 0);
   submitButton.textContent = `Registrar ${count} procedimento${count > 1 ? 's' : ''}`;
  };

  const drawBatch = () => {
   batchCard.hidden = !batchItems.length;
   if (!batchItems.length) {
    batchCard.replaceChildren();
    updateSubmitLabel();
    return;
   }
   const totalValue = batchItems.reduce((s, item) => s + calc(item).total, 0);
   const totalMaterials = batchItems.reduce((s, item) => s + Number(item.cost1 || 0) + Number(item.cost2 || 0), 0);
   const totalNet = batchItems.reduce((s, item) => {
    const c = calc(item);
    return s + c.net1 + (recordNames(item).length > 1 ? c.net2 : 0);
   }, 0);

   batchCard.innerHTML = `<div class="cardhead"><div><h2>Procedimentos neste atendimento (${batchItems.length})</h2><small>Serão salvos juntos para a mesma paciente</small></div><button type="button" class="textbtn danger" id="clearBatchList">Limpar lista</button></div><div id="batchListRows"></div><hr class="divider"><div class="row"><span>Total à paciente</span><b>${money(totalValue)}</b></div><div class="row"><span>Total em materiais</span><span>${money(totalMaterials)}</span></div><div class="row"><span>Sobra estimada do atendimento</span><b>${money(totalNet)}</b></div>`;

   const rowsEl = $('#batchListRows');
   batchItems.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'row batch-item-row';
    const info = document.createElement('div');
    const names = recordNames(item);
    const detailParts = [names.length === 1 ? names[0] : `${names[0]} / ${names[1]} (${item.percent}%)`];
    const matCost = Number(item.cost1 || 0) + Number(item.cost2 || 0);
    if (matCost > 0) detailParts.push(`Materiais ${money(matCost)}`);
    info.innerHTML = `<b>${esc(item.procedure)}</b><small>${esc(detailParts.join(' · '))}</small>`;

    const right = document.createElement('div');
    right.className = 'inline';
    const priceEl = document.createElement('b');
    priceEl.textContent = money(calc(item).total);
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'textbtn danger';
    removeBtn.textContent = 'Remover';
    removeBtn.setAttribute('aria-label', `Remover ${item.procedure} da lista`);
    removeBtn.onclick = () => {
     batchItems.splice(index, 1);
     drawBatch();
    };
    right.append(priceEl, removeBtn);
    row.append(info, right);
    rowsEl.append(row);
   });

   $('#clearBatchList').onclick = () => {
    batchItems = [];
    drawBatch();
    toast('Lista de procedimentos limpa.');
   };
   updateSubmitLabel();
  };

  const resetCurrentProcedureFields = () => {
   consumption.reset();
   if ($('#consumptionList')) $('#consumptionList').replaceChildren();
   if ($('#price')) $('#price').value = '0';
   if ($('#discount')) $('#discount').value = '0';
   if ($('#cost1')) $('#cost1').value = '0';
   if ($('#cost2')) $('#cost2').value = '0';
   updateResult();
  };

  addButton.onclick = () => {
   if (!validCalc()) return;
   const r = readCalc();
   const mats = consumption.get().map(m => ({ ...m }));
   const professionalIds = r.professionalIds || [0, 1];
   for (let i = 0; i < professionalIds.length; i++) {
    const owner = professionalIds[i];
    const matCents = mats.filter(m => m.owner === owner).reduce((s, m) => s + batch.roundCents(m.cost), 0);
    const declaredCents = batch.roundCents(r[i === 0 ? 'cost1' : 'cost2']);
    if (matCents > declaredCents) {
     return toast('O custo informado não pode ser menor que os materiais adicionados.');
    }
   }
   const nextItem = { ...r, materials: mats };
   const stockCheck = batch.validateBatchStock([...batchItems, nextItem], state.products, today());
   if (!stockCheck.ok) return toast(stockCheck.error);

   batchItems.push(nextItem);
   resetCurrentProcedureFields();
   drawBatch();
   $('#procedure')?.focus({ preventScroll: true });
   toast('Procedimento adicionado à lista. Inclua outro ou clique em Registrar.');
  };

  form.addEventListener('input', updateSubmitLabel);
  form.addEventListener('change', updateSubmitLabel);
  form.onsubmit = e => {
   e.preventDefault();
   if (!batchItems.length) {
    if (validCalc()) recordForm();
    return;
   }
   const itemsToSave = batchItems.slice();
   if (currentFormHasDraft()) {
    if (!validCalc()) return;
    const r = readCalc();
    const mats = consumption.get().map(m => ({ ...m }));
    itemsToSave.push({ ...r, materials: mats });
   }
   const stockCheck = batch.validateBatchStock(itemsToSave, state.products, today());
   if (!stockCheck.ok) return toast(stockCheck.error);
   openBatchRecordModal(itemsToSave);
  };

  drawBatch();
 };

 // Enhanced patient history: groups same-day procedures and offers direct "Novo atendimento" shortcut.
 patientHistory = function(id) {
  const p = state.patients.find(x => x.id === id);
  const groups = batch.groupRecordsByDate(state.records.filter(r => r.patient === id && !r.deleted));
  const body = groups.length
   ? groups.map(g => {
    const dayTotal = g.items.reduce((sum, r) => sum + calc(r).total, 0);
    const rows = g.items.map(r => `<div class="row"><div>${esc(r.procedure)}</div><b>${money(calc(r).total)}</b></div>`).join('');
    return `<div class="batch-history-day"><div class="batch-history-head"><span>${esc(formatDateBr(g.date))}</span>${g.items.length > 1 ? `<small>${g.items.length} procedimentos · ${money(dayTotal)}</small>` : ''}</div>${rows}</div>`;
   }).join('')
   : '<p>Nenhum atendimento registrado.</p>';

  showModal(`<h2>${esc(patient(id))}</h2>${body}<div class="actions">${p && !p.deleted ? '<button type="button" id="historyNewVisit">＋ Novo atendimento</button>' : ''}<button type="button" class="secondary" id="closePatientHistory">Fechar</button></div>`);
  $('#closePatientHistory').onclick = closeModal;
  const newVisitBtn = $('#historyNewVisit');
  if (newVisitBtn) {
   newVisitBtn.onclick = () => {
    preselectedPatientId = id;
    closeModal();
    if (location.hash === '#calcular') calculator();
    else location.hash = 'calcular';
   };
  }
 };

 // Multi-procedure support in Agenda appointments (joined in procedure string <= 120 chars).
 function enhanceAppointmentForm(initialProcedures = []) {
  const form = $('#appointmentform');
  if (!form) return;
  const existingSelect = form.querySelector('select[name="procedure"]');
  let hiddenInput = form.querySelector('input[type="hidden"][name="procedure"]');
  let picker = $('#agendaProcPicker');
  let chipsEl = $('#agendaProcChips');

  if (existingSelect) {
   const label = existingSelect.closest('label.field');
   hiddenInput = document.createElement('input');
   hiddenInput.type = 'hidden';
   hiddenInput.name = 'procedure';
   hiddenInput.value = existingSelect.value || procedures[0] || '';

   const pickerRow = document.createElement('div');
   pickerRow.className = 'batch-proc-picker';
   picker = document.createElement('select');
   picker.id = 'agendaProcPicker';
   picker.setAttribute('aria-label', 'Escolher procedimento para agendar');
   picker.innerHTML = existingSelect.innerHTML;
   const addBtn = document.createElement('button');
   addBtn.type = 'button';
   addBtn.className = 'secondary';
   addBtn.id = 'agendaProcAdd';
   addBtn.textContent = '＋ Adicionar';
   pickerRow.append(picker, addBtn);

   chipsEl = document.createElement('div');
   chipsEl.className = 'batch-chips';
   chipsEl.id = 'agendaProcChips';
   chipsEl.setAttribute('aria-live', 'polite');

   const hint = document.createElement('small');
   hint.textContent = 'Para mais de um procedimento no mesmo horário, use “＋ Adicionar” e ajuste a duração.';

   existingSelect.replaceWith(hiddenInput, pickerRow, chipsEl, hint);
  }

  if (!hiddenInput || !picker || !chipsEl) return;

  let selected = initialProcedures.slice();
  const syncHidden = () => {
   const list = selected.length ? selected : (picker.value ? [picker.value] : []);
   const joined = batch.joinAppointmentProcedures(list);
   hiddenInput.value = joined.ok ? joined.value : list.join(' + ');
  };

  const drawChips = () => {
   chipsEl.replaceChildren();
   selected.forEach((name, idx) => {
    const chip = document.createElement('span');
    chip.className = 'batch-chip';
    const text = document.createElement('span');
    text.textContent = name;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'batch-chip-remove';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remover ${name}`);
    remove.onclick = () => {
     selected.splice(idx, 1);
     drawChips();
    };
    chip.append(text, remove);
    chipsEl.append(chip);
   });
   syncHidden();
  };

  const addBtn = $('#agendaProcAdd');
  if (addBtn) {
   addBtn.onclick = () => {
    const chosen = picker.value;
    if (!chosen) return;
    const candidate = [...selected, chosen];
    const check = batch.joinAppointmentProcedures(candidate);
    if (!check.ok) return toast(check.error);
    selected = check.list;
    drawChips();
   };
  }
  picker.onchange = syncHidden;

  // Ensure any historical procedure name not in active catalog is still selectable.
  if (selected.length === 1 && !Array.from(picker.options).some(o => o.value === selected[0])) {
   picker.add(new Option(selected[0], selected[0]), 0);
   picker.value = selected[0];
  } else if (selected.length === 1) {
   picker.value = selected[0];
  }
  drawChips();

  const previousSubmit = form.onsubmit;
  form.onsubmit = e => {
   const list = selected.length ? selected : (picker.value ? [picker.value] : []);
   const check = batch.joinAppointmentProcedures(list);
   if (!check.ok) {
    e.preventDefault();
    return toast(check.error);
   }
   hiddenInput.value = check.value;
   return previousSubmit ? previousSubmit.call(form, e) : undefined;
  };
 }

 const priorBatchAppointmentForm = appointmentForm;
 appointmentForm = function() {
  priorBatchAppointmentForm();
  enhanceAppointmentForm([]);
 };

 const priorBatchEditAppointment = window.editAppointment;
 window.editAppointment = id => {
  priorBatchEditAppointment(id);
  const a = state.appointments.find(x => x.id === id);
  enhanceAppointmentForm(batch.splitAppointmentProcedures(a?.procedure));
 };

 const priorBatchReturnAppointment = window.returnAppointment;
 window.returnAppointment = id => {
  priorBatchReturnAppointment(id);
  const a = state.appointments.find(x => x.id === id);
  enhanceAppointmentForm(batch.splitAppointmentProcedures(a?.procedure));
 };

 if (page === 'calcular') calculator();
};
