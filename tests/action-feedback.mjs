import assert from 'node:assert/strict';
import {runAction} from '../standalone/src/action-feedback.js';
const errors=[];const report=m=>errors.push(m);
await runAction(()=>Promise.reject(new Error('secret SQL detail')),report);
runAction(()=>{throw Error('private detail')},report);
assert.equal(errors.length,2);assert.ok(errors.every(m=>!m.includes('detail')));
assert.equal(await runAction(()=>Promise.resolve(42),report),42);
console.log('PASS: synchronous and async action failures receive safe feedback; successful actions retain result.');
