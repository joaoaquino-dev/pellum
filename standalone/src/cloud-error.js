export function isClinicOwnershipError(error){
 return error?.code==='42501'&&['CLINIC_OWNER_MEMBERSHIP_PROTECTED','CLINIC_OWNER_REQUIRED'].includes(error.message);
}
export function cloudErrorMessage(error){
 if(isClinicOwnershipError(error))return error.message==='CLINIC_OWNER_MEMBERSHIP_PROTECTED'
  ?'O acesso da proprietária não pode ser removido por este formulário. Os demais acessos podem ser gerenciados normalmente.'
  :'Somente a proprietária pode excluir esta clínica. Seu acesso de gestão continua ativo.';
 if(error?.code==='40001')return 'Outra profissional alterou a clínica. Exporte sua cópia e recarregue.';
 if(error?.code==='23503')return 'A alteração foi bloqueada para preservar registros vinculados, como prontuários, arquivos e documentos. Solicite o encerramento com retenção do histórico.';
 if(error?.code==='42501'||String(error?.message||'').includes('AURA_'))return 'Acesso não autorizado. Confira a liberação e entre novamente.';
 if(error?.code==='22023'&&typeof error.message==='string'&&error.message.length<=500)return error.message;
 return 'Não foi possível concluir a alteração. Confira a conexão e a sessão; seus registros não foram confirmados.';
}
