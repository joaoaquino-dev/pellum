export const activeProfessionalIds=s=>s.names.map((_,i)=>i).filter(i=>!(s.inactivePros||[]).includes(i));
export const recordProfessionalIds=r=>r.professionalIds||[0,1];
export const professionalNames=(s,r)=>r.professionalNames||recordProfessionalIds(r).map(i=>s.names[i]||'Profissional histórica');
export function checkArchive(s,id,today){
 if(!activeProfessionalIds(s).includes(id))return 'Profissional já removida da equipe ativa.';
 if(activeProfessionalIds(s).length===1)return 'A clínica precisa ter pelo menos uma profissional ativa.';
 if(s.appointments.some(a=>a.pro===id&&!a.deleted&&a.date>=today&&!['Cancelado','Faltou','Atendido'].includes(a.status)))return 'Transfira ou cancele os agendamentos futuros dessa profissional antes de removê-la.';
 if(s.products.some(p=>p.owner===id&&p.balance>0))return 'Essa profissional possui estoque. Registre o destino ou a saída dos itens antes de removê-la.';
 return null;
}
