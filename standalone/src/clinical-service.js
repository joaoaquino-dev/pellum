import * as model from './clinical-model.js';
import {renderClinicalExport} from './clinical-document.js';
import {createClinicalMediaClient,mountClinicalMedia} from './clinical-media.js';
import {mountClinicalQuestionnaire} from './clinical-questionnaire.js';
export function createClinicalService(sb,getClinic,verifyMFA,{mediaEnabled=false}={}){
 return {model,renderClinicalExport,mediaEnabled,mountClinicalQuestionnaire,mediaClient:createClinicalMediaClient(sb,getClinic,verifyMFA),mountClinicalMedia,actorId:null,
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
