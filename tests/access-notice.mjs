import assert from 'node:assert/strict';
import {accessNotice} from '../standalone/src/access-notice.js';
const admin=accessNotice('mfa_required',true);assert.match(admin.description,/administrador já está autorizada/);assert.doesNotMatch(admin.description,/precisa.*liberar/);assert.match(admin.title,/autenticador/);
assert.match(accessNotice('mfa_required').description,/já está autorizada/);assert.match(accessNotice('pending').description,/precisa liberar/);assert.match(accessNotice('expired').description,/venceu/);assert.match(accessNotice('suspended').description,/suspenso/);assert.match(accessNotice('reauthenticate').description,/sessão/);
console.log('PASS: MFA verification, pending license, expired authorization, suspension and session renewal have distinct explanations.');
