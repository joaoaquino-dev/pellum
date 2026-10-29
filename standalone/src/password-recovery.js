export async function updateRecoveredPassword(auth,verifyMFA,password){
 const session=await auth.getSession();
 if(session.error)throw session.error;
 if(!session.data.session){const error=new Error('Recovery session missing');error.code='recovery_session_missing';throw error}
 let result=await auth.updateUser({password});
 if(result.error?.code==='insufficient_aal'){
  await verifyMFA({allowEnrollment:false});
  result=await auth.updateUser({password});
 }
 if(result.error)throw result.error;
 return result;
}
export function passwordRecoveryMessage(error){
 if(error?.status===429)return 'Muitas tentativas. Aguarde antes de tentar novamente.';
 if(['recovery_session_missing','session_not_found','session_expired','flow_state_expired','flow_state_not_found','bad_code_verifier','otp_expired'].includes(error?.code)||error?.name==='AuthSessionMissingError')return 'O link de recuperação expirou ou não abriu uma sessão válida. Solicite outro em “Esqueci a senha” e abra o e-mail no mesmo navegador e dispositivo em que fez o pedido.';
 if(error?.code==='same_password')return 'Escolha uma senha diferente da senha atual.';
 if(error?.code==='weak_password')return 'Essa senha não atende aos requisitos de segurança. Use uma senha nova e forte, com pelo menos 12 caracteres.';
 if(error?.code==='insufficient_aal')return 'Confirme o código do seu aplicativo autenticador antes de salvar a nova senha.';
 if(error?.code==='mfa_cancelled')return 'A verificação foi cancelada. Clique em “Salvar nova senha” e confirme o código do seu autenticador.';
 return 'Não foi possível salvar a nova senha. Confira sua conexão e tente novamente. Se o link não funcionar, solicite outro em “Esqueci a senha”.';
}
