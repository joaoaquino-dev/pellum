import assert from 'node:assert/strict';
import {
 allocateReceivedCents,
 buildBatchCommit,
 groupRecordsByDate,
 joinAppointmentProcedures,
 reservedProductQty,
 resolveCollectorSlot,
 splitAppointmentProcedures,
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

console.log('PASS: batch records allocation, accumulated stock validation, mixed solo/partnership commit, agenda procedure joining, and patient history grouping.');
