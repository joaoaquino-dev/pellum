import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
// Bounded local recovery package. It accepts bytes supplied by the caller and
// has no remote database connection, upload, delete or restore-to-production API.
const MAGIC=Buffer.from('PELLUM-RECOVERY-V1\0'),MAX_BYTES=64*1024*1024,MAX_PACKAGE=100*1024*1024;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const invalid=()=>Object.assign(Error('BACKUP_INVALID'),{code:'BACKUP_INVALID'});
function checkKey(key){if(!Buffer.isBuffer(key)||key.length!==32)throw Object.assign(Error('BACKUP_KEY_REQUIRED'),{code:'BACKUP_KEY_REQUIRED'})}
function validName(name){return typeof name==='string'&&name.length<=300&&/^(database|objects|config|migrations)\/[A-Za-z0-9_.\/-]+$/.test(name)&&!name.split('/').some(part=>!part||part==='.'||part==='..')}
export function sealRecoveryPackage(entries,key,{createdAt=new Date().toISOString()}={}){
 checkKey(key);if(!Array.isArray(entries)||!entries.length||entries.length>10000)throw invalid();let total=0;const names=new Set();
 const files=entries.map(({name,bytes})=>{
  if(!validName(name)||names.has(name)||!Buffer.isBuffer(bytes)||(total+=bytes.length)>MAX_BYTES)throw invalid();names.add(name);
  return {name,size:bytes.length,sha256:hash(bytes),data:bytes.toString('base64')};
 });
 const plaintext=Buffer.from(JSON.stringify({version:1,createdAt,files}));if(plaintext.length>MAX_PACKAGE)throw invalid();
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(MAGIC);
 try{return Buffer.concat([MAGIC,nonce,cipher.update(plaintext),cipher.final(),cipher.getAuthTag()])}finally{plaintext.fill(0)}
}
export function openRecoveryPackage(packageBytes,key){
 checkKey(key);
 if(!Buffer.isBuffer(packageBytes)||packageBytes.length<MAGIC.length+28||packageBytes.length>MAX_PACKAGE+100||!packageBytes.subarray(0,MAGIC.length).equals(MAGIC))throw invalid();
 let plaintext;
 try{
  const decipher=createDecipheriv('aes-256-gcm',key,packageBytes.subarray(MAGIC.length,MAGIC.length+12));decipher.setAAD(MAGIC);decipher.setAuthTag(packageBytes.subarray(-16));
  // Authenticate the entire package before parsing paths or exposing any bytes.
  plaintext=Buffer.concat([decipher.update(packageBytes.subarray(MAGIC.length+12,-16)),decipher.final()]);
  const manifest=JSON.parse(plaintext.toString('utf8'));if(manifest.version!==1||!Array.isArray(manifest.files)||!manifest.files.length||manifest.files.length>10000||!Number.isFinite(Date.parse(manifest.createdAt)))throw invalid();
  let total=0;const names=new Set(),files=manifest.files.map(file=>{
   if(!validName(file.name)||names.has(file.name)||typeof file.data!=='string'||file.data.length%4!==0||/[^A-Za-z0-9+/=]/.test(file.data))throw invalid();
   const bytes=Buffer.from(file.data,'base64');if(bytes.toString('base64')!==file.data||bytes.length!==file.size||hash(bytes)!==file.sha256||(total+=bytes.length)>MAX_BYTES)throw invalid();names.add(file.name);
   return {name:file.name,bytes,sha256:file.sha256};
  });
  return {createdAt:manifest.createdAt,files};
 }catch{throw invalid()}finally{plaintext?.fill(0)}
}
