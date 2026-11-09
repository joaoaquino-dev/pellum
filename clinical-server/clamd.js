import net from 'node:net';
import tls from 'node:tls';
import {mediaError} from './files.js';
// ClamD's native TCP protocol has no authentication. Only loopback development
// may use plaintext; remote operation requires a private TLS tunnel and ACLs.
export function createClamdScanner(address,{development=false,now=()=>Date.now(),maxDefinitionAgeMs=7*86400000}={}){
 let url;try{url=new URL(address)}catch{throw mediaError('SCANNER_UNAVAILABLE',503)}
 const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(!['tcp:','tls:'].includes(url.protocol)||url.username||url.password||url.pathname||!url.port||url.search||url.hash||url.protocol==='tcp:'&&!(loopback&&development))throw mediaError('SCANNER_UNAVAILABLE',503);
 const command=(name,bytes)=>new Promise((resolve,reject)=>{
  const options={host:url.hostname.replace(/^\[|\]$/g,''),port:Number(url.port)};
  const socket=url.protocol==='tls:'?tls.connect({...options,rejectUnauthorized:true}):net.connect(options);
  let response=Buffer.alloc(0),done=false;
  const fail=()=>{if(!done){done=true;socket.destroy();reject(mediaError('SCANNER_UNAVAILABLE',503))}};
  socket.setTimeout(15000,fail);socket.on('error',fail);socket.on('end',()=>{if(!done)fail()});
  socket.on(url.protocol==='tls:'?'secureConnect':'connect',()=>{
   socket.write(Buffer.from('z'+name+'\0'));
   if(bytes){for(let offset=0;offset<bytes.length;offset+=65536){const chunk=bytes.subarray(offset,offset+65536),length=Buffer.alloc(4);length.writeUInt32BE(chunk.length);socket.write(length);socket.write(chunk)}socket.write(Buffer.alloc(4))}
  });
  socket.on('data',chunk=>{
   response=Buffer.concat([response,chunk]);if(response.length>2048)return fail();
   const end=response.indexOf(0);if(end>=0&&!done){done=true;socket.destroy();resolve(response.subarray(0,end).toString('utf8'))}
  });
 });
 return async bytes=>{
  const version=await command('VERSION'),parts=version.split('/'),date=Date.parse(parts.slice(2).join('/'));
  if(!/^ClamAV [\w.-]+$/.test(parts[0])||!Number.isFinite(date)||now()-date>maxDefinitionAgeMs||date>now()+86400000)throw mediaError('SCANNER_UNAVAILABLE',503);
  const result=await command('INSTREAM',bytes);
  if(result.endsWith(' FOUND'))throw mediaError('FILE_REJECTED');
  if(result!=='stream: OK')throw mediaError('SCANNER_UNAVAILABLE',503);
  return {clean:true,engine:parts.slice(0,2).join('/')};
 };
}
