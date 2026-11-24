import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {sealRecoveryStream,restoreRecoveryStream} from '../clinical-server/backup-stream.js';
const key=randomBytes(32);let checks=0;
function sink(){let current,staged=new Map();return {visible:new Map(),aborted:false,largestChunk:0,async beginArchive(){},async beginEntry(entry){current={name:entry.name,size:0,hash:createHash('sha256')}},async writeChunk(bytes){current.size+=bytes.length;current.hash.update(bytes);this.largestChunk=Math.max(this.largestChunk,bytes.length)},async endEntry(end){assert.equal(current.hash.digest('hex'),end.sha256);staged.set(current.name,{size:current.size,sha256:end.sha256})},async commitArchive(){this.visible=staged},async abortArchive(){staged.clear();this.visible.clear();this.aborted=true}}}
try{
 const chunk=Buffer.alloc(65536,77),size=80*1024*1024;
 async function* chunks(){for(let i=0;i<size/chunk.length;i++)yield chunk}
 const target=sink();const result=await restoreRecoveryStream(sealRecoveryStream([{name:'database/large-synthetic.dump',size,chunks:chunks()}],key),key,target);
 assert.equal(result.totalBytes,size);assert.equal(target.visible.get('database/large-synthetic.dump').size,size);assert.equal(target.largestChunk,65536);checks+=3;
 const small=[];for await(const value of sealRecoveryStream([{name:'objects/qa/example',bytes:Buffer.from('fictitious data')}],key))small.push(value);
 const complete=Buffer.concat(small);
 for(const altered of [complete.subarray(0,-1),Buffer.concat([complete,Buffer.from('trailing')]),Buffer.from(complete)]){
  if(altered.length===complete.length)altered[altered.length-25]^=1;
  const rejected=sink();await assert.rejects(()=>restoreRecoveryStream([altered],key,rejected));assert.equal(rejected.visible.size,0);assert.equal(rejected.aborted,true);checks+=3;
 }
 const wrong=sink();await assert.rejects(()=>restoreRecoveryStream([complete],randomBytes(32),wrong));assert.equal(wrong.visible.size,0);checks+=2;
 const limited=sink();await assert.rejects(()=>restoreRecoveryStream([complete],key,limited,{maxTotalBytes:2}));assert.equal(limited.visible.size,0);checks+=2;
 const invalid=[];await assert.rejects(async()=>{for await(const part of sealRecoveryStream([{name:'objects/../escape',bytes:Buffer.from('x')}],key))invalid.push(part)});checks++;
 const mismatch=sink();await assert.rejects(()=>restoreRecoveryStream(sealRecoveryStream([{name:'objects/qa/file',size:100,bytes:Buffer.from('short')}],key),key,mismatch));assert.equal(mismatch.visible.size,0);checks+=2;
 console.log(`PASS: ${checks} streaming recovery checks; 80 MiB synthetic source in 64 KiB authenticated frames, hash/size verification, transactional staging and wrong-key/tamper/truncation/trailing/path/limit failures. Sink is local test staging, not external disaster recovery.`);
}finally{key.fill(0)}
