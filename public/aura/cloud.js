(async()=>{
const screen=html=>document.querySelector('#app').innerHTML=html;
let clinicId=sessionStorage.getItem('aura-clinic')||'',cloud,revision=0,queue=Promise.resolve(),blocked=false,dirty=false;
const endpoint=()=>'/api/clinic'+(clinicId?'?id='+encodeURIComponent(clinicId):'');
async function api(body){const r=await fetch(endpoint(),body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});const v=await r.json();if(!r.ok)throw Object.assign(new Error(v.error||'Falha na conexão'),{status:r.status});return v;}
try{cloud=await api()}catch(e){screen(`<div class="card"><h1>Entre na Aura</h1><p>Conecte sua conta para acessar os dados em qualquer dispositivo.</p><a class="button" target="_top" href="/signin-with-chatgpt?return_to=%2F">Entrar com ChatGPT</a></div>`);return;}
if(!cloud.data){document.querySelector('#cloudStatus').textContent='Configuração inicial';screen('<div class="card"><h1>Bem-vinda à Aura.</h1><p>Crie o espaço da sua clínica ou peça à responsável para autorizar o e-mail da sua conta.</p><form id="createClinic"><label class="field">Nome da clínica<input name="name" required maxlength="100"></label><button>Criar minha clínica</button></form></div>');document.querySelector('#createClinic').onsubmit=async e=>{e.preventDefault();try{const r=await api({action:'create',name:new FormData(e.target).get('name')});sessionStorage.setItem('aura-clinic',r.id);location.reload()}catch(e){alert(e.message)}};return;}
clinicId=cloud.clinic.id;revision=cloud.revision;sessionStorage.setItem('aura-clinic',clinicId);
let source=await(await fetch('/aura/app.js')).text();source=source.replace(/let state;try\{state=JSON.parse\(localStorage.getItem\('aura-v1'\)\)\|\|structuredClone\(initial\)\}catch\{state=structuredClone\(initial\)\}/,'let state=window.AURA_DATA;');
window.AURA_DATA=cloud.data;
// Load the established UI and keep cloud persistence within the same lexical scope.
const script=document.createElement('script');script.textContent=source+`\n`+await(await fetch('/aura/features.js')).text()+`\nwindow.AURA_CONNECT({api:window.AURA_API,cloud:window.AURA_CLOUD});`;window.AURA_API=api;window.AURA_CLOUD=cloud;document.body.appendChild(script);
})().catch(e=>{document.querySelector('#app').textContent='Não foi possível abrir a clínica. Recarregue a página.';console.error(e)});
