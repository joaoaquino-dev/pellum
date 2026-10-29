export function accessNotice(status,isAdmin=false){
 if(status==='mfa_required')return{title:'Confirme seu autenticador.',description:isAdmin?'Sua conta de administrador já está autorizada. Confirme o código do seu aplicativo autenticador para continuar.':'Sua conta já está autorizada. Confirme o código do seu aplicativo autenticador para continuar.',refresh:'Conferir verificação'};
 if(status==='reauthenticate')return{title:'Entre novamente.',description:'Sua sessão precisa ser renovada. Saia da conta e entre novamente para continuar.',refresh:'Tentar novamente'};
 if(status==='expired')return{title:'Autorização vencida.',description:'A autorização de uso desta conta venceu. Entre em contato com a administração para renovar.',refresh:'Conferir liberação'};
 if(status==='suspended')return{title:'Acesso suspenso.',description:'O uso desta conta está suspenso. Entre em contato com a administração para conferir o acesso.',refresh:'Conferir liberação'};
 return{title:'Aguardando autorização.',description:'O cadastro foi recebido. A administração precisa liberar o uso desta conta antes de você acessar as clínicas.',refresh:'Conferir liberação'};
}
