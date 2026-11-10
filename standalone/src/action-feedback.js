// Catch promise rejections as well as synchronous failures from delegated actions.
export function runAction(action,onError){
 try{return Promise.resolve(action()).catch(()=>onError('Não foi possível concluir a ação. Confira a conexão e tente novamente.'));}
 catch{return onError('Não foi possível executar esta ação. Atualize a página.');}
}
