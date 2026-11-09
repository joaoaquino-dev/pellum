import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {PDFDocument,PDFName} from 'pdf-lib';
import {mediaError} from './files.js';
export async function inspectPdf(bytes){
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL(import.meta.url),{workerData:bytes,resourceLimits:{maxOldGenerationSizeMb:64,maxYoungGenerationSizeMb:16}});
  const timer=setTimeout(()=>{worker.terminate();reject(mediaError('PDF_UNSUPPORTED'))},8000);
  worker.once('message',message=>{clearTimeout(timer);worker.terminate();message.ok?resolve():reject(mediaError(message.code||'FILE_INVALID'))});
  worker.once('error',()=>{clearTimeout(timer);reject(mediaError('FILE_INVALID'))});
  worker.once('exit',code=>{clearTimeout(timer);if(code!==0)reject(mediaError('FILE_INVALID'))});
 });
}
if(!isMainThread){
 try{
  const pdf=await PDFDocument.load(workerData,{ignoreEncryption:false,updateMetadata:false,throwOnInvalidObject:true});
  if(pdf.isEncrypted||pdf.getPageCount()<1||pdf.getPageCount()>100)throw mediaError('PDF_UNSUPPORTED');
  const forbidden=new Set(['JavaScript','JS','OpenAction','AA','Launch','EmbeddedFiles','EmbeddedFile','Filespec','RichMedia','XFA','AcroForm','SubmitForm','ImportData','GoToR','URI']);
  const visited=new Set();let objects=0;
  const inspect=object=>{
   object=pdf.context.lookup(object);if(!object||visited.has(object))return;visited.add(object);
   if(++objects>20000)throw mediaError('PDF_UNSUPPORTED');
   if(object.dict)inspect(object.dict);
   if(typeof object.keys==='function')for(const key of object.keys()){if(forbidden.has(key.decodeText?.()))throw mediaError('PDF_ACTIVE_CONTENT');inspect(object.get(key))}
   if(typeof object.asArray==='function')for(const item of object.asArray())inspect(item);
   if(typeof object.get==='function')for(const key of ['S','Type'])if(forbidden.has(object.get(PDFName.of(key))?.decodeText?.()))throw mediaError('PDF_ACTIVE_CONTENT');
  };
  for(const [,object] of pdf.context.enumerateIndirectObjects())inspect(object);
  parentPort.postMessage({ok:true});
 }catch(error){parentPort.postMessage({ok:false,code:['PDF_UNSUPPORTED','PDF_ACTIVE_CONTENT'].includes(error.code)?error.code:'FILE_INVALID'})}
}
