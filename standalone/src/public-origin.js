export const originalPublicOrigin='https://usepellum.vercel.app';
export function resolvePublicOrigin(value=originalPublicOrigin){
 let url;try{url=new URL(value)}catch{throw Error('Endereço público inválido.')}
 const labels=url.hostname.split('.');
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.port||labels.length<2||labels.some(label=>!(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))))throw Error('Use somente a origem HTTPS do endereço público.');
 return url.origin;
}
