import * as model from './clinical-model.js';
import {renderClinicalExport} from './clinical-document.js';
export function createClinicalService(sb,getClinic,verifyMFA){
 return {model,renderClinicalExport, actorId:null,
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
