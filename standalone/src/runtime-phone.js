const connectBeforePhone=window.AURA_CONNECT;
window.AURA_CONNECT=function(options){
 connectBeforePhone(options);const phone=window.AURA_PHONE;
 function bindPhone(form){if(!form)return;const input=form.elements.phone;if(!input)return;
  input.maxLength=19;input.inputMode='tel';input.autocomplete='tel-national';input.placeholder='(61) 99999-9999';
  const validate=()=>{const value=input.value.trim();input.setCustomValidity(phone.validPhone(value)?'':'Informe um telefone brasileiro válido com DDD: 10 dígitos para fixo ou 11 para celular.');};
  input.oninput=()=>{input.value=phone.formatPhone(input.value);validate()};
  input.onpaste=e=>{const pasted=e.clipboardData?.getData('text');if(pasted===undefined)return;e.preventDefault();input.value=pasted.slice(0,26);input.oninput();};
  input.value=phone.formatPhone(input.value);validate();
  const submit=form.onsubmit;form.onsubmit=e=>{validate();if(!form.reportValidity()){e.preventDefault();return}input.value=phone.phoneDigits(input.value);return submit(e)};
 }
 const priorCreate=patientForm;patientForm=function(){priorCreate();bindPhone($('#patientform'))};
 const priorEdit=window.editPatient;window.editPatient=id=>{priorEdit(id);bindPhone($('#editPatientForm'))};
 const priorList=patientsList;patientsList=function(){priorList();const removed=$('#showRemoved')?.checked;const ps=state.patients.filter(p=>!!p.deleted===!!removed&&p.name.toLowerCase().includes($('#patientSearch').value.toLowerCase()));
  $('#patientsList').querySelectorAll('tbody tr').forEach((row,i)=>{const p=ps[i];if(!p||removed)return;const url=phone.whatsappURL(p.phone);if(!url)return;
   row.lastElementChild.insertAdjacentHTML('afterbegin',`<a class="button secondary" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="Abrir WhatsApp de ${esc(p.name)}"><svg class="ui-icon" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.8 7.4L3 21l1.8-5.2A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 7c0 5 4 8 8 9l1-3-3-1-1 1-3-3 1-1-1-2Z"/></svg>WhatsApp</a> `);
  });
 };
 if(page==='pacientes')patientsList();
};
