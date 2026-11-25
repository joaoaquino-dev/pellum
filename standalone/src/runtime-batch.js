const connectBeforeBatch = window.AURA_CONNECT;
window.AURA_CONNECT = function(options) {
 connectBeforeBatch(options);
 const batch = window.AURA_BATCH_RECORDS;
 const consumption = window.AURA_CALC_CONSUMPTION;
 const phone = window.AURA_PHONE;
 if (!batch) return;

 let batchItems = [];
 let preselectedPatientId = null;
 let appointmentContext = null;
 let showDeletedRecords = false;

 window.addEventListener('pellum:session-ended', () => {
  batchItems = [];
  preselectedPatientId = null;
  appointmentContext = null;
  showDeletedRecords = false;
 });

 const whatsappSvg = '<svg class="ui-icon" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.8 7.4L3 21l1.8-5.2A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 7c0 5 4 8 8 9l1-3-3-1-1 1-3-3 1-1-1-2Z"/></svg>';
 const syncReady = (msg = 'Aguarde o salvamento antes de continuar.') => {
  const s = window.AURA_CLINIC_SYNC?.();
  if (s && (s.pending || s.blocked)) {
   toast(msg);
   return false;
  }
  return true;
 };
 const formatDateBr = iso => (iso ? String(iso).split('-').reverse().join('/') : '');
 const activePreselectedPatient = () => {
  const id = appointmentContext?.patientId || preselectedPatientId;
  return id ? state.patients.find(p => p.id === id && !p.deleted) || null : null;
 };
 const currentFormHasDraft = () => (
  Number($('#price')?.value || 0) > 0 || (consumption?.get?.().length || 0) > 0
 );
 const markLinkedAppointmentAttended = () => {
  if (!appointmentContext?.id) return;
  const app = state.appointments.find(x => x.id === appointmentContext.id);
  if (app && !app.deleted && ['Agendado', 'Confirmado'].includes(app.status) && !appointmentConflict(app)) {
   app.status = 'Atendido';
  }
 };

 // Ensure excluded records never inflate dashboard stats, 6-month chart, or CSV exports.
 monthRecords = () => state.records.filter(r => !r.deleted && r.date.slice(0, 7) === today().slice(0, 7));
 const baseChart = chart;
 chart = function() {
  const all = state.records;
  state.records = all.filter(r => !r.deleted);
  try {
   return baseChart();
  } finally {
   state.records = all;
  }
 };
 const baseExportCSV = exportCSV;
 exportCSV = function() {
  const all = state.records;
  state.records = all.filter(r => !r.deleted);
  try {
   return baseExportCSV();
  } finally {
   state.records = all;
  }
 };

 const baseReceivePayment = window.receivePayment;
 window.receivePayment = id => {
  if (state.records.find(r => r.id === id)?.deleted) {
   return toast('Restaure o atendimento antes de registrar recebimento.');
  }
  const result = baseReceivePayment(id);
  const payForm = $('#payForm');
  if (payForm && page !== 'financeiro') {
   const origSubmit = payForm.onsubmit;
   payForm.onsubmit = e => {
    const origFin = financeContent;
    financeContent = () => {
     if (page === 'agenda') renderCalendar();
     else if (page === 'inicio') dashboard();
     else route();
     toast('Recebimento registrado.');
    };
    try {
     return origSubmit ? origSubmit.call(payForm, e) : undefined;
    } finally {
     financeContent = origFin;
    }
   };
  }
  return result;
 };
 const baseTransferPayment = window.transferPayment;
 window.transferPayment = id => {
  if (state.records.find(r => r.id === id)?.deleted) {
   return toast('Restaure o atendimento antes de registrar repasse.');
  }
  return baseTransferPayment(id);
 };

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
  const defaultDate = appointmentContext?.date || today();
  const defaultDue = appointmentContext?.date && appointmentContext.date >= today() ? appointmentContext.date : today();

  showModal(`<h2>Registrar atendimento (${items.length} procedimentos)</h2>
   <div class="batch-modal-summary">${summaryRows}<div class="row batch-modal-total"><span>Total dos procedimentos</span><b>${money(totalAmount)}</b></div></div>
   <form id="batchRecordForm">
    <label class="field">Paciente<select name="patient" required>${patientOptions()}</select></label>
    <label class="field">Data<input name="date" type="date" value="${esc(defaultDate)}" required></label>
    <label class="field" ${participantIds.length <= 1 ? 'hidden' : ''}>Quem recebeu / receberá da paciente?<select name="collector">${collectorOptions}</select></label>
    <label class="field">Já recebido (sinal ou pagamento) R$<input name="received" type="number" value="0" min="0" max="${totalAmount.toFixed(2)}" step="0.01" required></label>
    <label class="field">Quantidade de parcelas do saldo<input name="installments" type="number" value="1" min="1" max="36" step="1" required></label>
    <label class="field">Primeiro vencimento do saldo<input name="due" type="date" value="${esc(defaultDue)}" required></label>
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
   if (!form.reportValidity() || !syncReady()) return;
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
    uid
   });
   if (!commit.ok) return toast(commit.error);

   for (const d of commit.stockDeductions) {
    const product = state.products.find(p => p.id === d.productId);
    product.balance = batch.roundQty(product.balance - d.qty);
    (product.movements ??= []).push(d.movement);
   }
   state.records.push(...commit.records);
   markLinkedAppointmentAttended();
   persist(`Registro de atendimento com ${commit.records.length} procedimentos`);
   batchItems = [];
   consumption.reset();
   preselectedPatientId = null;
   appointmentContext = null;
   closeModal();
   if (page === 'financeiro') financeContent();
   else if (page === 'calcular') calculator();
   toast(`${commit.records.length} procedimentos enviados para salvar.`);
  };
 }

 const baseRecordForm = recordForm;
 recordForm = function(existingId) {
  if (existingId && state.records.find(r => r.id === existingId)?.deleted) {
   return toast('Restaure o atendimento antes de editar.');
  }
  baseRecordForm(existingId);
  if (existingId) return;
  const form = $('#cloudRecord');
  if (!form) return;
  const preselected = activePreselectedPatient();
  if (preselected && form.elements.patient) form.elements.patient.value = preselected.id;
  if (appointmentContext?.date) {
   if (form.elements.date) form.elements.date.value = appointmentContext.date;
   if (form.elements.due) form.elements.due.value = appointmentContext.date >= today() ? appointmentContext.date : today();
  }
  const originalSubmit = form.onsubmit;
  form.onsubmit = e => {
   const realPersist = persist;
   persist = label => {
    markLinkedAppointmentAttended();
    persist = realPersist;
    const saved = realPersist(label);
    if (saved !== false) {
     preselectedPatientId = null;
     appointmentContext = null;
    }
    return saved;
   };
   try {
    return originalSubmit ? originalSubmit.call(form, e) : undefined;
   } finally {
    persist = realPersist;
   }
  };
 };

 const baseCalculator = calculator;
 calculator = function() {
  baseCalculator();
  const form = $('#calcform');
  const resultCard = $('#result');
  if (!form || !resultCard) return;

  const priceInput = $('#price');
  const discountInput = $('#discount');
  let finalPriceInput = null;
  let priceMetaEl = null;

  const syncFinalFromInputs = () => {
   if (!finalPriceInput || !priceInput || !discountInput) return;
   const val = batch.computeFinalFromDiscount(priceInput.value, discountInput.value);
   if (document.activeElement !== finalPriceInput) {
    finalPriceInput.value = val.toFixed(2).replace(/\.00$/, '');
   }
  };

  const updatePriceMeta = () => {
   if (!priceMetaEl || !priceInput) return;
   const procName = $('#procedure')?.value || '';
   const stored = window.AURA_PROCEDURE_PRICE?.get?.(procName) ?? null;
   const resolved = batch.resolveProcedurePrice(procName, state.procedurePrices, state.records);
   const currentPrice = Number(priceInput.value || 0);
   const currentCents = batch.roundCents(currentPrice);
   const storedCents = stored !== null ? batch.roundCents(stored) : null;
   let infoText = 'Sem preço padrão salvo';
   let btnLabel = 'Salvar como preço padrão';
   let showBtn = Number.isFinite(currentPrice) && currentPrice > 0;
   if (stored !== null) {
    if (storedCents === currentCents) {
     infoText = `Preço padrão salvo: ${money(stored)}`;
     showBtn = false;
    } else {
     infoText = `Preço padrão atual: ${money(stored)}`;
     btnLabel = 'Atualizar preço padrão';
    }
   } else if (resolved?.source === 'history') {
    infoText = `Último valor usado: ${money(resolved.price)}`;
   }
   priceMetaEl.innerHTML = `<span>${esc(infoText)}</span>${showBtn ? `<button type="button" class="textbtn" id="saveDefaultPriceBtn">${esc(btnLabel)}</button>` : ''}`;
   const saveBtn = $('#saveDefaultPriceBtn');
   if (saveBtn) {
    saveBtn.onclick = () => {
     if (!syncReady()) return;
     if (window.AURA_PROCEDURE_PRICE?.set?.(procName, priceInput.value)) {
      updatePriceMeta();
      toast(`Preço padrão de ${procName} salvo.`);
     }
    };
   }
  };

  const applyProcedureDefaultPrice = (procName, { force = false } = {}) => {
   if (!priceInput || !discountInput) return;
   const resolved = batch.resolveProcedurePrice(procName, state.procedurePrices, state.records);
   if (resolved) {
    priceInput.value = String(resolved.price);
    discountInput.value = '0';
   } else if (force) {
    priceInput.value = '0';
    discountInput.value = '0';
   }
   syncFinalFromInputs();
   updateResult();
   updatePriceMeta();
  };

  if (priceInput && discountInput) {
   const priceGrid = priceInput.closest('.formgrid');
   if (priceGrid) {
    priceGrid.classList.add('calc-price-grid');
    const finalField = document.createElement('label');
    finalField.className = 'field';
    finalField.innerHTML = 'Por quanto fechou (R$)<input id="finalPrice" type="number" min="0" step="0.01" placeholder="Valor final">';
    priceGrid.append(finalField);
    finalPriceInput = $('#finalPrice');

    priceMetaEl = document.createElement('div');
    priceMetaEl.className = 'calc-price-meta';
    priceGrid.after(priceMetaEl);

    priceInput.addEventListener('input', () => {
     syncFinalFromInputs();
     updatePriceMeta();
    });
    discountInput.addEventListener('input', () => {
     syncFinalFromInputs();
    });
    finalPriceInput.addEventListener('input', () => {
     if (finalPriceInput.value === '') return;
     const next = batch.computeDiscountFromFinal(priceInput.value, finalPriceInput.value);
     if (batch.roundCents(next.price) !== batch.roundCents(priceInput.value)) {
      priceInput.value = String(next.price);
     }
     discountInput.value = String(next.discount);
     updateResult();
     updatePriceMeta();
    });
   }
  }

  // Collapse secondary helper tools to keep Precificação lightweight on first contact.
  const packInput = $('#packPrice');
  const packHint = packInput?.closest('.hint');
  if (packHint && !packHint.closest('details')) {
   const details = document.createElement('details');
   details.className = 'calc-collapsible sectiongap';
   const summary = document.createElement('summary');
   summary.textContent = 'Calcular custo por embalagem (opcional)';
   packHint.replaceWith(details);
   details.append(summary, packHint);
  }
  const targetNetInput = $('#targetNet');
  if (targetNetInput) {
   const targetField = targetNetInput.closest('.field');
   const targetHeading = targetField?.previousElementSibling?.tagName === 'H2' ? targetField.previousElementSibling : null;
   const targetBtn = targetField?.nextElementSibling?.tagName === 'BUTTON' ? targetField.nextElementSibling : null;
   const targetSmall = targetBtn?.nextElementSibling?.tagName === 'SMALL' ? targetBtn.nextElementSibling : null;
   const targetHr = targetHeading?.previousElementSibling?.tagName === 'HR' ? targetHeading.previousElementSibling : null;
   if (targetField && !targetField.closest('details')) {
    const details = document.createElement('details');
    details.className = 'calc-collapsible sectiongap';
    const summary = document.createElement('summary');
    summary.textContent = 'Simular preço por objetivo de lucro (opcional)';
    const body = document.createElement('div');
    body.className = 'calc-collapsible-body';
    if (targetHr) targetHr.remove();
    if (targetHeading) {
     targetHeading.replaceWith(details);
     targetHeading.remove();
    } else {
     targetField.before(details);
    }
    body.append(targetField);
    if (targetBtn) body.append(targetBtn);
    if (targetSmall) body.append(targetSmall);
    details.append(summary, body);
   }
  }

  const selectProcedureOption = name => {
   const select = $('#procedure');
   if (!select || !name) return;
   if (!Array.from(select.options).some(o => o.value === name)) {
    select.add(new Option(name, name), 0);
   }
   select.value = name;
   applyProcedureDefaultPrice(name);
  };

  $('#procedure')?.addEventListener('change', e => {
   applyProcedureDefaultPrice(e.target.value);
  });

  if (appointmentContext) {
   const proSelect = $('#professional1');
   if (proSelect && Array.from(proSelect.options).some(o => o.value === String(appointmentContext.pro)) && proSelect.value !== String(appointmentContext.pro)) {
    proSelect.value = String(appointmentContext.pro);
    proSelect.onchange?.();
   }
   const targetProc = appointmentContext.procedures[appointmentContext.index] || appointmentContext.procedures[0];
   if (targetProc) selectProcedureOption(targetProc);
  } else {
   applyProcedureDefaultPrice($('#procedure')?.value || '');
  }

  let banner = null;
  const renderBanner = () => {
   const preselected = activePreselectedPatient();
   if (!preselected) {
    banner?.remove();
    banner = null;
    return;
   }
   if (!banner) {
    banner = document.createElement('div');
    banner.className = 'hint batch-patient-banner';
    form.prepend(banner);
   }
   if (appointmentContext) {
    const procs = appointmentContext.procedures || [];
    const procSummary = procs.length > 1
     ? `<small class="batch-banner-procs">Procedimentos agendados: ${procs.map((name, idx) => (idx < appointmentContext.index ? `${esc(name)} ✓` : idx === appointmentContext.index ? `<b>${esc(name)}</b>` : esc(name))).join(' · ')}</small>`
     : '';
    banner.innerHTML = `<div class="row"><div><span>Agendamento de <b>${esc(preselected.name)}</b> · ${esc(formatDateBr(appointmentContext.date))}</span>${procSummary}</div><button type="button" class="textbtn" id="clearPreselectedPatient">Desvincular</button></div>`;
   } else {
    banner.innerHTML = `<div class="row"><span>Paciente selecionada: <b>${esc(preselected.name)}</b></span><button type="button" class="textbtn" id="clearPreselectedPatient">Trocar</button></div>`;
   }
   $('#clearPreselectedPatient').onclick = () => {
    preselectedPatientId = null;
    appointmentContext = null;
    renderBanner();
   };
  };
  renderBanner();

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
   syncFinalFromInputs();
   updateResult();
   updatePriceMeta();
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
   const checkDate = appointmentContext?.date || today();
   const stockCheck = batch.validateBatchStock([...batchItems, nextItem], state.products, checkDate);
   if (!stockCheck.ok) return toast(stockCheck.error);

   batchItems.push(nextItem);
   resetCurrentProcedureFields();
   if (appointmentContext && appointmentContext.index + 1 < appointmentContext.procedures.length) {
    appointmentContext.index += 1;
    selectProcedureOption(appointmentContext.procedures[appointmentContext.index]);
    renderBanner();
    drawBatch();
    $('#price')?.focus({ preventScroll: true });
    toast(`Adicionado! Agora informe o valor de ${appointmentContext.procedures[appointmentContext.index]}.`);
    return;
   }
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
   const checkDate = appointmentContext?.date || today();
   const stockCheck = batch.validateBatchStock(itemsToSave, state.products, checkDate);
   if (!stockCheck.ok) return toast(stockCheck.error);
   openBatchRecordModal(itemsToSave);
  };

  drawBatch();
  if (appointmentContext && !batchItems.length) {
   $('#price')?.focus({ preventScroll: true });
  }
 };

 // Enhanced patient history: groups same-day procedures, surfaces discounts/payment status, and offers direct "Novo atendimento" shortcut.
 patientHistory = function(id) {
  const p = state.patients.find(x => x.id === id);
  const groups = batch.groupRecordsByDate(state.records.filter(r => r.patient === id && !r.deleted));
  const body = groups.length
   ? groups.map(g => {
    const dayTotal = g.items.reduce((sum, r) => sum + calc(r).total, 0);
    const rows = g.items.map(r => {
     const totalVal = calc(r).total;
     const receivedVal = r.received ?? (r.paid ? totalVal : 0);
     const pendingVal = Math.max(0, Math.round((totalVal - receivedVal) * 100) / 100);
     const disc = batch.formatDiscountSummary(r.price, r.discount);
     const discLine = disc
      ? `<small class="history-item-meta">Tabela ${money(disc.price)} · Desconto ${money(disc.discount)} (${disc.percent}%)</small>`
      : '';
     const payBadge = pendingVal === 0
      ? '<span class="finance-badge paid">Pago</span>'
      : `<span class="finance-badge pending">Falta ${money(pendingVal)}</span>`;
     return `<div class="row history-item-row"><div><span>${esc(r.procedure)}</span>${discLine}</div><div class="history-item-right"><b>${money(totalVal)}</b>${payBadge}</div></div>`;
    }).join('');
    return `<div class="batch-history-day"><div class="batch-history-head"><span>${esc(formatDateBr(g.date))}</span>${g.items.length > 1 ? `<small>${g.items.length} procedimentos · ${money(dayTotal)}</small>` : ''}</div>${rows}</div>`;
   }).join('')
   : '<p>Nenhum atendimento registrado.</p>';

  showModal(`<h2>${esc(patient(id))}</h2>${body}<div class="actions">${p && !p.deleted ? '<button type="button" id="historyNewVisit">＋ Novo atendimento</button>' : ''}<button type="button" class="secondary" id="closePatientHistory">Fechar</button></div>`);
  $('#closePatientHistory').onclick = closeModal;
  const newVisitBtn = $('#historyNewVisit');
  if (newVisitBtn) {
   newVisitBtn.onclick = () => {
    appointmentContext = null;
    preselectedPatientId = id;
    closeModal();
    if (location.hash === '#calcular') calculator();
    else location.hash = 'calcular';
   };
  }
 };

 // Agenda cards: direct "Lançar valores" shortcut + WhatsApp confirmation button.
 function launchAppointmentToPricing(appointmentId) {
  const a = state.appointments.find(x => x.id === appointmentId && !x.deleted);
  if (!a) return;
  const p = state.patients.find(x => x.id === a.patient);
  if (!p || p.deleted) {
   return toast('Restaure o cadastro da paciente antes de lançar valores.');
  }
  if (batchItems.length && !confirm('Substituir a lista de procedimentos em aberto na Precificação por este agendamento?')) {
   return;
  }
  batchItems = [];
  consumption.reset();
  preselectedPatientId = a.patient;
  const procs = batch.splitAppointmentProcedures(a.procedure);
  appointmentContext = {
   id: a.id,
   patientId: a.patient,
   date: a.date,
   pro: a.pro,
   procedures: procs.length ? procs : [a.procedure],
   index: 0
  };
  if (location.hash === '#calcular') calculator();
  else location.hash = 'calcular';
 }

 const priorBatchAgendaList = agendaList;
 agendaList = function() {
  priorBatchAgendaList();
  const arr = visibleAppointments().filter(a => a.date === selectedDay).sort((a, b) => a.time.localeCompare(b.time));
  let dayTotalCents = 0;
  let dayReceivedCents = 0;
  let dayPendingCents = 0;
  let dayHasFinance = false;

  $('#agendaList')?.querySelectorAll('.appointment-card').forEach((el, i) => {
   const a = arr[i];
   if (!a || a.deleted) return;
   const existingButtons = Array.from(el.querySelectorAll(':scope > button'));
   const actionsWrap = document.createElement('div');
   actionsWrap.className = 'appointment-actions';

   const isActive = !['Cancelado', 'Faltou'].includes(a.status);
   const fin = isActive ? batch.summarizeAppointmentFinance(a, state.records, state.procedurePrices) : null;
   if (fin) {
    const finBox = document.createElement('div');
    finBox.className = 'appointment-finance';
    if (fin.launched) {
     dayHasFinance = true;
     dayTotalCents += batch.roundCents(fin.total);
     dayReceivedCents += batch.roundCents(fin.received);
     dayPendingCents += batch.roundCents(fin.pending);
     const discBadge = fin.discount > 0 ? `<small>Desc. ${money(fin.discount)}</small>` : '';
     const statusBadge = fin.status === 'paid'
      ? '<span class="finance-badge paid">Pago</span>'
      : fin.status === 'partial'
       ? `<span class="finance-badge pending">Pago ${money(fin.received)} · Falta ${money(fin.pending)}</span>`
       : `<span class="finance-badge pending">A receber ${money(fin.pending)}</span>`;
     finBox.innerHTML = `<div class="appointment-finance-value"><strong>${money(fin.total)}</strong>${discBadge}</div>${statusBadge}`;
    } else if (fin.status === 'estimated') {
     dayHasFinance = true;
     dayTotalCents += batch.roundCents(fin.estimatedTotal);
     dayPendingCents += batch.roundCents(fin.estimatedTotal);
     const partialHint = fin.pricedCount < fin.totalCount ? ' (parcial)' : '';
     finBox.innerHTML = `<div class="appointment-finance-value"><span>Previsto: <b>${money(fin.estimatedTotal)}</b>${partialHint}</span></div><span class="finance-badge estimated">A lançar</span>`;
    } else {
     finBox.innerHTML = '<div class="appointment-finance-value"><small>Sem preço padrão definido</small></div>';
    }
    const statusField = el.querySelector(':scope > label.field');
    if (statusField) statusField.before(finBox);
    else el.append(finBox);
   }

   if (isActive) {
    const launchBtn = document.createElement('button');
    launchBtn.type = 'button';
    if (a.status === 'Atendido' || fin?.launched) launchBtn.className = 'secondary';
    launchBtn.textContent = 'Lançar valores';
    launchBtn.setAttribute('aria-label', `Lançar valores de ${patient(a.patient)}`);
    launchBtn.onclick = () => launchAppointmentToPricing(a.id);
    actionsWrap.append(launchBtn);

    if (fin?.launched && fin.pending > 0) {
     const unpaid = fin.records.find(r => {
      const net = calc(r).total;
      const rec = r.received ?? (r.paid ? net : 0);
      return net - rec > 0.001;
     });
     if (unpaid) {
      const payBtn = document.createElement('button');
      payBtn.type = 'button';
      payBtn.className = 'secondary';
      payBtn.textContent = 'Receber';
      payBtn.setAttribute('aria-label', `Registrar recebimento de ${patient(a.patient)}`);
      payBtn.onclick = () => window.receivePayment(unpaid.id);
      actionsWrap.append(payBtn);
     }
    }
   }

   if (!['Cancelado', 'Faltou', 'Atendido'].includes(a.status)) {
    const p = state.patients.find(x => x.id === a.patient && !x.deleted);
    const baseWa = phone?.whatsappURL?.(p?.phone);
    const waUrl = batch.buildAppointmentWhatsappURL({
     whatsappBaseUrl: baseWa,
     patientName: p?.name,
     date: a.date,
     time: a.time,
     procedure: a.procedure
    });
    if (waUrl) {
     const waLink = document.createElement('a');
     waLink.className = 'button secondary';
     waLink.href = waUrl;
     waLink.target = '_blank';
     waLink.rel = 'noopener noreferrer';
     waLink.setAttribute('aria-label', `Confirmar horário no WhatsApp de ${p.name}`);
     waLink.innerHTML = `${whatsappSvg}<span>Confirmar WhatsApp</span>`;
     actionsWrap.append(waLink);
    }
   }

   actionsWrap.append(...existingButtons);
   el.append(actionsWrap);
  });

  if (dayHasFinance && !showDeletedAppointments) {
   const agendaListEl = $('#agendaList');
   if (agendaListEl) {
    const summary = document.createElement('div');
    summary.className = 'agenda-day-summary';
    summary.innerHTML = `<div><small>Total do dia</small><b>${money(batch.fromCents(dayTotalCents))}</b></div><div><small>Recebido</small><b>${money(batch.fromCents(dayReceivedCents))}</b></div><div><small>Falta receber</small><b>${money(batch.fromCents(dayPendingCents))}</b></div>`;
    agendaListEl.prepend(summary);
   }
  }
 };

 // Financeiro: recoverable exclusion and restoration of mistakenly recorded visits.
 function openDeleteRecordModal(recordId) {
  const r = state.records.find(x => x.id === recordId);
  if (!syncReady('Aguarde o salvamento antes de excluir o atendimento.')) return;
  const check = batch.canDeleteRecord(r, state.records);
  if (!check.ok) return toast(check.error);

  showModal(`<h2>Excluir atendimento?</h2>
   <p><b>${esc(r.procedure)}</b> · ${esc(patient(r.patient))} · ${esc(formatDateBr(r.date))} (${money(calc(r).total)})</p>
   <p>Ele sairá dos relatórios, gráficos, exportação CSV e valores a receber. Você poderá recuperar o registro em “Mostrar atendimentos excluídos”.</p>
   ${check.hasMaterials ? '<p class="hint">Este atendimento possui consumo de materiais registrado. O histórico do lote permanece preservado; se o material não chegou a ser usado, registre a entrada em Produtos e insumos.</p>' : ''}
   <div class="actions"><button type="button" class="secondary" id="cancelRecordDelete">Cancelar</button><button type="button" class="danger" id="confirmRecordDelete">Excluir atendimento</button></div>`);

  $('#cancelRecordDelete').onclick = closeModal;
  $('#confirmRecordDelete').onclick = () => {
   if (!syncReady('Aguarde o salvamento antes de excluir o atendimento.')) return;
   r.deleted = true;
   persist('Exclusão de atendimento financeiro');
   closeModal();
   if (page === 'financeiro') financeContent();
   toast('Atendimento excluído. Você pode restaurar quando quiser.');
  };
 }

 function restoreFinancialRecord(recordId) {
  const r = state.records.find(x => x.id === recordId && x.deleted);
  if (!r || !syncReady('Aguarde o salvamento antes de restaurar o atendimento.')) return;
  r.deleted = false;
  persist('Restauração de atendimento financeiro');
  if (page === 'financeiro') financeContent();
  toast('Atendimento restaurado.');
 }

 const priorBatchFinanceContent = financeContent;
 financeContent = function() {
  priorBatchFinanceContent();
  const month = $('#financeMonth')?.value;
  const tableWrap = $('#financeContent .tablewrap');
  if (!month || !tableWrap) return;

  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'inline deleted-filter';
  toggleLabel.innerHTML = `<input type="checkbox" id="showDeletedRecords" style="width:auto;margin:0" ${showDeletedRecords ? 'checked' : ''}> Mostrar atendimentos excluídos`;
  tableWrap.before(toggleLabel);
  $('#showDeletedRecords').onchange = e => {
   showDeletedRecords = e.target.checked;
   financeContent();
  };

  if (showDeletedRecords) {
   const deletedRs = state.records.filter(r => !!r.deleted && r.date.slice(0, 7) === month);
   tableWrap.innerHTML = `<table><thead><tr><th>PACIENTE / DATA</th><th>PROCEDIMENTO</th><th>VALOR</th><th>AÇÕES</th></tr></thead><tbody>${deletedRs.map(r => `<tr data-deleted-record="${esc(r.id)}"><td>${esc(patient(r.patient))}<small>${esc(r.date)}</small></td><td>${esc(r.procedure)}</td><td>${money(calc(r).total)}</td><td></td></tr>`).join('')}</tbody></table>${!deletedRs.length ? '<div class="empty">Nenhum atendimento excluído neste mês.</div>' : ''}`;
   tableWrap.querySelectorAll('tbody tr').forEach((row, i) => {
    const r = deletedRs[i];
    if (!r) return;
    const actionsCell = row.lastElementChild;
    const restoreBtn = document.createElement('button');
    restoreBtn.type = 'button';
    restoreBtn.className = 'secondary';
    restoreBtn.textContent = 'Restaurar';
    restoreBtn.setAttribute('aria-label', `Restaurar atendimento de ${patient(r.patient)} (${r.procedure})`);
    restoreBtn.onclick = () => restoreFinancialRecord(r.id);
    const detailBtn = document.createElement('button');
    detailBtn.type = 'button';
    detailBtn.className = 'textbtn';
    detailBtn.textContent = 'Detalhes';
    detailBtn.onclick = () => window.recordDetail(r.id);
    actionsCell.append(restoreBtn, detailBtn);
   });
   return;
  }

  const activeRs = state.records.filter(r => !r.deleted && r.date.slice(0, 7) === month);
  tableWrap.querySelectorAll('tbody tr').forEach((row, i) => {
   const r = activeRs[i];
   if (!r) return;
   // Update return count badge if some return records were soft-deleted.
   const allChildren = state.records.filter(x => x.parent === r.id);
   const activeChildren = allChildren.filter(x => !x.deleted);
   if (allChildren.length !== activeChildren.length) {
    const smalls = row.firstElementChild?.querySelectorAll('small');
    const returnSmall = smalls && smalls.length > 1 ? smalls[1] : null;
    if (returnSmall) {
     if (!activeChildren.length) returnSmall.remove();
     else returnSmall.textContent = `${activeChildren.length} retorno(s) · custos adicionais ${money(total(activeChildren, x => x.cost1 + x.cost2))}`;
    }
   }
   const delBtn = document.createElement('button');
   delBtn.type = 'button';
   delBtn.className = 'textbtn danger';
   delBtn.textContent = 'Excluir';
   delBtn.setAttribute('aria-label', `Excluir atendimento de ${patient(r.patient)} (${r.procedure})`);
   delBtn.onclick = () => openDeleteRecordModal(r.id);
   row.lastElementChild?.append(' ', delBtn);
  });
 };

 // Multi-procedure support in Agenda appointments (joined in procedure string <= 120 chars).
 // Uses role="button" controls inside #appointmentform so #appointmentform button.first()/last() remain Cancelar/Agendar.
 const wireRoleButton = (el, handler) => {
  el.onclick = handler;
  el.onkeydown = e => {
   if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handler();
   }
  };
 };

 function enhanceAppointmentForm(initialProcedures = []) {
  const form = $('#appointmentform');
  if (!form) return;
  const existingSelect = form.querySelector('select[name="procedure"]');
  let hiddenInput = form.querySelector('input[type="hidden"][name="procedure"]');
  let picker = $('#agendaProcPicker');
  let chipsEl = $('#agendaProcChips');

  if (existingSelect) {
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
   const addBtn = document.createElement('span');
   addBtn.setAttribute('role', 'button');
   addBtn.tabIndex = 0;
   addBtn.className = 'button secondary';
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
    const remove = document.createElement('span');
    remove.setAttribute('role', 'button');
    remove.tabIndex = 0;
    remove.className = 'batch-chip-remove';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remover ${name}`);
    wireRoleButton(remove, () => {
     selected.splice(idx, 1);
     drawChips();
    });
    chip.append(text, remove);
    chipsEl.append(chip);
   });
   syncHidden();
  };

  const addBtn = $('#agendaProcAdd');
  if (addBtn) {
   wireRoleButton(addBtn, () => {
    const chosen = picker.value;
    if (!chosen) return;
    const candidate = [...selected, chosen];
    const check = batch.joinAppointmentProcedures(candidate);
    if (!check.ok) return toast(check.error);
    selected = check.list;
    drawChips();
   });
  }
  picker.onchange = syncHidden;

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
 else if (page === 'agenda') renderCalendar();
 else if (page === 'financeiro') financeContent();
 else if (page === 'inicio') dashboard();
};
