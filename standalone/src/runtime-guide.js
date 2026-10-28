const connectBeforeGuide=window.AURA_CONNECT;
window.AURA_CONNECT=function(options){
 connectBeforeGuide(options);
 const {cloud}=options;
 const key='pellum-start-'+cloud.clinic.id;
 let progress={step:0,seen:false};
 try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&Number.isInteger(saved.step)&&saved.step>=0&&saved.step<=4)progress={step:saved.step,seen:!!saved.seen}}catch{}
 const remember=()=>{try{localStorage.setItem(key,JSON.stringify(progress))}catch{}};
 const countPatients=()=>state.patients.filter(p=>!p.deleted).length;
 const activeIds=()=>window.AURA_TEAM_MODEL.activeProfessionalIds(state);
 const isFresh=()=>state.records.length===0&&state.patients.length===0&&state.products.length===0&&activeIds().every(i=>/^(Minha profissional|Profissional responsável|Profissional \d+|Nova profissional)$/.test(state.names[i]));
 const go=step=>{progress.step=step;remember();renderStart()};
 function renderStart(){
  const step=progress.step;
  const content=[
   `<h2>Vamos começar?</h2><p>Em poucos passos, deixe a Pellum com a sua cara. Você pode trabalhar por conta própria e adicionar uma equipe quando precisar.</p><div class="hint sectiongap"><p>Primeiro, quem atende. Depois, os produtos e insumos e a primeira paciente. Você pode fazer o restante mais tarde.</p></div><div class="actions sectiongap"><button id="startNext">Configurar minha clínica</button><button class="secondary" id="startLater">Fazer depois</button></div>`,
   `<h2>Quem atende na clínica?</h2><p>Comece com o seu nome. Em Configurações, você poderá adicionar outras pessoas quando precisar.</p><form id="startProfile"><label class="field sectiongap">Nome profissional<input name="professional" maxlength="60" value="${esc(isFresh()?'':state.names[activeIds()[0]])}" placeholder="Como você quer aparecer na agenda?" required></label><small>Sua clínica começa com uma pessoa. Não é necessário cadastrar uma parceria.</small><div class="actions sectiongap"><button>Salvar e continuar</button><button type="button" class="secondary" id="startLater">Fazer depois</button></div></form>`,
   `<h2>Quais produtos e insumos você usa?</h2><p>Cadastre o valor da caixa, a quantidade que vem nela e quem comprou. A Pellum calcula o custo por unidade.</p><div class="hint sectiongap"><p>Exemplo: uma caixa com 100 luvas por R$ 50 custa R$ 0,50 por luva. No procedimento, informe apenas a quantidade utilizada.</p></div><p class="sectiongap">${state.products.length} item(ns) cadastrado(s).</p><button class="secondary" id="startProduct">＋ Cadastrar produto ou insumo</button><div class="actions sectiongap"><button id="startNext">${state.products.length?'Continuar':'Fazer isso depois'}</button><button class="textbtn" id="startBack">Voltar</button></div>`,
   `<h2>Adicione sua primeira paciente</h2><p>O cadastro permite agendar horários e registrar os atendimentos. Preencha somente as informações necessárias para a rotina da clínica.</p><p class="sectiongap">${countPatients()} paciente(s) cadastrado(s).</p><button class="secondary" id="startPatient">＋ Cadastrar paciente</button><div class="actions sectiongap"><button id="startNext">${countPatients()?'Continuar':'Fazer isso depois'}</button><button class="textbtn" id="startBack">Voltar</button></div>`,
   `<h2>Seu espaço está pronto para começar.</h2><p>Escolha o próximo passo. Você pode voltar a este guia pelo menu “Como usar”.</p><div class="actions sectiongap"><a class="button" href="#agenda" data-finish-start>Agendar um horário</a><a class="button secondary" href="#calcular" data-finish-start>Simular um procedimento</a></div><div class="hint sectiongap"><h3>Como o dinheiro entra no sistema?</h3><p>Na Precificação, informe o valor e os materiais utilizados. Clique em “Registrar atendimento” para enviar o lançamento ao Financeiro. Depois, registre os recebimentos para acompanhar o saldo.</p></div><button class="secondary sectiongap" id="startFinish">Ir para a visão geral</button>`
  ];
  $('#app').innerHTML=head('Seu espaço começa aqui.','Um passo de cada vez, no seu ritmo.')+`<div class="card" style="max-width:720px"><small>PRIMEIROS PASSOS · ${step+1} DE 5</small><div class="progress sectiongap" role="progressbar" aria-label="Configuração inicial" aria-valuemin="1" aria-valuemax="5" aria-valuenow="${step+1}"><span style="width:${(step+1)*20}%"></span></div><div class="sectiongap">${content[step]}</div></div>`;
  if($('#startNext'))$('#startNext').onclick=()=>go(Math.min(step+1,4));
  if($('#startBack'))$('#startBack').onclick=()=>go(Math.max(step-1,0));
  if($('#startLater'))$('#startLater').onclick=finish;
  if($('#startFinish'))$('#startFinish').onclick=finish;
  document.querySelectorAll('[data-finish-start]').forEach(a=>a.onclick=()=>{progress.seen=true;remember()});
  if($('#startProfile'))$('#startProfile').onsubmit=e=>{e.preventDefault();const name=new FormData(e.target).get('professional').trim();if(!name)return;state.names[activeIds()[0]]=name;if(persist('Configuração inicial da profissional')===false)return;go(2)};
  for(const [id,open] of [['startProduct',()=>window.productForm()],['startPatient',()=>window.patientForm()]])if($('#'+id))$('#'+id).onclick=()=>{open();const f=$('#dialogbody form');if(!f)return;const submit=f.onsubmit;f.onsubmit=e=>{submit(e);if(!$('#modal').open)renderStart()}};
 }
 function finish(){progress.seen=true;remember();location.hash='inicio'}
 function help(){
  $('#app').innerHTML=head('Como usar a Pellum.','Um caminho simples para organizar sua rotina.')+`<div class="card"><h2>Comece pelo essencial</h2><p>Cadastre somente quem atende nesta clínica. Se trabalha por conta própria, uma pessoa é suficiente.</p><button class="sectiongap" id="reopenStart">Abrir primeiros passos</button></div><div class="grid sectiongap">${[
   ['1. Configure quem atende','Informe seu nome e adicione outras pessoas somente se fizerem parte desta clínica.','config','Abrir configurações'],
   ['2. Personalize os procedimentos','Em Configurações, use Seus procedimentos para cadastrar outros serviços. Eles aparecem na agenda e na precificação.','config','Cadastrar procedimentos'],
   ['3. Cadastre os materiais','Informe preço e quantidade da embalagem. Use pares, unidades, ml ou g conforme a forma de consumo.','estoque','Produtos e insumos'],
   ['4. Cadastre a paciente','Crie o cadastro antes de agendar ou registrar um atendimento.','pacientes','Abrir pacientes'],
   ['5. Organize os horários','Escolha paciente, procedimento, profissional, data e horário.','agenda','Abrir agenda'],
   ['6. Calcule e registre','Informe o preço, as taxas e a quantidade de materiais usados. No individual, 100% fica com a pessoa responsável; a parceria é opcional. Clique em Registrar atendimento.','calcular','Simular procedimento'],
   ['7. Acompanhe os resultados','Registre cada recebimento e consulte custos, saldo e relatórios. Os repasses aparecem quando o atendimento tem parceria.','financeiro','Abrir financeiro']
  ].map(([title,description,hash,label])=>`<div class="card"><h2>${title}</h2><p>${description}</p><a class="button secondary sectiongap" href="#${hash}">${label}</a></div>`).join('')}</div><div class="hint"><h3>Equipe e acesso são coisas diferentes</h3><p>Adicionar uma pessoa à equipe identifica quem atende. Para ela entrar no sistema, cada conta precisa ser autorizada na plataforma e vinculada à clínica. Remover da equipe não apaga o histórico nem revoga esse acesso.</p></div>`;
  $('#reopenStart').onclick=()=>{progress.step=0;remember();location.hash='comecar'};
 }
 if(!pages.some(p=>p[0]==='ajuda'))pages.push(['ajuda',uiIcon('help'),'Como usar']);
 const oldRouteGuide=route;
 window.removeEventListener('hashchange',oldRouteGuide);
 route=function(){const hash=location.hash.slice(1);if(hash==='ajuda'||hash==='comecar'){
  page=hash;$('#nav').innerHTML=pages.map(([id,icon,label])=>`<a href="#${id}" class="${id==='ajuda'?'active':''}"><b>${icon}</b>${label}</a>`).join('');$('#breadcrumb').textContent='Meu espaço / '+(hash==='comecar'?'Primeiros passos':'Como usar');(hash==='comecar'?renderStart:help)();return;
 }oldRouteGuide();if(page==='inicio'&&!progress.seen){$('#app').insertAdjacentHTML('afterbegin','<div class="hint sectiongap"><h2>Vamos começar?</h2><p>Configure seu espaço com um guia rápido. Você pode fazer uma etapa de cada vez.</p><div class="actions"><a class="button" href="#comecar">Abrir primeiros passos</a><button class="secondary" id="dismissStart">Fazer depois</button></div></div>');$('#dismissStart').onclick=()=>{progress.seen=true;remember();route()}}};
 window.addEventListener('hashchange',route);
 if(!progress.seen&&isFresh()&&!['admin','ajuda'].includes(location.hash.slice(1)))location.hash='comecar';
 route();
};
