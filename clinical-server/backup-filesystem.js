import {mkdir,mkdtemp,realpath,lstat,open,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {validName} from './backup.js';
const invalid=()=>Object.assign(Error('RECOVERY_DESTINATION_INVALID'),{code:'RECOVERY_DESTINATION_INVALID'});
function inside(base,target){const relative=path.relative(base,target);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)}
async function absent(target){try{await lstat(target);return false}catch(error){if(error.code==='ENOENT')return true;throw error}}
// Operator-selected local destination only. No automatic database import and no
// deletion: an aborted staging directory remains marked ABORTED for review.
export async function createFilesystemRestoreSink({baseDirectory,restoreName}){
 if(typeof baseDirectory!=='string'||typeof restoreName!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(restoreName)||!validName('config/'+restoreName))throw invalid();
 await mkdir(path.resolve(baseDirectory),{recursive:true,mode:0o700});const base=await realpath(baseDirectory),destination=path.resolve(base,restoreName);
 if(!inside(base,destination)||!await absent(destination))throw invalid();
 let staging=null,handle=null,current=null,completed=null;const entries=[];
 return {
  get completedDirectory(){return completed},
  get stagingDirectory(){return staging},
  async beginArchive(header){
   if(staging||!await absent(destination))throw invalid();staging=await mkdtemp(path.join(base,'.pellum-incomplete-'));
   if(!inside(base,staging))throw invalid();
   await writeFile(path.join(staging,'RECOVERY-START.json'),JSON.stringify({phase:'started',createdAt:header.createdAt}),{flag:'wx',mode:0o600});
  },
  async beginEntry(entry){
   if(!staging||handle||!validName(entry.name))throw invalid();const target=path.resolve(staging,entry.name);
   if(!inside(staging,target))throw invalid();const parent=path.dirname(target);await mkdir(parent,{recursive:true,mode:0o700});
   const resolvedParent=await realpath(parent);if(resolvedParent!==staging&&!inside(staging,resolvedParent))throw invalid();
   handle=await open(target,'wx',0o600);current=entry.name;
  },
  async writeChunk(bytes){if(!handle)throw invalid();let offset=0;while(offset<bytes.length){const result=await handle.write(bytes,offset,bytes.length-offset);if(!result.bytesWritten)throw invalid();offset+=result.bytesWritten}},
  async endEntry(summary){if(!handle)throw invalid();await handle.sync();await handle.close();handle=null;entries.push({name:current,...summary});current=null},
  async commitArchive(summary){
   if(!staging||handle||summary.files!==entries.length||!inside(base,staging)||!inside(base,destination)||!await absent(destination))throw invalid();
   await writeFile(path.join(staging,'COMMITTED.json'),JSON.stringify({state:'complete',...summary,entries}),{flag:'wx',mode:0o600});
   // Both fully resolved paths are checked under the explicit operator base
   // immediately before the directory move. Existing destinations are refused.
   await rename(staging,destination);completed=destination;staging=null;
  },
  async abortArchive(){
   if(handle){try{await handle.close()}finally{handle=null}}
   // Preserve incomplete files instead of recursively deleting an inferred path.
   if(staging&&inside(base,staging))await writeFile(path.join(staging,'ABORTED.json'),JSON.stringify({state:'aborted'}),{mode:0o600});
  }
 };
}
