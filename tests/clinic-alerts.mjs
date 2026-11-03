import assert from 'node:assert/strict';
import {clinicAlerts} from '../standalone/src/clinic-alerts.js';
const state={records:[{price:100,discount:10,received:30},{price:50,paid:false},{price:80,paid:true},{price:999,deleted:true},{price:0.3,received:0.1}],products:[{balance:2,minimum:3,expiry:'2026-10-28'},{balance:0,minimum:0,expiry:'2026-10-28'},{balance:1,minimum:0,expiry:'2026-11-28'},{balance:1,expiry:'2026-11-29'},{balance:1,expiry:'2026-10-29'},{balance:1,expiry:'2026-10-01',deleted:true}]};
assert.deepEqual(clinicAlerts(state,'2026-10-29'),{outstandingCents:11020,pendingRecords:3,lowStock:2,expired:1,expiring:2});
assert.deepEqual(clinicAlerts({},'2026-10-29'),{outstandingCents:0,pendingRecords:0,lowStock:0,expired:0,expiring:0});
assert.equal(clinicAlerts({products:[{balance:1,expiry:'2027-01-19'}]},'2026-12-20').expiring,1);
assert.equal(clinicAlerts({products:[{balance:1,expiry:'2028-02-29'}]},'2028-01-30').expiring,1);
console.log('PASS: partial receipts, legacy paid records, exact cents, archived items, zero stock and 30-day expiry across year/leap boundaries.');
