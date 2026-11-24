export const MAX_PROCEDURE_LENGTH = 120;

export function roundCents(value) {
 return Math.round(Number(value || 0) * 100);
}

export function fromCents(cents) {
 return Math.round(cents) / 100;
}

export function roundQty(value) {
 return Math.round(Number(value || 0) * 1000) / 1000;
}

export function itemNetTotalCents(item) {
 return Math.max(0, roundCents(item?.price) - roundCents(item?.discount));
}

export function reservedProductQty(items, productId) {
 let sum = 0;
 for (const item of items || []) {
  for (const m of item?.materials || []) {
   if (m.id === productId) sum += Number(m.qty || 0);
  }
 }
 return roundQty(sum);
}

export function validateBatchStock(items, products, recordDate) {
 const byProduct = new Map();
 for (const item of items || []) {
  for (const m of item?.materials || []) {
   const product = (products || []).find(p => p.id === m.id);
   if (!product || product.deleted) {
    return { ok: false, error: 'Um dos produtos selecionados não está mais disponível no estoque.' };
   }
   if (product.expiry && recordDate && product.expiry < recordDate) {
    return { ok: false, error: `O lote de ${product.name} estará vencido na data informada (${recordDate}).` };
   }
   const nextQty = roundQty((byProduct.get(product.id) || 0) + Number(m.qty || 0));
   if (nextQty > roundQty(product.balance)) {
    return { ok: false, error: `Saldo insuficiente para ${product.name} considerando todos os procedimentos deste atendimento.` };
   }
   byProduct.set(product.id, nextQty);
  }
 }
 return { ok: true };
}

export function allocateReceivedCents(items, totalReceivedCents) {
 const totals = (items || []).map(itemNetTotalCents);
 const batchTotal = totals.reduce((a, b) => a + b, 0);
 const target = Math.max(0, Math.min(Math.round(totalReceivedCents || 0), batchTotal));
 if (!totals.length) return [];
 if (target === 0) return totals.map(() => 0);
 if (target >= batchTotal) return totals.slice();

 const shares = totals.map((t, index) => {
  const exact = (target * t) / batchTotal;
  const floor = Math.min(t, Math.floor(exact));
  return { index, cap: t, floor, remainder: exact - floor };
 });
 let remaining = target - shares.reduce((a, s) => a + s.floor, 0);
 const ordered = shares.slice().sort((a, b) => (b.remainder - a.remainder) || (b.cap - a.cap) || (a.index - b.index));
 for (const s of ordered) {
  if (remaining <= 0) break;
  if (s.floor < s.cap) {
   s.floor += 1;
   remaining -= 1;
  }
 }
 const result = new Array(totals.length);
 for (const s of shares) result[s.index] = s.floor;
 return result;
}

export function resolveCollectorSlot(professionalIds, selectedCollectorProId) {
 const ids = Array.isArray(professionalIds) && professionalIds.length ? professionalIds : [0, 1];
 if (ids.length <= 1) return 0;
 if (selectedCollectorProId === null || selectedCollectorProId === undefined || selectedCollectorProId === '') return 0;
 const idx = ids.indexOf(Number(selectedCollectorProId));
 return idx >= 0 ? idx : 0;
}

export function makeSchedule(balance, count, first) {
 const cents = Math.round(balance * 100);
 if (cents <= 0) return [];
 const n = Math.max(1, Math.min(36, Number(count) || 1));
 const d = new Date(first + 'T12:00:00');
 return Array.from({ length: n }, (_, i) => {
  const date = new Date(d.getFullYear(), d.getMonth() + i, 1, 12);
  date.setDate(Math.min(d.getDate(), new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { date: key, value: (Math.floor(cents / n) + (i < cents % n ? 1 : 0)) / 100 };
 });
}

export function buildBatchCommit({
 items,
 products,
 patientId,
 date,
 collectorProId,
 receivedTotal,
 installments,
 due,
 parent = '',
 makeSchedule: scheduleFn = makeSchedule,
 uid
}) {
 if (!Array.isArray(items) || !items.length) {
  return { ok: false, error: 'Adicione pelo menos um procedimento ao atendimento.' };
 }
 if (!patientId) return { ok: false, error: 'Selecione a paciente.' };
 if (!date || !due) return { ok: false, error: 'Informe a data do atendimento e o vencimento.' };

 const parsedInstallments = Math.max(1, Math.min(36, Math.round(Number(installments) || 1)));
 const receivedCents = roundCents(receivedTotal);
 if (receivedCents < 0) return { ok: false, error: 'O valor recebido não pode ser negativo.' };

 let batchTotalCents = 0;
 for (const item of items) {
  if (roundCents(item.discount) > roundCents(item.price)) {
   return { ok: false, error: `O desconto não pode superar o valor de ${item.procedure}.` };
  }
  const professionalIds = Array.isArray(item.professionalIds) && item.professionalIds.length ? item.professionalIds : [0, 1];
  const mats = item.materials || [];
  for (let i = 0; i < professionalIds.length; i++) {
   const owner = professionalIds[i];
   const matCents = mats.filter(m => m.owner === owner).reduce((sum, m) => sum + roundCents(m.cost), 0);
   const declaredCents = roundCents(item[i === 0 ? 'cost1' : 'cost2']);
   if (matCents > declaredCents) {
    return { ok: false, error: `O custo informado em ${item.procedure} não pode ser menor que os materiais selecionados.` };
   }
  }
  batchTotalCents += itemNetTotalCents(item);
 }

 if (receivedCents > batchTotalCents) {
  return { ok: false, error: 'O valor já recebido não pode superar o total dos procedimentos.' };
 }

 const stockCheck = validateBatchStock(items, products, date);
 if (!stockCheck.ok) return stockCheck;

 const allocations = allocateReceivedCents(items, receivedCents);
 const records = [];
 const stockDeductions = [];

 for (let idx = 0; idx < items.length; idx++) {
  const item = items[idx];
  const professionalIds = Array.isArray(item.professionalIds) && item.professionalIds.length ? item.professionalIds.slice() : [0, 1];
  const solo = professionalIds.length === 1;
  const itemTotalCents = itemNetTotalCents(item);
  const itemReceivedCents = allocations[idx];
  const itemBalanceCents = itemTotalCents - itemReceivedCents;
  const recordId = uid();
  const materials = (item.materials || []).map(m => ({
   id: m.id,
   mid: uid(),
   qty: roundQty(m.qty),
   cost: fromCents(roundCents(m.cost)),
   owner: m.owner
  }));

  for (const m of materials) {
   stockDeductions.push({
    productId: m.id,
    qty: m.qty,
    movement: {
     id: uid(),
     type: 'consumption',
     recordId,
     materialId: m.mid,
     date,
     qty: -m.qty,
     reason: 'Atendimento ' + recordId
    }
   });
  }

  const record = {
   ...item,
   id: recordId,
   patient: patientId,
   date,
   price: fromCents(roundCents(item.price)),
   discount: fromCents(roundCents(item.discount)),
   cost1: fromCents(roundCents(item.cost1)),
   cost2: solo ? 0 : fromCents(roundCents(item.cost2)),
   percent: solo ? 100 : fromCents(roundCents(item.percent)),
   fee: fromCents(roundCents(item.fee)),
   feeOwner: solo ? '0' : String(item.feeOwner ?? '0'),
   mode: solo ? 'gross' : (item.mode === 'reimburse' ? 'reimburse' : 'gross'),
   professionalIds,
   professionalNames: Array.isArray(item.professionalNames) ? item.professionalNames.slice() : undefined,
   collector: resolveCollectorSlot(professionalIds, collectorProId),
   received: fromCents(itemReceivedCents),
   initialReceived: fromCents(itemReceivedCents),
   paid: itemReceivedCents === itemTotalCents,
   installments: parsedInstallments,
   due,
   parent: parent || '',
   settled: false,
   transferred: 0,
   materials,
   payments: [],
   schedule: scheduleFn(fromCents(itemBalanceCents), parsedInstallments, due)
  };
  if (record.professionalNames === undefined) delete record.professionalNames;
  records.push(record);
 }

 return { ok: true, records, stockDeductions, totalCents: batchTotalCents };
}

export function joinAppointmentProcedures(list, maxLength = MAX_PROCEDURE_LENGTH) {
 const seen = new Set();
 const clean = [];
 for (const raw of list || []) {
  const name = String(raw || '').trim();
  if (!name) continue;
  const key = name.toLocaleLowerCase('pt-BR');
  if (seen.has(key)) continue;
  seen.add(key);
  clean.push(name);
 }
 if (!clean.length) return { ok: false, error: 'Selecione pelo menos um procedimento.' };
 const value = clean.join(' + ');
 if (value.length > maxLength) {
  return { ok: false, error: `A lista de procedimentos ultrapassa ${maxLength} caracteres. Remova um item ou agende separadamente.` };
 }
 return { ok: true, value, list: clean };
}

export function splitAppointmentProcedures(value) {
 return String(value || '')
  .split(' + ')
  .map(s => s.trim())
  .filter(Boolean);
}

export function groupRecordsByDate(records) {
 const map = new Map();
 for (const r of records || []) {
  if (r?.deleted) continue;
  const date = r.date || '';
  if (!map.has(date)) map.set(date, []);
  map.get(date).push(r);
 }
 return Array.from(map.entries())
  .sort((a, b) => b[0].localeCompare(a[0]))
  .map(([date, items]) => ({ date, items }));
}

export function buildAppointmentWhatsappURL({ whatsappBaseUrl, patientName, date, time, procedure }) {
 if (!whatsappBaseUrl) return null;
 const firstName = String(patientName || '').trim().split(/\s+/)[0] || '';
 const greeting = firstName ? `Olá, ${firstName}!` : 'Olá!';
 const dateBr = date ? String(date).split('-').reverse().join('/') : '';
 const procText = String(procedure || '').trim();
 const details = [
  procText ? `de ${procText}` : '',
  dateBr ? `no dia ${dateBr}` : '',
  time ? `às ${time}` : ''
 ].filter(Boolean).join(' ');
 const message = `${greeting} Passando para confirmar seu atendimento${details ? ' ' + details : ''}. Podemos confirmar?`;
 return `${whatsappBaseUrl}?text=${encodeURIComponent(message)}`;
}

export function canDeleteRecord(record, allRecords) {
 if (!record || record.deleted) {
  return { ok: false, error: 'Este atendimento já foi excluído.' };
 }
 const hasActiveReturn = (allRecords || []).some(r => !r?.deleted && r?.parent === record.id);
 if (hasActiveReturn) {
  return { ok: false, error: 'Exclua ou edite primeiro o atendimento de retorno vinculado a este registro.' };
 }
 return {
  ok: true,
  hasMaterials: Array.isArray(record.materials) && record.materials.length > 0,
  hasPayments: Number(record.received || 0) > 0 || Number(record.transferred || 0) > 0
 };
}

