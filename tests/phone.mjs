import assert from 'node:assert/strict';
import {phoneDigits,validPhone,formatPhone,whatsappURL} from '../standalone/src/phone.js';
for(const p of ['','61987654321','(61) 98765-4321','+55 (61) 98765-4321','6134567890','(11) 3456-7890'])assert.equal(validPhone(p),true,p);
for(const p of ['00000000000','61999999999','99999999999999999999999','123','(20) 98765-4321','619876543210','abc61987654321','+1 2025550123','6118765432'])assert.equal(validPhone(p),false,p);
assert.equal(phoneDigits('+55 (61) 98765-4321'),'61987654321');assert.equal(formatPhone('61987654321'),'(61) 98765-4321');assert.equal(formatPhone('6134567890'),'(61) 3456-7890');assert.equal(whatsappURL('(61) 98765-4321'),'https://wa.me/5561987654321');assert.equal(whatsappURL(''),null);assert.equal(whatsappURL('99999999999999999999'),null);
console.log('PASS: national and +55 input; valid DDD and lengths; invalid/long/repeated numbers rejected; WhatsApp URLs require valid numbers.');
