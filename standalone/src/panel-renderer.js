// Coalesce concurrent requests and discard responses for detached/rerouted panels.
export function createPanelRenderer({getContainer,createRoot,render}){
 let active=null;
 return function show(){
  const container=getContainer();
  if(!container)return Promise.resolve();
  if(active?.container===container&&active.root.isConnected&&active.pending)return active.pending;
  const root=active?.container===container&&active.root.isConnected?active.root:createRoot(container);
  const job={container,root,pending:null};active=job;
  const isCurrent=()=>active===job&&root.isConnected&&root.parentElement===container;
  job.pending=Promise.resolve().then(()=>{if(isCurrent())return render(root,isCurrent)}).finally(()=>{if(active===job)job.pending=null});
  return job.pending;
 };
}
