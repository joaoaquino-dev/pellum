import assert from 'node:assert/strict';
import {
 addDaysIso,
 allocateReceivedCents,
 buildAppointmentWhatsappURL,
 buildBatchCommit,
 canDeleteRecord,
 computeDiscountFromFinal,
 computeFinalFromDiscount,
 distributeDiscountCents,
 filterUpcomingAppointments,
 formatDiscountSummary,
 groupRecordsByDate,
 joinAppointmentProcedures,
 reservedProductQty,
 resolveCollectorSlot,
 resolveProcedurePrice,
 splitAppointmentProcedures,
 summarizeAppointmentFinance,
 validateBatchStock
} from '../standalone/src/batch-records.js';

const makeSchedule = (balance, count, first) => {
 const cents = Math.round(balance * 100);
 if (cents <= 0) return [];
 const n = Math.max(1, Math.min(36, +count || 1));
 const d = new Date(first + 'T12:00:00');
 return Array.from({ length: n }, (_, i) => {
  const date = new Date(d.getFullYear(), d.getMonth() + i, 1, 12);
  date.setDate(Math.min(d.getDate(), new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { date: key, value: (Math.floor(cents / n) + (i < cents % n ? 1 : 0)) / 100 };
 });
};

let seq = 0;
const uid = () => `id_${++seq}`;

// 1. Exact cent allocation (0, partial indivisible remainder, full)
const equalThree = [{ price: 100, discount: 0 }, { price: 100, discount: 0 }, { price: 100, discount: 0 }];
assert.deepEqual(allocateReceivedCents(equalThree, 0), [0, 0, 0]);
const split100 = allocateReceivedCents(equalThree, 10000);
assert.equal(split100.reduce((a, b) => a + b, 0), 10000);
assert.deepEqual(split100, [3334, 3333, 3333]);
assert.deepEqual(allocateReceivedCents(equalThree, 30000), [10000, 10000, 10000]);

// 2. Accumulated stock validation across multiple procedures
const products = [
 { id: 'prod1', name: 'Toxina 100U', balance: 50, price: 900, quantity: 100, owner: 0, expiry: '2027-01-01' },
 { id: 'prod2', name: 'Ácido Hialurônico', balance: 2, price: 600, quantity: 2, owner: 1, expiry: '2026-11-20' }
];
const okItems = [
 { procedure: 'Toxina botulínica', price: 1200, discount: 0, cost1: 270, cost2: 0, percent: 100, fee: 0, feeOwner: '0', mode: 'gross', professionalIds: [0], professionalNames: ['Ana'], materials: [{ id: 'prod1', qty: 30, cost: 270, owner: 0 }] },
 { procedure: 'Skinbooster', price: 800, discount: 100, cost1: 180, cost2: 0, percent: 70, fee: 2.5, feeOwner: 'split', mode: 'gross', professionalIds: [0, 1], professionalNames: ['Ana', 'Carla'], materials: [{ id: 'prod1', qty: 20, cost: 180, owner: 0 }] }
];
assert.equal(reservedProductQty(okItems, 'prod1'), 50);
assert.equal(validateBatchStock(okItems, products, '2026-11-24').ok, true);

const overItems = [
 ...okItems,
 { procedure: 'Retoque', price: 200, discount: 0, cost1: 9, cost2: 0, percent: 100, fee: 0, feeOwner: '0', mode: 'gross', professionalIds: [0], professionalNames: ['Ana'], materials: [{ id: 'prod1', qty: 1, cost: 9, owner: 0 }] }
];
assert.equal(validateBatchStock(overItems, products, '2026-11-24').ok, false);

// Expired lot on record date rejected
const expiredItems = [
 { procedure: 'Preenchimento facial', price: 1500, discount: 0, cost1: 0, cost2: 300, percent: 70, fee: 0, feeOwner: '0', mode: 'gross', professionalIds: [0, 1], materials: [{ id: 'prod2', qty: 1, cost: 300, owner: 1 }] }
];
assert.equal(validateBatchStock(expiredItems, products, '2026-11-24').ok, false);
assert.equal(validateBatchStock(expiredItems, products, '2026-11-19').ok, true);

// 3. Collector slot resolution for mixed solo + partnership batch
assert.equal(resolveCollectorSlot([0], 1), 0);
assert.equal(resolveCollectorSlot([0, 1], 1), 1);
assert.equal(resolveCollectorSlot([0, 2], 2), 1);
assert.equal(resolveCollectorSlot([0, 2], 5), 0);

// 4. Full buildBatchCommit with mixed solo + partnership and partial payment
const commit = buildBatchCommit({
 items: okItems,
 products,
 patientId: 'p1',
 date: '2026-11-24',
 collectorProId: 1,
 receivedTotal: 500,
 installments: 2,
 due: '2026-12-24',
 parent: '',
 makeSchedule,
 uid
});
assert.equal(commit.ok, true);
assert.equal(commit.records.length, 2);
assert.equal(commit.stockDeductions.length, 2);
assert.equal(commit.totalCents, 190000);

// Solo item must keep collector 0, percent 100, cost2 0, feeOwner '0', mode 'gross'
assert.equal(commit.records[0].collector, 0);
assert.equal(commit.records[0].percent, 100);
assert.equal(commit.records[0].cost2, 0);
assert.equal(commit.records[0].feeOwner, '0');
assert.equal(commit.records[0].mode, 'gross');
// Partnership item gets collector slot 1 (professionalId 1)
assert.equal(commit.records[1].collector, 1);

// Sum of received across records == 500.00 exactly
const sumReceived = Math.round(commit.records.reduce((s, r) => s + r.received, 0) * 100);
assert.equal(sumReceived, 50000);

// Schedule sums match remaining balances and movements match material mids
for (const r of commit.records) {
 const net = Math.round((r.price - r.discount) * 100);
 const rec = Math.round(r.received * 100);
 const schedSum = Math.round(r.schedule.reduce((s, p) => s + p.value, 0) * 100);
 assert.equal(schedSum, net - rec);
 assert.equal(r.paid, rec === net);
 for (const m of r.materials) {
  const mov = commit.stockDeductions.find(d => d.movement.recordId === r.id && d.movement.materialId === m.mid);
  assert.ok(mov);
  assert.equal(mov.movement.qty, -m.qty);
 }
}
// Unique movement IDs and material IDs
assert.equal(new Set(commit.stockDeductions.map(d => d.movement.id)).size, 2);
assert.equal(new Set(commit.records.flatMap(r => r.materials.map(m => m.mid))).size, 2);

// Reject received > total
const tooMuch = buildBatchCommit({
 items: okItems,
 products,
 patientId: 'p1',
 date: '2026-11-24',
 collectorProId: 0,
 receivedTotal: 2000,
 installments: 1,
 due: '2026-11-24',
 makeSchedule,
 uid
});
assert.equal(tooMuch.ok, false);

// 5. Agenda procedure joining and splitting
const joined = joinAppointmentProcedures(['Toxina botulínica', 'Skinbooster', 'toxina botulínica']);
assert.equal(joined.ok, true);
assert.equal(joined.value, 'Toxina botulínica + Skinbooster');
assert.deepEqual(splitAppointmentProcedures(joined.value), ['Toxina botulínica', 'Skinbooster']);
assert.equal(joinAppointmentProcedures([]).ok, false);
assert.equal(joinAppointmentProcedures(['A'.repeat(70), 'B'.repeat(70)]).ok, false);

// 6. Patient history day grouping
const grouped = groupRecordsByDate([
 { id: '1', date: '2026-11-20', procedure: 'Peeling' },
 { id: '2', date: '2026-11-24', procedure: 'Toxina' },
 { id: '3', date: '2026-11-24', procedure: 'Skinbooster' },
 { id: '4', date: '2026-11-24', procedure: 'Cancelado', deleted: true }
]);
assert.equal(grouped.length, 2);
assert.equal(grouped[0].date, '2026-11-24');
assert.equal(grouped[0].items.length, 2);
assert.equal(grouped[1].date, '2026-11-20');

// 7. Agenda WhatsApp confirmation URL
assert.equal(buildAppointmentWhatsappURL({ whatsappBaseUrl: null, patientName: 'Marina Costa', date: '2026-11-24', time: '14:30', procedure: 'Toxina' }), null);
const waUrl = buildAppointmentWhatsappURL({
 whatsappBaseUrl: 'https://wa.me/5561999998888',
 patientName: 'Marina Costa',
 date: '2026-11-24',
 time: '14:30',
 procedure: 'Toxina botulínica + Skinbooster'
});
assert.ok(waUrl.startsWith('https://wa.me/5561999998888?text='));
const decoded = decodeURIComponent(waUrl.split('?text=')[1]);
assert.match(decoded, /Olá, Marina!/);
assert.match(decoded, /Toxina botulínica \+ Skinbooster/);
assert.match(decoded, /24\/11\/2026/);
assert.match(decoded, /14:30/);

// 8. Financial record deletion guard
const parentRec = { id: 'r1', procedure: 'Toxina', materials: [{ id: 'prod1', qty: 10 }], received: 200 };
const activeChild = { id: 'r2', parent: 'r1', procedure: 'Retorno' };
const deletedChild = { id: 'r2', parent: 'r1', procedure: 'Retorno', deleted: true };
assert.equal(canDeleteRecord(parentRec, [parentRec, activeChild]).ok, false);
const delAllowed = canDeleteRecord(parentRec, [parentRec, deletedChild]);
assert.equal(delAllowed.ok, true);
assert.equal(delAllowed.hasMaterials, true);
assert.equal(delAllowed.hasPayments, true);
assert.equal(canDeleteRecord({ ...parentRec, deleted: true }, []).ok, false);

// 9. Default procedure pricing (catalog priority, history fallback, unpriced)
const historyRecords = [
 { id: 'h1', patient: 'p1', date: '2026-10-01', procedure: 'Toxina botulínica', price: 900, discount: 0, received: 900, paid: true },
 { id: 'h2', patient: 'p1', date: '2026-11-10', procedure: 'Toxina botulínica', price: 1100, discount: 100, received: 500, paid: false },
 { id: 'h3', patient: 'p1', date: '2026-11-15', procedure: 'Toxina botulínica', price: 1500, discount: 0, deleted: true }
];
assert.deepEqual(resolveProcedurePrice('Toxina botulínica', { 'Toxina botulínica': 1250 }, historyRecords), { price: 1250, source: 'catalog' });
assert.deepEqual(resolveProcedurePrice('Toxina botulínica', {}, historyRecords), { price: 1100, source: 'history' });
assert.equal(resolveProcedurePrice('Peeling', {}, historyRecords), null);

// 10. Discount <-> final price synchronization & summary
assert.equal(computeFinalFromDiscount(1000, 150), 850);
assert.equal(computeFinalFromDiscount(1000, 1500), 0);
assert.deepEqual(computeDiscountFromFinal(1000, 850), { price: 1000, discount: 150, finalValue: 850 });
assert.deepEqual(computeDiscountFromFinal(1000, 1200), { price: 1200, discount: 0, finalValue: 1200 });
assert.deepEqual(formatDiscountSummary(1000, 150), { price: 1000, discount: 150, total: 850, percent: 15 });
assert.equal(formatDiscountSummary(1000, 0), null);

// 11. Appointment financial summary (estimated vs launched partial/paid)
const estSummary = summarizeAppointmentFinance(
 { id: 'a1', patient: 'p1', date: '2026-12-01', procedure: 'Toxina botulínica + Peeling' },
 historyRecords,
 { 'Toxina botulínica': 1200, Peeling: 350 }
);
assert.equal(estSummary.launched, false);
assert.equal(estSummary.status, 'estimated');
assert.equal(estSummary.estimatedTotal, 1550);
assert.equal(estSummary.pricedCount, 2);

const partialSummary = summarizeAppointmentFinance(
 { id: 'a2', patient: 'p1', date: '2026-11-10', procedure: 'Toxina botulínica' },
 historyRecords,
 { 'Toxina botulínica': 1200 }
);
assert.equal(partialSummary.launched, true);
assert.equal(partialSummary.status, 'partial');
assert.equal(partialSummary.total, 1000);
assert.equal(partialSummary.discount, 100);
assert.equal(partialSummary.received, 500);
assert.equal(partialSummary.pending, 500);

// 12. Upcoming 7-day agenda filter & proportional discount distribution
assert.equal(addDaysIso('2026-11-28', 6), '2026-12-04');
const upcoming = filterUpcomingAppointments([
 { id: 'u1', date: '2026-11-27', time: '09:00' },
 { id: 'u2', date: '2026-11-28', time: '14:00' },
 { id: 'u3', date: '2026-12-04', time: '10:00' },
 { id: 'u4', date: '2026-12-05', time: '08:00' },
 { id: 'u5', date: '2026-11-28', time: '09:00' }
], '2026-11-28', 7);
assert.deepEqual(upcoming.map(x => x.id), ['u5', 'u2', 'u3']);

const dist = distributeDiscountCents([100000, 50000], 15000);
assert.deepEqual(dist, [10000, 5000]);
assert.equal(distributeDiscountCents([10000, 10000, 10000], 100).reduce((a, b) => a + b, 0), 100);

console.log('PASS: batch records allocation, accumulated stock validation, mixed solo/partnership commit, agenda procedure joining, WhatsApp confirmation URL, record deletion guards, default prices, discounts, agenda finance summary, 7-day filter, and patient history grouping.');

