const connectBeforeAlerts=window.AURA_CONNECT;
window.AURA_CONNECT=function(options){
 connectBeforeAlerts(options);
 const priorDashboard=dashboard;
 dashboard=function(){priorDashboard();const a=window.AURA_CLINIC_ALERTS(state,today());const items=[];
  if(a.pendingRecords)items.push({href:'#financeiro',icon:'arrow',title:money(a.outstandingCents/100)+' a receber',text:a.pendingRecords+' atendimento(s) com saldo, considerando todos os meses.'});
  if(a.lowStock)items.push({href:'#estoque',icon:'stock',title:a.lowStock+' item(ns) para repor',text:'Saldo igual ou abaixo do mínimo cadastrado.'});
  if(a.expired)items.push({href:'#estoque',icon:'clock',title:a.expired+' lote(s) vencido(s)',text:'Ainda possuem saldo. Confira o descarte antes de utilizar.'});
  if(a.expiring)items.push({href:'#estoque',icon:'calendar',title:a.expiring+' lote(s) perto da validade',text:'Vencimento nos próximos 30 dias, incluindo hoje.'});
  const panel=document.createElement('section');panel.className='clinic-alerts';panel.setAttribute('aria-labelledby','clinicAlertsTitle');panel.innerHTML='<div class="cardhead"><h2 id="clinicAlertsTitle">Para acompanhar</h2><small>Somente desta clínica</small></div>'+(items.length?'<div class="clinic-alert-grid">'+items.map(x=>`<a class="clinic-alert" href="${x.href}">${uiIcon(x.icon)}<span><strong>${esc(x.title)}</strong><small>${esc(x.text)}</small></span>${uiIcon('arrow')}</a>`).join('')+'</div>':'<p class="clinic-alert-empty">Nenhuma pendência de recebimento, reposição ou validade nos dados cadastrados.</p>');
  $('#app .heading').after(panel);
 };
 if(page==='inicio')dashboard();
};
