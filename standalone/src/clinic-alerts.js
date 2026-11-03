const cents=value=>Math.round(Number(value||0)*100);
export function clinicAlerts(state,date){
 let outstandingCents=0,pendingRecords=0;
 for(const r of state.records||[]){if(r.deleted)continue;const total=cents(r.price)-cents(r.discount);const received=r.received===undefined?(r.paid?total:0):cents(r.received);const debt=Math.max(0,total-received);if(debt>0){outstandingCents+=debt;pendingRecords++}}
 const end=new Date(date+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+30);const soon=end.toISOString().slice(0,10);
 let lowStock=0,expired=0,expiring=0;
 for(const p of state.products||[]){if(p.deleted)continue;if(Number(p.balance)<=Number(p.minimum||0))lowStock++;if(Number(p.balance)>0&&p.expiry){if(p.expiry<date)expired++;else if(p.expiry<=soon)expiring++}}
 return{outstandingCents,pendingRecords,lowStock,expired,expiring};
}
