import assert from 'node:assert/strict';
import net from 'node:net';
import {createClamdScanner} from '../clinical-server/clamd.js';
import {createMediaHandler} from '../clinical-server/media-handler.js';
import {resolveMediaServerConfig} from '../clinical-server/config.js';
let checks=0,infected=false,stale=false;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
for(const url of ['tcp://example.com:3310','tls://user:pass@example.com:3310','http://localhost:3310']){assert.throws(()=>createClamdScanner(url,{development:true}));checks++}
const daemon=net.createServer(socket=>{
 let pending=Buffer.alloc(0),command=null;
 socket.on('data',chunk=>{
  pending=Buffer.concat([pending,chunk]);
  if(!command){const end=pending.indexOf(0);if(end<0)return;command=pending.subarray(0,end).toString();pending=pending.subarray(end+1);
   if(command==='zVERSION'){const date=new Date(Date.now()-(stale?10:0)*86400000).toUTCString();socket.end('ClamAV 1.4.5/12345/'+date+'\0');return}
  }
  if(command==='zINSTREAM'){
   while(pending.length>=4){const length=pending.readUInt32BE();if(pending.length<4+length)return;pending=pending.subarray(4+length);if(length===0){socket.end(infected?'stream: QA.Test FOUND\0':'stream: OK\0');return}}
  }
 });
});
await new Promise(resolve=>daemon.listen(0,'127.0.0.1',resolve));
try{
 const scan=createClamdScanner('tcp://127.0.0.1:'+daemon.address().port,{development:true});
 eq((await scan(Buffer.from('synthetic data'))).clean,true);
 infected=true;await assert.rejects(()=>scan(Buffer.from('synthetic data')),e=>e.code==='FILE_REJECTED');checks++;
 infected=false;stale=true;await assert.rejects(()=>scan(Buffer.from('synthetic data')),e=>e.code==='SCANNER_UNAVAILABLE');checks++;
 eq((await resolveMediaServerConfig({})).enabled,false);
 const handler=createMediaHandler({enabled:false});eq((await handler(new Request('http://localhost',{method:'POST'}))).status,503);
 const logs=[];const safe=createMediaHandler({enabled:true,origin:'https://qa.example.invalid',gateway:{authenticate:async()=>{throw Error('sensitive raw error')}},logger:event=>logs.push(event)});
 const denied=await safe(new Request('https://qa.example.invalid/api/clinical-media',{method:'POST',headers:{authorization:'Bearer synthetic-token'}}));eq(denied.status,503);eq((await denied.text()).includes('sensitive'),false);eq(JSON.stringify(logs).includes('sensitive'),false);
 console.log(`PASS: ${checks} scanner/config/endpoint checks. ClamD TCP protocol tested against a local protocol fixture, not a live antivirus database; missing/stale scanner fails closed and errors stay sanitized.`);
}finally{await new Promise(resolve=>daemon.close(resolve))}
