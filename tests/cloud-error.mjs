import assert from 'node:assert/strict';
import {cloudErrorMessage} from '../standalone/src/cloud-error.js';
assert.match(cloudErrorMessage({code:'23503',message:'internal_constraint_patient_uuid'}),/preservar registros vinculados/);
assert.equal(cloudErrorMessage({code:'23503',message:'internal_constraint_patient_uuid'}).includes('uuid'),false);
assert.match(cloudErrorMessage({code:'40001'}),/Exporte sua cópia/);
assert.match(cloudErrorMessage({code:'42501',message:'raw details'}),/Acesso não autorizado/);
assert.equal(cloudErrorMessage({code:'XX000',message:'Patient sensitive raw details'}).includes('sensitive'),false);
assert.equal(cloudErrorMessage({code:'22023',message:'Confira o lote.'}),'Confira o lote.');
console.log('PASS: retention/authorization/conflict errors are actionable; unexpected database details stay hidden.');
