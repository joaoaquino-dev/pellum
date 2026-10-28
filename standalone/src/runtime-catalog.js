const defaultProcedureCatalog=procedures.slice();
const connectBeforeCatalog=window.AURA_CONNECT;
window.AURA_CONNECT=function(options){
 procedures.splice(0,procedures.length,...defaultProcedureCatalog,...(state.customProcedures||[]));
 connectBeforeCatalog(options);
 const oldSettingsCatalog=settings;
 settings=function(){oldSettingsCatalog();$('#app').insertAdjacentHTML('beforeend',`<div class="card sectiongap"><h2>Seus procedimentos</h2><p>Adicione os serviços que esta clínica oferece. Eles ficam disponíveis na agenda e na precificação.</p><form id="procedureCatalogForm" class="sectiongap"><label class="field">Nome do procedimento<input name="procedure" maxlength="120" placeholder="Ex.: Drenagem linfática" required></label><button>Adicionar procedimento</button></form><details class="sectiongap"><summary>Ver procedimentos disponíveis (${procedures.length})</summary><ul>${procedures.map(name=>`<li style="overflow-wrap:anywhere">${esc(name)}</li>`).join('')}</ul></details></div>`);$('#procedureCatalogForm').onsubmit=e=>{e.preventDefault();const name=new FormData(e.target).get('procedure').trim();if(!name)return;if(procedures.some(p=>p.localeCompare(name,'pt-BR',{sensitivity:'base'})===0))return toast('Esse procedimento já está cadastrado.');if((state.customProcedures||[]).length>=100)return toast('Limite de 100 procedimentos personalizados por clínica.');(state.customProcedures??=[]).push(name);procedures.push(name);persist('Cadastro de procedimento');settings();toast('Procedimento adicionado à agenda e à precificação.')};
 };
 route();
};
