import * as model from './clinical-model.js';
import {renderClinicalExport} from './clinical-document.js';
import {createClinicalMediaClient,mountClinicalMedia} from './clinical-media.js';
import {mountClinicalQuestionnaire} from './clinical-questionnaire.js';
import {mountClinicalFollowups} from './clinical-followups.js';
import {mountClinicalSearch} from './clinical-search.js';
export function createClinicalService(sb,getClinic,verifyMFA,{mediaEnabled=false}={}){
 return {model,renderClinicalExport,mediaEnabled,mountClinicalQuestionnaire,mountClinicalFollowups,mountClinicalSearch,mediaClient:createClinicalMediaClient(sb,getClinic,verifyMFA),mountClinicalMedia,actorId:null,
  async searchCall(patient,body={}){
   let response;try{response=await sb.rpc('aura_clinical_search',{p_clinic:getClinic(),p_patient:patient,p_body:body})}catch{throw Error('Não foi possível pesquisar agora. Confira a conexão e tente novamente.')}
   if(response.error)throw Object.assign(Error(model.clinicalError(response.error)),{code:response.error.code});return response.data;
  },
  async followupCall(action,patient=null,body={}){
   let response;try{response=await sb.rpc('aura_clinical_followup_rpc',{p_action:action,p_clinic:getClinic(),p_patient:patient,p_body:body})}catch{throw Error('Não foi possível confirmar o retorno. Tente novamente.')}
   if(response.error){const messages={FOLLOWUP_ALREADY_SCHEDULED:'Este retorno já possui um horário ou está concluído. Atualize a lista para conferir.','Conflito de agendamentos':'Esse horário já está ocupado. Escolha outro.'};throw Object.assign(Error(messages[response.error.message]||model.clinicalError(response.error)),{code:response.error.code})}return response.data;
  },
  async formTemplateCall(action,patient,body={}){
   let response;try{response=await sb.rpc('aura_clinical_form_template_rpc',{p_action:action,p_clinic:getClinic(),p_patient:patient,p_body:body})}catch{throw Error('Não foi possível confirmar o modelo. Tente novamente com as mesmas informações.')}
   if(response.error)throw Object.assign(Error(model.clinicalError(response.error)),{code:response.error.code});return response.data;
  },
  async stockCall(action,patient,body={}){
   let response;try{response=await sb.rpc('aura_clinical_stock_rpc',{p_action:action,p_clinic:getClinic(),p_patient:patient,p_body:body})}catch{throw Error('Não foi possível confirmar o consumo. Repita a mesma solicitação antes de iniciar outro envio.')}
   if(response.error)throw Object.assign(Error(model.clinicalStockError(response.error)),{code:response.error.code});
   return response.data;
  },
  async documentCall(action,patient,body={},retry=true){
   let response;try{response=await sb.rpc('aura_clinical_document_rpc',{p_action:action,p_clinic:getClinic(),p_patient:patient,p_body:body})}catch{throw Error(model.clinicalError(null))}
   if(response.error){if(retry&&response.error.message?.includes('CLINICAL_MFA_REQUIRED')){await verifyMFA();return this.documentCall(action,patient,body,false)}throw Object.assign(Error(model.clinicalError(response.error)),{code:response.error.code})}
   return response.data;
  },
  async call(action,patient,body={},retry=true){
   let response;
   try{response=await sb.rpc('aura_clinical_rpc',{p_action:action,p_clinic:getClinic(),p_patient:patient,p_body:body})}
   catch{throw new Error(model.clinicalError(null))}
   const {data,error}=response;
   if(error){
    if(retry&&error.message?.includes('CLINICAL_MFA_REQUIRED')){await verifyMFA();return this.call(action,patient,body,false)}
    throw Object.assign(new Error(model.clinicalError(error)),{code:error.code});
   }
   return data;
  }
 };
}
