import sharp from 'sharp';
import {inspectPdf} from './pdf-inspect.js';
import {createHash} from 'node:crypto';
export const MAX_FILE_BYTES=4_000_000;
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const mediaError=(code,status=422)=>Object.assign(new Error(code),{code,status});
const formats={jpeg:{mime:'image/jpeg',extensions:['jpg','jpeg']},png:{mime:'image/png',extensions:['png']},webp:{mime:'image/webp',extensions:['webp']},pdf:{mime:'application/pdf',extensions:['pdf']}};
export function detectFile(bytes,name,declaredMime){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>MAX_FILE_BYTES)throw mediaError('FILE_SIZE');
 let format;
 if(bytes.subarray(0,3).equals(Buffer.from([255,216,255])))format='jpeg';
 else if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))format='png';
 else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')format='webp';
 else if(bytes.toString('ascii',0,5)==='%PDF-')format='pdf';
 const spec=formats[format],extension=String(name||'').split('.').at(-1).toLowerCase();
 if(!spec||!spec.extensions.includes(extension)||!['',undefined,'application/octet-stream',spec.mime].includes(declaredMime))throw mediaError('FILE_TYPE');
 return {format,mime:spec.mime};
}
export async function processClinicalFile(bytes,{name,mime,scan}){
 const type=detectFile(bytes,name,mime);
 // No scanner or an inconclusive response is a hard failure. Raw files are not
 // uploaded or made visible while validation is incomplete.
 if(typeof scan!=='function')throw mediaError('SCANNER_UNAVAILABLE',503);
 const evidence=await scan(bytes);
 if(!evidence?.clean||typeof evidence.engine!=='string'||!evidence.engine)throw mediaError('SCANNER_UNAVAILABLE',503);
 let display=null,width=null,height=null;
 try{
  if(type.format==='pdf'){
   await inspectPdf(bytes);
  }else{
   const image=sharp(bytes,{failOn:'warning',limitInputPixels:24_000_000,limitInputChannels:4});
   const metadata=await image.metadata();
   if(metadata.format!==type.format||(metadata.pages||1)>1)throw mediaError('IMAGE_UNSUPPORTED');
   const converted=await image.rotate().resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true}).jpeg({quality:95,chromaSubsampling:'4:4:4'}).timeout({seconds:10}).toBuffer({resolveWithObject:true});
   display=converted.data;width=converted.info.width;height=converted.info.height;
   if(display.length>MAX_FILE_BYTES)throw mediaError('FILE_SIZE');
  }
 }catch(error){if(error.code&&String(error.code).startsWith('PDF_')||error.code==='IMAGE_UNSUPPORTED'||error.code==='FILE_SIZE')throw error;throw mediaError('FILE_INVALID')}
 return {mime:type.mime,original:bytes,display,evidence:{originalSha256:sha256(bytes),displaySha256:display?sha256(display):null,displaySize:display?.length||null,width,height,scanEngine:evidence.engine}};
}
