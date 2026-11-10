import {createCipheriv,createDecipheriv,createHash,randomBytes,hkdfSync} from 'node:crypto';
import {checkKey,validName} from './backup.js';
const MAGIC=Buffer.from('PELLUM-RECOVERY-STREAM-V2\0'),CHUNK=65536;
const TYPE={header:1,entry:2,data:3,endEntry:4,endArchive:5};
const invalid=()=>Object.assign(Error('RECOVERY_STREAM_INVALID'),{code:'RECOVERY_STREAM_INVALID'});
const json=value=>Buffer.from(JSON.stringify(value));
function limits(options){const cap={maxTotalBytes:options.maxTotalBytes??16*1024**3,maxEntries:options.maxEntries??100000};if(!Number.isSafeInteger(cap.maxTotalBytes)||cap.maxTotalBytes<0||cap.maxTotalBytes>16*1024**3||!Number.isInteger(cap.maxEntries)||cap.maxEntries<1||cap.maxEntries>100000)throw invalid();return cap}
function checkEntry(entry){
 if(!entry||!validName(entry.name)||entry.size!==null&&(!Number.isSafeInteger(entry.size)||entry.size<0)||entry.sha256!==null&&!/^[a-f0-9]{64}$/.test(entry.sha256))throw invalid();
}
function nonce(prefix,index){const result=Buffer.alloc(12);prefix.copy(result,0,0,8);result.writeUInt32BE(index,8);return result}
function associatedData(prefix,index,type,length){const metadata=Buffer.alloc(9);metadata.writeUInt32BE(index);metadata[4]=type;metadata.writeUInt32BE(length,5);return Buffer.concat([MAGIC,prefix,metadata])}
function encryptFrame(prefix,index,type,bytes,key){
 if(index>=0xffffffff||bytes.length>CHUNK)throw invalid();
 const cipher=createCipheriv('aes-256-gcm',key,nonce(prefix,index));cipher.setAAD(associatedData(prefix,index,type,bytes.length));
 const encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]),header=Buffer.alloc(5);header.writeUInt32BE(encrypted.length);header[4]=type;
 return Buffer.concat([header,encrypted,cipher.getAuthTag()]);
}
// Every frame has a distinct nonce and authenticated position/type/length.
// Sources are streamed: a whole database or archive is never buffered here.
export async function* sealRecoveryStream(entries,key,options={}){
 checkKey(key);const cap=limits(options),prefix=randomBytes(32),names=new Set();let index=0,total=0,count=0;
 const createdAt=options.createdAt||new Date().toISOString();if(!Number.isFinite(Date.parse(createdAt)))throw invalid();
 const frameKey=Buffer.from(hkdfSync('sha256',key,prefix,MAGIC,32));
 const frame=(type,bytes)=>encryptFrame(prefix,index++,type,bytes,frameKey);
 try{
 yield Buffer.concat([MAGIC,prefix]);yield frame(TYPE.header,json({version:2,createdAt}));
 for await(const source of entries){
  const entry={name:source.name,size:source.size??null,sha256:source.sha256??null};checkEntry(entry);
  if(names.has(entry.name.toLowerCase())||++count>cap.maxEntries)throw invalid();names.add(entry.name.toLowerCase());
  yield frame(TYPE.entry,json(entry));const hash=createHash('sha256');let size=0;
  const input=Buffer.isBuffer(source.bytes)?[source.bytes]:source.chunks;if(!input)throw invalid();
  for await(const value of input){
   if(!(value instanceof Uint8Array))throw invalid();
   for(let offset=0;offset<value.length;offset+=CHUNK){
    const bytes=Buffer.from(value.buffer,value.byteOffset+offset,Math.min(CHUNK,value.length-offset));size+=bytes.length;total+=bytes.length;
    if(total>cap.maxTotalBytes||entry.size!==null&&size>entry.size)throw invalid();
    hash.update(bytes);yield frame(TYPE.data,bytes);
   }
  }
  const digest=hash.digest('hex');if(entry.size!==null&&entry.size!==size||entry.sha256!==null&&entry.sha256!==digest)throw invalid();
  yield frame(TYPE.endEntry,json({size,sha256:digest}));
 }
 yield frame(TYPE.endArchive,json({files:count,totalBytes:total}));
 }finally{frameKey.fill(0)}
}
class Reader{
 constructor(source){this.iterator=source[Symbol.asyncIterator]?.()||source[Symbol.iterator]?.();if(!this.iterator)throw invalid();this.chunk=Buffer.alloc(0);this.offset=0;this.finished=false}
 async read(size){
  const output=Buffer.alloc(size);let written=0;
  while(written<size){
   if(this.offset===this.chunk.length){const next=await this.iterator.next();if(next.done){this.finished=true;throw invalid()}if(!(next.value instanceof Uint8Array))throw invalid();this.chunk=Buffer.from(next.value.buffer,next.value.byteOffset,next.value.byteLength);this.offset=0;if(!this.chunk.length)continue}
   const length=Math.min(size-written,this.chunk.length-this.offset);this.chunk.copy(output,written,this.offset,this.offset+length);this.offset+=length;written+=length;
  }
  return output;
 }
 async atEnd(){if(this.offset<this.chunk.length)return false;for(;;){const next=await this.iterator.next();if(next.done){this.finished=true;return true}if(!(next.value instanceof Uint8Array))throw invalid();if(next.value.length)return false}}
 async close(){if(!this.finished)await this.iterator.return?.()}
}
// The sink is transactional: all writes must remain in private staging until
// commitArchive. Abort isolates staging. No direct restore-to-production API.
export async function restoreRecoveryStream(source,key,sink,options={}){
 checkKey(key);for(const name of ['beginArchive','beginEntry','writeChunk','endEntry','commitArchive','abortArchive'])if(typeof sink?.[name]!=='function')throw invalid();
 const reader=new Reader(source),cap=limits(options),names=new Set();let index=0,total=0,count=0,current=null,headerSeen=false,frameKey=null;
 try{
  if(!(await reader.read(MAGIC.length)).equals(MAGIC))throw invalid();const prefix=await reader.read(32);frameKey=Buffer.from(hkdfSync('sha256',key,prefix,MAGIC,32));
  for(;;){
   options.signal?.throwIfAborted();const outer=await reader.read(5),length=outer.readUInt32BE(),type=outer[4];
   if(length>CHUNK||index>=0xffffffff)throw invalid();const encrypted=await reader.read(length),tag=await reader.read(16);
   const decipher=createDecipheriv('aes-256-gcm',frameKey,nonce(prefix,index));decipher.setAAD(associatedData(prefix,index++,type,length));decipher.setAuthTag(tag);
   // Nothing reaches the sink before authentication of this frame succeeds.
   const bytes=Buffer.concat([decipher.update(encrypted),decipher.final()]);
   if(type===TYPE.header){
    if(headerSeen||index!==1||bytes.length>4096)throw invalid();const header=JSON.parse(bytes.toString());if(header.version!==2||!Number.isFinite(Date.parse(header.createdAt)))throw invalid();headerSeen=true;await sink.beginArchive(header);
   }else if(!headerSeen)throw invalid();
   else if(type===TYPE.entry){
    if(current||bytes.length>4096)throw invalid();const entry=JSON.parse(bytes.toString());checkEntry(entry);
    if(names.has(entry.name.toLowerCase())||++count>cap.maxEntries)throw invalid();names.add(entry.name.toLowerCase());current={entry,size:0,hash:createHash('sha256')};await sink.beginEntry(entry);
   }else if(type===TYPE.data){
    if(!current)throw invalid();current.size+=bytes.length;total+=bytes.length;
    if(total>cap.maxTotalBytes||current.entry.size!==null&&current.size>current.entry.size)throw invalid();current.hash.update(bytes);await sink.writeChunk(bytes);
   }else if(type===TYPE.endEntry){
    if(!current||bytes.length>4096)throw invalid();const end=JSON.parse(bytes.toString()),digest=current.hash.digest('hex');
    if(end.size!==current.size||end.sha256!==digest||current.entry.size!==null&&end.size!==current.entry.size||current.entry.sha256!==null&&digest!==current.entry.sha256)throw invalid();
    await sink.endEntry({size:current.size,sha256:digest});current=null;
   }else if(type===TYPE.endArchive){
    if(current||bytes.length>4096)throw invalid();const end=JSON.parse(bytes.toString());if(end.files!==count||end.totalBytes!==total||!await reader.atEnd())throw invalid();
    await sink.commitArchive(end);return end;
   }else throw invalid();
  }
 }catch{try{await sink.abortArchive()}catch{}throw invalid()}finally{frameKey?.fill(0);try{await reader.close()}catch{}}
}
