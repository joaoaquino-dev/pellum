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

 // Align menu label: "#calcular" is where users both register visits and simulate values.
 const calcPageEntry = pages.find(p => p[0] === 'calcular');
 if (calcPageEntry) calcPageEntry[2] = 'Atendimentos';

 let agendaViewMode = 'day'; // 'day' | 'week'

 function openQuickCompleteModal(appointmentId) {
  if (!syncReady('Aguarde o salvamento antes de concluir o atendimento.')) return;
  const a = state.appointments.find(x => x.id === appointmentId && !x.deleted);
  if (!a) return;
  const p = state.patients.find(x => x.id === a.patient);
  if (!p || p.deleted) return toast('Restaure o cadastro da paciente antes de concluir.');
  if ((state.inactivePros || []).includes(a.pro)) {
   return toast('A profissional deste horário está inativa. Use Lançar valores para escolher outra.');
  }

  const procs = batch.splitAppointmentProcedures(a.procedure);
  const itemsBase = procs.map(name => {
   const resolved = batch.resolveProcedurePrice(name, state.procedurePrices, state.records);
   return { procedure: name, price: resolved ? resolved.price : 0 };
  });
  const baseTotal = itemsBase.reduce((s, x) => s + x.price, 0);

  showModal(`<h2>Concluir atendimento rápido</h2>
   <p><b>${esc(p.name)}</b> · ${esc(formatDateBr(a.date))} às ${esc(a.time)}<br><small>${esc(a.procedure)} · ${esc(state.names[a.pro])}</small></p>
   <form id="quickCompleteForm">
    <div class="formgrid">
     <label class="field">Valor padrão (R$)<input name="basePrice" type="number" min="0" step="0.01" value="${baseTotal.toFixed(2).replace(/\.00$/, '')}" readonly></label>
     <label class="field">Desconto (R$)<input name="discount" id="qcDiscount" type="number" min="0" max="${baseTotal.toFixed(2)}" step="0.01" value="0"></label>
     <label class="field">Por quanto fechou (R$)<input name="finalPrice" id="qcFinal" type="number" min="0" step="0.01" value="${baseTotal.toFixed(2).replace(/\.00$/, '')}" required></label>
    </div>
    <label class="field">Pagamento<select name="payMode" id="qcPayMode"><option value="full">Recebido integral</option><option value="pending">Pendente (a receber)</option><option value="partial">Parcial</option></select></label>
    <div id="qcPartialWrap" hidden><label class="field">Valor já recebido (R$)<input name="received" id="qcReceived" type="number" min="0" step="0.01" value="0"></label></div>
    <small>Salva no financeiro como atendimento individual (${esc(state.names[a.pro])}) e marca o horário como Atendido.</small>
    <p class="sectiongap"><button type="button" class="textbtn" id="qcOpenFull">Precisa informar produtos ou parceria? Abrir tela completa →</button></p>
    <div class="actions"><button type="button" class="secondary" id="qcCancel">Cancelar</button><button type="submit">Concluir e salvar</button></div>
   </form>`);

  const form = $('#quickCompleteForm');
  const discInput = $('#qcDiscount');
  const finalInput = $('#qcFinal');
  const payMode = $('#qcPayMode');
  const partialWrap = $('#qcPartialWrap');
  const recInput = $('#qcReceived');

  const syncFromDiscount = () => {
   const finalVal = batch.computeFinalFromDiscount(baseTotal, discInput.value);
   if (document.activeElement !== finalInput) {
    finalInput.value = finalVal.toFixed(2).replace(/\.00$/, '');
   }
  };
  discInput.oninput = syncFromDiscount;
  finalInput.oninput = () => {
   if (finalInput.value === '') return;
   const next = batch.computeDiscountFromFinal(baseTotal, finalInput.value);
   discInput.value = String(next.discount);
  };
  payMode.onchange = () => {
   partialWrap.hidden = payMode.value !== 'partial';
   if (payMode.value === 'partial') recInput.focus({ preventScroll: true });
  };
  $('#qcCancel').onclick = closeModal;
  $('#qcOpenFull').onclick = () => {
   closeModal();
   launchAppointmentToPricing(a.id);
  };

  form.onsubmit = e => {
   e.preventDefault();
   if (!syncReady('Aguarde o salvamento antes de concluir o atendimento.')) return;
   const finalCents = batch.roundCents(finalInput.value);
   const baseCents = batch.roundCents(baseTotal);
   if (finalCents < 0) return toast('Informe um valor válido.');

   let pricesCents = itemsBase.map(x => batch.roundCents(x.price));
   let discountsCents = itemsBase.map(() => 0);
   if (finalCents > baseCents) {
    // Increase proportionally on last item if user charged above default
    pricesCents[pricesCents.length - 1] += (finalCents - baseCents);
   } else if (finalCents < baseCents) {
    discountsCents = batch.distributeDiscountCents(pricesCents, baseCents - finalCents);
   }

   const receivedTotal = payMode.value === 'full'
    ? batch.fromCents(finalCents)
    : payMode.value === 'pending'
     ? 0
     : Number(recInput.value || 0);

   const commitItems = itemsBase.map((x, idx) => ({
    procedure: x.procedure,
    price: batch.fromCents(pricesCents[idx]),
    discount: batch.fromCents(discountsCents[idx]),
    cost1: 0,
    cost2: 0,
    percent: 100,
    fee: 0,
    feeOwner: '0',
    mode: 'gross',
    professionalIds: [a.pro],
    professionalNames: [state.names[a.pro]],
    materials: []
   }));

   const commit = batch.buildBatchCommit({
    items: commitItems,
    products: state.products,
    patientId: a.patient,
    date: a.date,
    collectorProId: a.pro,
    receivedTotal,
    installments: 1,
    due: a.date,
    parent: '',
    uid
   });
   if (!commit.ok) return toast(commit.error);

   const beforeRecLen = state.records.length;
   const beforeStatus = a.status;
   state.records.push(...commit.records);
   if (['Agendado', 'Confirmado'].includes(a.status) && !appointmentConflict(a)) {
    a.status = 'Atendido';
   }
   if (persist('Conclusão rápida de atendimento') === false) {
    state.records.length = beforeRecLen;
    a.status = beforeStatus;
    return;
   }
   closeModal();
   renderCalendar();
   toast('Atendimento concluído e registrado no financeiro.');
  };
 }

 const priorBatchAgenda = agenda;
 agenda = function() {
  priorBatchAgenda();
  const dayCard = $('.day-card');
  const deletedFilter = dayCard?.querySelector('.deleted-filter');
  if (dayCard && deletedFilter && !$('#agendaViewSwitch')) {
   const sw = document.createElement('div');
   sw.className = 'agenda-view-switch';
   sw.id = 'agendaViewSwitch';
   sw.setAttribute('role', 'tablist');
   sw.setAttribute('aria-label', 'Período da agenda');
   sw.innerHTML = `<button type="button" role="tab" id="agendaModeDay" class="${agendaViewMode === 'day' ? 'active' : ''}" aria-selected="${agendaViewMode === 'day'}">Dia selecionado</button><button type="button" role="tab" id="agendaModeWeek" class="${agendaViewMode === 'week' ? 'active' : ''}" aria-selected="${agendaViewMode === 'week'}">Próximos 7 dias</button>`;
   deletedFilter.before(sw);
   $('#agendaModeDay').onclick = () => {
    if (agendaViewMode === 'day') return;
    agendaViewMode = 'day';
    $('#agendaModeDay').classList.add('active');
    $('#agendaModeDay').setAttribute('aria-selected', 'true');
    $('#agendaModeWeek').classList.remove('active');
    $('#agendaModeWeek').setAttribute('aria-selected', 'false');
    agendaList();
   };
   $('#agendaModeWeek').onclick = () => {
    if (agendaViewMode === 'week') return;
    agendaViewMode = 'week';
    $('#agendaModeWeek').classList.add('active');
    $('#agendaModeWeek').setAttribute('aria-selected', 'true');
    $('#agendaModeDay').classList.remove('active');
    $('#agendaModeDay').setAttribute('aria-selected', 'false');
    agendaList();
   };
  }
 };

 const priorBatchAgendaList = agendaList;
 agendaList = function() {
  const isWeek = agendaViewMode === 'week';
  if (isWeek) {
   const arr = batch.filterUpcomingAppointments(visibleAppointments(), selectedDay, 7);
   const endIso = batch.addDaysIso(selectedDay, 6);
   const titleEl = $('#dayTitle');
   if (titleEl) titleEl.textContent = `Próximos 7 dias (${formatDateBr(selectedDay).slice(0, 5)} a ${formatDateBr(endIso).slice(0, 5)})`;
   $('#agendaList').innerHTML = arr.length
    ? arr.map(a => `<article class="appointment-card"><div class="appointment-title"><strong>${esc(formatDateBr(a.date).slice(0, 5))} · ${a.time}</strong><span class="tag">${a.duration} min</span></div><b>${esc(patient(a.patient))}</b><small>${esc(a.procedure)}<br>${esc(state.names[a.pro])}</small>${a.deleted ? `<button class="secondary" onclick="restoreAppointment('${a.id}')">Restaurar agendamento</button>` : `<label class="field">Status<select aria-label="Status de ${esc(patient(a.patient))}" onchange="setStatus('${a.id}',this.value)">${['Agendado','Confirmado','Atendido','Cancelado','Faltou'].map(s => `<option ${a.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label><button class="textbtn danger" onclick="deleteAppointment('${a.id}')">Excluir agendamento</button><button class="secondary" onclick="editAppointment('${a.id}')">Editar horário</button><button class="secondary" onclick="returnAppointment('${a.id}')">Agendar retorno</button>`}</article>`).join('')
    : `<div class="empty">${showDeletedAppointments ? 'Nenhum agendamento excluído nos próximos 7 dias.' : 'Nenhum atendimento nos próximos 7 dias.'}</div>${!showDeletedAppointments ? '<button class="secondary" onclick="appointmentForm()">＋ Agendar</button>' : ''}`;
  } else {
   priorBatchAgendaList();
  }
  const arr = isWeek
   ? batch.filterUpcomingAppointments(visibleAppointments(), selectedDay, 7)
   : visibleAppointments().filter(a => a.date === selectedDay).sort((a, b) => a.time.localeCompare(b.time));
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
    if (!fin?.launched && fin?.status === 'estimated' && fin.pricedCount === fin.totalCount) {
     const quickBtn = document.createElement('button');
     quickBtn.type = 'button';
     quickBtn.textContent = 'Concluir rápido';
     quickBtn.setAttribute('aria-label', `Concluir atendimento rápido de ${patient(a.patient)}`);
     quickBtn.onclick = () => openQuickCompleteModal(a.id);
     actionsWrap.append(quickBtn);
    }

    const launchBtn = document.createElement('button');
    launchBtn.type = 'button';
    if (a.status === 'Atendido' || fin?.launched || (!fin?.launched && fin?.status === 'estimated' && fin.pricedCount === fin.totalCount)) {
     launchBtn.className = 'secondary';
    }
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
    summary.innerHTML = `<div><small>${isWeek ? 'Total (7 dias)' : 'Total do dia'}</small><b>${money(batch.fromCents(dayTotalCents))}</b></div><div><small>Recebido</small><b>${money(batch.fromCents(dayReceivedCents))}</b></div><div><small>Falta receber</small><b>${money(batch.fromCents(dayPendingCents))}</b></div>`;
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

  // Quick patient registration inline inside Agenda modal (uses span[role="button"] to preserve button.first()/last()).
  const patientSelect = form.querySelector('select[name="patient"]');
  const patientField = patientSelect?.closest('label.field');
  if (patientSelect && patientField && !$('#agendaQuickPatientToggle')) {
   const toggle = document.createElement('span');
   toggle.id = 'agendaQuickPatientToggle';
   toggle.setAttribute('role', 'button');
   toggle.tabIndex = 0;
   toggle.className = 'textbtn quick-patient-toggle';
   toggle.textContent = '＋ Cadastrar nova paciente';

   const box = document.createElement('div');
   box.id = 'agendaQuickPatientBox';
   box.className = 'quick-patient-box';
   box.hidden = true;
   box.innerHTML = `<label class="field">Nome da nova paciente<input id="quickPatientName" type="text" maxlength="100" placeholder="Nome completo" autocomplete="off"></label><label class="field">WhatsApp com DDD (opcional)<input id="quickPatientPhone" type="tel" maxlength="20" placeholder="(61) 99999-9999" autocomplete="off"></label><div class="quick-patient-actions"><span role="button" tabindex="0" class="button secondary" id="quickPatientCancel">Cancelar</span><span role="button" tabindex="0" class="button" id="quickPatientSave">Salvar paciente</span></div>`;

   patientField.after(toggle, box);

   const nameInput = $('#quickPatientName');
   const phoneInput = $('#quickPatientPhone');
   if (phoneInput && phone?.formatPhone) {
    phoneInput.oninput = () => {
     const formatted = phone.formatPhone(phoneInput.value);
     if (formatted !== phoneInput.value) phoneInput.value = formatted;
    };
   }

   wireRoleButton(toggle, () => {
    box.hidden = !box.hidden;
    if (!box.hidden) nameInput?.focus({ preventScroll: true });
   });
   wireRoleButton($('#quickPatientCancel'), () => {
    box.hidden = true;
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
   });
   wireRoleButton($('#quickPatientSave'), () => {
    if (!syncReady('Aguarde o salvamento antes de cadastrar a paciente.')) return;
    const rawName = (nameInput?.value || '').trim();
    const rawPhone = (phoneInput?.value || '').trim();
    if (!rawName) return toast('Informe o nome da paciente.');
    if (rawPhone && phone?.validPhone && !phone.validPhone(rawPhone)) {
     return toast('Telefone inválido. Informe DDD e 10 ou 11 dígitos, ou deixe vazio.');
    }
    const formattedPhone = rawPhone && phone?.formatPhone ? phone.formatPhone(rawPhone) : rawPhone;
    const newPatient = { id: uid(), name: rawName, phone: formattedPhone, note: '' };
    state.patients.push(newPatient);
    if (persist('Cadastro rápido de paciente') === false) {
     state.patients.pop();
     return;
    }
    const opt = new Option(newPatient.name, newPatient.id, true, true);
    patientSelect.add(opt);
    patientSelect.value = newPatient.id;
    box.hidden = true;
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    toast('Paciente cadastrada e selecionada.');
   });
  }

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

 // Mobile bottom navigation bar (<= 767px) for quick thumb access without breaking #nav tests.
 function ensureMobileBottomNav() {
  if ($('#mobileBottomNav')) return;
  const bar = document.createElement('nav');
  bar.id = 'mobileBottomNav';
  bar.className = 'mobile-bottom-nav';
  bar.setAttribute('aria-label', 'Navegação rápida');
  const primary = [
   ['inicio', uiIcon('overview'), 'Início'],
   ['agenda', uiIcon('calendar'), 'Agenda'],
   ['pacientes', uiIcon('patients'), 'Pacientes'],
   ['calcular', uiIcon('diamond'), 'Atender']
  ];
  bar.innerHTML = primary.map(([id, icon, label]) => `<a href="#${id}" data-bottom-tab="${id}">${icon}<span>${label}</span></a>`).join('')
   + `<button type="button" id="mobileMoreBtn" aria-label="Mais opções">${uiIcon('settings')}<span>Mais</span></button>`;
  document.body.append(bar);

  $('#mobileMoreBtn').onclick = () => {
   const primaryIds = new Set(primary.map(p => p[0]));
   const extras = pages.filter(([id]) => !primaryIds.has(id));
   const adminLink = $('#nav a[href="#admin"]');
   const linksHtml = extras.map(([id, icon, name]) => `<a class="more-menu-item ${page === id ? 'active' : ''}" href="#${id}">${icon}<span>${esc(name)}</span></a>`).join('')
    + (adminLink ? `<a class="more-menu-item ${page === 'admin' ? 'active' : ''}" href="#admin">${uiIcon('settings')}<span>Administração</span></a>` : '');
   showModal(`<h2>Mais áreas</h2><div class="more-menu-list">${linksHtml}</div><div class="actions"><button type="button" class="secondary" id="closeMoreMenu">Fechar</button></div>`);
   $('#closeMoreMenu').onclick = closeModal;
   $('#dialogbody').querySelectorAll('.more-menu-item').forEach(a => {
    a.onclick = () => closeModal();
   });
  };
 }

 function syncMobileBottomNav() {
  ensureMobileBottomNav();
  const bar = $('#mobileBottomNav');
  if (!bar) return;
  const asideHidden = $('aside')?.hidden;
  bar.hidden = !!asideHidden;
  const current = location.hash.slice(1) || page || 'inicio';
  const primarySet = new Set(['inicio', 'agenda', 'pacientes', 'calcular']);
  bar.querySelectorAll('[data-bottom-tab]').forEach(a => {
   a.classList.toggle('active', a.dataset.bottomTab === current);
  });
  const moreBtn = $('#mobileMoreBtn');
  if (moreBtn) moreBtn.classList.toggle('active', !primarySet.has(current));
 }

 const priorBatchRoute = route;
 route = function() {
  priorBatchRoute();
  syncMobileBottomNav();
 };
 window.addEventListener('hashchange', () => setTimeout(syncMobileBottomNav, 0));
 syncMobileBottomNav();

 if (page === 'calcular') calculator();
 else if (page === 'agenda') agenda();
 else if (page === 'financeiro') financeContent();
 else if (page === 'inicio') dashboard();
};
