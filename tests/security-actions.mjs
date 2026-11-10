import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseAction,allowedActions} from '../standalone/src/actions.js';
const element={value:'Confirmado',dataset:{email:'test@example.invalid'}};
assert.deepEqual(parseAction("setStatus('a1',this.value)",element),{name:'setStatus',args:['a1','Confirmado']});
assert.deepEqual(parseAction('moveMonth(-1)',element),{name:'moveMonth',args:[-1]});
assert.deepEqual(parseAction('removeMember(this.dataset.email)',element),{name:'removeMember',args:['test@example.invalid']});
assert.deepEqual(parseAction("download('aura-backup.json',JSON.stringify(state,null,2),'application/json')",element),{name:'backup',args:['aura-backup.json']});
for(const payload of ["patientHistory('x');alert(1)//","patientHistory('x',fetch('/steal'))","window.location('https://evil.invalid')","patientHistory('x');document.body.innerHTML='bad'","patientHistory(this.constructor.constructor('alert(1)')())","patientHistory('x',)"]){assert.throws(()=>parseAction(payload,element),payload)}
assert.equal(allowedActions.has('fetch'),false);assert.equal(allowedActions.has('eval'),false);assert.equal(allowedActions.has('Function'),false);
const runtime=await readFile('standalone/dist/runtime.js','utf8'),main=await readFile('standalone/dist/main.js','utf8'),config=JSON.parse(await readFile('vercel.json','utf8'));
assert.equal(/\son(?:click|change|input|submit)=/.test(runtime),false);
assert.equal(/(?:new\s+Function\s*\(|\beval\s*\()/.test(runtime+main),false);
const csp=config.headers[0].headers.find(h=>h.key==='Content-Security-Policy').value;
assert.match(csp,/script-src 'self';/);assert.equal(/script-src[^;]*unsafe/.test(csp),false);assert.match(csp,/frame-ancestors 'none'/);
assert.equal(/sb_secret_[A-Za-z0-9_-]{12,}/.test(main),false);
for(const v of ['=1+1','\t=1+1','  +CMD','\r@SUM(1)','-1'])assert.ok(v.replace(/^[\s\u0000-\u001f]*[=+@-]/,"' $&").startsWith("'"));
console.log('PASS: 4 allowed actions, 6 injection payloads, fixed command allowlist, strict script CSP, no inline event attributes, no eval, no privileged key pattern.');
