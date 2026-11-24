import {createCipheriv,createDecipheriv,randomBytes,scrypt} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt),FORMAT='PELLUM-PORTABLE-KEY-V1';
const options={N:131072,r:8,p:1,maxmem:256*1024*1024};
const invalid=()=>Object.assign(Error('PORTABLE_KEY_INVALID'),{code:'PORTABLE_KEY_INVALID'});
function passwordBytes(password){if(typeof password!=='string'||password.length<20||password.length>1024)throw invalid();return Buffer.from(password,'utf8')}
function digest(value){if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw invalid();return value}
function bytes(value,length){if(typeof value!=='string'||value.length>128)throw invalid();const result=Buffer.from(value,'base64');if(result.length!==length||result.toString('base64')!==value)throw invalid();return result}
const aad=hash=>Buffer.from(FORMAT+'\n'+hash,'ascii');
export async function protectPortableKey(key,password,archiveSha256){
 if(!Buffer.isBuffer(key)||key.length!==32)throw invalid();digest(archiveSha256);
 const pass=passwordBytes(password),salt=randomBytes(16),iv=randomBytes(12);let derived;
 try{
  derived=await derive(pass,salt,32,options);const cipher=createCipheriv('aes-256-gcm',derived,iv);cipher.setAAD(aad(archiveSha256));
  const ciphertext=Buffer.concat([cipher.update(key),cipher.final()]);
  return JSON.stringify({format:FORMAT,archiveSha256,kdf:{name:'scrypt',N:options.N,r:8,p:1,salt:salt.toString('base64')},cipher:{name:'aes-256-gcm',iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),key:ciphertext.toString('base64')}});
 }finally{pass.fill(0);derived?.fill(0)}
}
export async function unlockPortableKey(serialized,password,archiveSha256){
 let pass,derived;
 try{
  digest(archiveSha256);if(typeof serialized!=='string'||Buffer.byteLength(serialized)>4096)throw invalid();const item=JSON.parse(serialized);
  if(item?.format!==FORMAT||item.archiveSha256!==archiveSha256||item.kdf?.name!=='scrypt'||item.kdf.N!==options.N||item.kdf.r!==8||item.kdf.p!==1||item.cipher?.name!=='aes-256-gcm')throw invalid();
  const salt=bytes(item.kdf.salt,16),iv=bytes(item.cipher.iv,12),tag=bytes(item.cipher.tag,16),encrypted=bytes(item.cipher.key,32);pass=passwordBytes(password);derived=await derive(pass,salt,32,options);
  const decipher=createDecipheriv('aes-256-gcm',derived,iv);decipher.setAAD(aad(archiveSha256));decipher.setAuthTag(tag);const pending=decipher.update(encrypted);
  try{const final=decipher.final();return Buffer.concat([pending,final])}finally{pending.fill(0)}
 }catch{throw invalid()}finally{pass?.fill(0);derived?.fill(0)}
}
