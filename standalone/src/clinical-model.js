// Clinical content never enters the legacy clinic snapshot or browser storage.
export const clinicalKinds = {
 identity:'Identificação complementar', anamnesis:'Anamnese', evaluation:'Avaliação',
 plan:'Plano de tratamento', procedure:'Procedimento realizado', evolution:'Evolução',
 adverse_event:'Intercorrência', consent:'Minuta de termo'
};
export const clinicalFields = {
 identity:[['birthDate','Data de nascimento','date'],['email','E-mail','email'],['taxId','CPF, apenas quando necessário'],['emergencyContact','Contato de emergência, se pertinente'],['legalGuardian','Responsável legal, se aplicável'],['firstVisit','Primeiro atendimento','date'],['administrativeNote','Observação administrativa']],
 anamnesis:[['complaint','Queixa principal'],['region','Região'],['onset','Há quanto tempo'],['previousTreatment','Tratamentos anteriores'],['expectations','Objetivos, expectativas e limitações discutidas'],['medications','Medicamentos e suplementos relevantes'],['allergies','Agente, reação, gravidade relatada e data aproximada'],['habits','Hábitos relevantes ao procedimento'],['professionalNotes','Observações do profissional']],
 evaluation:[['region','Região avaliada'],['assessmentType','Tipo de avaliação','select',['Facial','Corporal','Outra']],['skin','Características da pele, fototipo e achados'],['findings','Achados, medidas pertinentes e avaliação descritiva']],
 plan:[['objective','Objetivo e justificativa'],['region','Região'],['sessions','Sessões estimadas','number'],['interval','Intervalos definidos pelo profissional'],['limitations','Resultados esperados e limitações'],['beforeCare','Cuidados prévios'],['afterCare','Orientações posteriores'],['followUp','Acompanhamento previsto'],['planStatus','Situação','select',['Planejado','Em andamento','Concluído','Interrompido']]],
 procedure:[['region','Indicação e região tratada'],['technique','Técnica, doses, volumes, unidades e parâmetros'],['equipment','Equipamentos e parâmetros'],['biosafety','Assepsia e biossegurança conforme protocolo'],['instructions','Orientações fornecidas'],['reactions','Reações, intercorrências, condutas e encaminhamentos']],
 evolution:[['followUpType','Tipo de acompanhamento','select',['Presencial','Contato remoto documentado']],['subjective','Relato da paciente'],['objective','Observações objetivas e evolução'],['reactions','Sintomas e reações'],['instructions','Condutas e orientações'],['planChanges','Alterações no plano'],['returnDate','Retorno previsto','date']],
 adverse_event:[['severity','Gravidade avaliada pelo profissional','select',['Não avaliada','Leve','Moderada','Grave']],['symptoms','Descrição, sinais e sintomas'],['productLot','Produto e lote envolvidos'],['actions','Medidas adotadas e encaminhamento'],['contacts','Contatos e acompanhamento'],['eventStatus','Situação e resolução']],
 consent:[['purpose','Finalidade','select',['Procedimento','Fotografia para cuidado','Uso externo de imagem']],['documentVersion','Versão do modelo'],['scope','Escopo, riscos, alternativas, limitações e esclarecimentos'],['manifestation','Manifestação declarada','select',['Ainda não coletada','Aceite relatado — sem assinatura validada','Recusa relatada']],['revocation','Revogação solicitada para usos futuros, se houver']]
};
export const imagePurposes=['Redes sociais','Site institucional','Materiais publicitários','Materiais educativos'];
// Optional documentation, never a prescription or an automatic safety decision.
export const clinicalExtraGroups={
 anamnesis:[{title:'Histórico e hábitos',fields:[['previousProcedureDetails','Procedimentos anteriores: região, data, produtos e resultado conhecido'],['reactionDetails','Reações anteriores: agente, gravidade e quando ocorreu'],['lifestyleDetails','Tabaco, álcool, exposição solar e cuidados com a pele, se pertinentes']]}],
 evaluation:[
  {title:'Avaliação facial',match:['assessmentType','Facial'],fields:[['phototype','Fototipo, se avaliado'],['hydration','Hidratação e oleosidade'],['skinTexture','Textura, acne e lesões'],['pigmentation','Manchas e cicatrizes'],['facialChanges','Rugas, flacidez, assimetria e volume']]},
  {title:'Avaliação corporal',match:['assessmentType','Corporal'],fields:[['bodySkin','Condições da pele e região corporal'],['bodyChanges','Flacidez, estrias, cicatrizes e edema'],['bodyMeasurements','Medidas pertinentes, com suas unidades']]}
 ],
 plan:[{title:'Detalhes do plano',fields:[['identifiedNeed','Queixa ou necessidade identificada'],['followUpCriteria','Quando reavaliar ou encaminhar, conforme decisão profissional']]}],
 procedure:[{title:'Detalhes do procedimento',fields:[['productDetails','Produtos, marcas e fabricantes utilizados'],['batchDetails','Lotes, validades, quantidades e unidades'],['preparationDetails','Preparo e parâmetros registrados pelo profissional'],['applicationDetails','Áreas, técnica e aplicação realizadas']]}],
 adverse_event:[{title:'Acompanhamento da intercorrência',fields:[['eventTiming','Início dos sinais ou sintomas e relação com o atendimento'],['monitoring','Contatos e reavaliações realizados'],['notificationReference','Referência de notificação, se realizada pelo responsável']]}],
 consent:[{title:'Conteúdo do termo',fields:[['possibleBenefits','Benefícios possíveis, sem garantia de resultado'],['risks','Riscos e complicações discutidos'],['alternatives','Alternativas apresentadas'],['resultLimitations','Limitações explicadas'],['priorInstructions','Cuidados antes do procedimento'],['afterInstructions','Cuidados posteriores e acompanhamento'],['questionsDiscussed','Dúvidas esclarecidas']]}]
};
export function clinicalDisplayFields(kind){return [...(clinicalFields[kind]||[]),...(clinicalExtraGroups[kind]||[]).flatMap(group=>group.fields)]}
export function procedureDetailLabels(procedure){
 const name=String(procedure||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(name.includes('toxina'))return ['Preparo e diluição utilizados','Regiões, pontos e unidades aplicadas'];
 if(name.includes('preenchimento'))return ['Produto e preparo utilizados','Regiões, volumes, plano e técnica de aplicação'];
 if(name.includes('bioestimulador'))return ['Produto, preparo e diluição utilizados','Regiões, volumes e técnica de aplicação'];
 if(name.includes('skinbooster'))return ['Produto e preparo utilizados','Regiões, volumes e técnica de aplicação'];
 if(name.includes('microagulhamento'))return ['Equipamento e materiais utilizados','Áreas, profundidade e parâmetros utilizados'];
 if(name.includes('peeling'))return ['Produto, concentração e preparo utilizados','Áreas, tempo de contato e cuidados realizados'];
 if(name.includes('limpeza'))return ['Produtos e materiais utilizados','Etapas e cuidados realizados'];
 return ['Preparo e parâmetros registrados pelo profissional','Áreas, técnica e aplicação realizadas'];
}
const conditions = [
 ['cardiovascular','Hipertensão ou condição cardiovascular'],['diabetes','Diabetes'],
 ['autoimmune','Doença autoimune'],['coagulation','Distúrbio de coagulação'],
 ['allergy','Alergia ou reação anafilática'],['skin','Condição dermatológica'],
 ['infection','Infecção ativa'],['herpes','Herpes recorrente'],['healing','Alteração de cicatrização ou queloide'],
 ['immunosuppression','Imunossupressão'],['oncology','Histórico oncológico relevante'],
 ['surgery','Cirurgias ou internações relevantes'],['pregnancy','Gestação, se pertinente'],
 ['breastfeeding','Amamentação, se pertinente']
];
export const defaultQuestions = conditions.flatMap(([id,label])=>[
 {id,label,type:'tri',required:false},
 {id:id+'_detail',label:'Detalhes: '+label.toLowerCase(),type:'text',when:{field:id,equals:'yes'}}
]);
export const nursingSteps=['Avaliação de Enfermagem','Diagnóstico de Enfermagem','Planejamento de Enfermagem','Implementação de Enfermagem','Evolução de Enfermagem'];
export const triLabels={yes:'Sim',no:'Não',unknown:'Não sei'};
export function validateQuestions(questions){
 if(!Array.isArray(questions)||!questions.length||questions.length>100)throw Error('Use de 1 a 100 perguntas.');
 const ids=new Set();
 for(const q of questions){
  if(!q||!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(q.id)||ids.has(q.id)||['__proto__','constructor','prototype'].includes(q.id))throw Error('Cada pergunta precisa de um identificador único válido.');
  if(typeof q.label!=='string'||!q.label.trim()||q.label.length>300||!['tri','text','date','number','single','multi'].includes(q.type))throw Error('Confira os rótulos e tipos das perguntas.');
  if(['single','multi'].includes(q.type)&&(!Array.isArray(q.options)||q.options.length<1||q.options.length>30||q.options.some(o=>typeof o!=='string'||!o.trim()||o.length>200)||new Set(q.options).size!==q.options.length))throw Error('Informe opções distintas de até 200 caracteres.');
  if(q.when&&(!ids.has(q.when.field)||typeof q.when.equals!=='string'))throw Error('A condição deve se referir a uma pergunta anterior.');
  ids.add(q.id);
 }
 return questions;
}
export function visibleQuestion(q,answers){return !q.when||answers[q.when.field]===q.when.equals}
export function validateAnswers(questions,answers,review=false){
 validateQuestions(questions);
 const clean=Object.create(null);
 for(const q of questions){
  if(!visibleQuestion(q,answers))continue;
  const v=answers[q.id];
  if(v===undefined||v===''||v===null||Array.isArray(v)&&!v.length){if(review&&q.required)throw Error('Responda: '+q.label);continue}
  if(q.type==='tri'&&!Object.hasOwn(triLabels,v)||q.type==='single'&&!q.options.includes(v)||q.type==='multi'&&(!Array.isArray(v)||v.some(x=>!q.options.includes(x))))throw Error('Confira a resposta: '+q.label);
  if(q.type==='number'&&(!Number.isFinite(Number(v))||String(v).trim()===''))throw Error('Informe um número: '+q.label);
  if(q.type==='date'&&!validDate(v))throw Error('Confira a data: '+q.label);
  if(q.type==='text'&&(typeof v!=='string'||v.length>4000))throw Error('Resposta muito longa: '+q.label);
  clean[q.id]=q.type==='number'?Number(v):v;
 }
 return clean;
}
export function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s}
export function patientAge(birthDate,onDate){
 if(!validDate(birthDate)||!validDate(onDate)||birthDate>onDate)return null;
 let age=Number(onDate.slice(0,4))-Number(birthDate.slice(0,4));if(onDate.slice(5)<birthDate.slice(5))age--;return age;
}
export function criticalAlerts(entries){
 // Only reviewed declarations, no diagnosis or automatic clearance.
 const latest=entries.filter(e=>e.kind==='anamnesis'&&e.status!=='draft').sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt))[0];
 if(!latest)return [];
 return (latest.payload.questions||[]).filter(q=>q.type==='tri'&&latest.payload.answers?.[q.id]==='yes').map(q=>q.label);
}
export function clinicalError(error){
 if(error?.code==='40001')return 'Outra versão foi salva. Seu rascunho foi preservado nesta tela. Consulte o histórico antes de continuar.';
 if(error?.message?.includes('CLINICAL_MFA_REQUIRED'))return 'Confirme a autenticação em duas etapas para exportar.';
 if(error?.code==='42501')return 'Acesso clínico não autorizado. Confira o vínculo, as permissões e a sessão.';
 if(error?.code==='PGRST202'||error?.code==='42883')return 'Prontuário ainda não habilitado neste ambiente.';
 if(error?.code==='22023')return 'Confira os campos e vínculos. A alteração não foi salva.';
 return 'Não foi possível salvar ou carregar. Confira a conexão e tente novamente. Seu rascunho continua nesta tela.';
}

export function clinicalStockError(error){
 const messages={CLINICAL_STOCK_UNAVAILABLE:'Esse lote não está mais disponível. Volte e confira os materiais cadastrados.',CLINICAL_STOCK_EXPIRED:'O lote está vencido. Não foi registrada nenhuma baixa.',CLINICAL_STOCK_ALREADY_RECORDED:'Os materiais deste atendimento já foram registrados. Consulte o histórico.',CLINICAL_STOCK_REVIEW_REQUIRED:'Revise e finalize o procedimento antes de registrar os materiais.',CLINICAL_STOCK_HISTORY_PROTECTED:'Os materiais registrados no atendimento precisam ser preservados. Confira o histórico antes de restaurar os dados.'};
 return messages[error?.message]||clinicalError(error);
}

// Serializes autosave and explicit review. A failed request is retried with the same
// idempotency key and exact body before any newer edit is sent.
export function createClinicalWriter({send,id,kind,version=0,requestId=()=>crypto.randomUUID(),onState=()=>{}}){
 let tail=Promise.resolve(),failed=null,conflict=false,pending=0;
 const write=data=>{
  pending++;onState({pending,failed:!!failed,conflict});
  const job=tail.catch(()=>{}).then(async()=>{
   if(conflict)throw Object.assign(Error('CLINICAL_CONFLICT'),{code:'40001'});
   if(failed){
    const replayBody=failed,replay=await send(replayBody);version=replay.version;failed=null;
    const {id:ignoredId,kind:ignoredKind,version:ignoredVersion,requestId:ignoredRequest,...replayed}=replayBody;
    if(JSON.stringify(replayed)===JSON.stringify(data))return replay;
   }
   const body={...data,id,kind,version,requestId:requestId()};failed=body;
   const result=await send(body);version=result.version;failed=null;return result;
  }).catch(error=>{if(error?.code==='40001')conflict=true;else if(error?.code&&['22023','42501','23503','23514','22P02'].includes(error.code))failed=null;throw error}).finally(()=>{pending--;onState({pending,failed:!!failed,conflict,version})});
  tail=job;return job;
 };
 return {write,get state(){return {pending,failed:!!failed,conflict,version}}};
}
