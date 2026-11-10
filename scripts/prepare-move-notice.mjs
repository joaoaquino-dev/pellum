// Local artifact only. No deployment, redirect setting or backend change.
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {renderMoveNotice} from '../standalone/src/move-notice.js';
import {resolvePublicOrigin} from '../standalone/src/public-origin.js';
const destination=process.env.PELLUM_NEW_PUBLIC_ORIGIN;
const html=renderMoveNotice(destination);await mkdir('outputs',{recursive:true});const directory=await mkdtemp(path.resolve('outputs/site-move-'));
await writeFile(path.join(directory,'index.html'),html,{flag:'wx'});
await writeFile(path.join(directory,'_headers'),"/*\n  Cache-Control: no-store\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'\n",{flag:'wx'});
await writeFile(path.join(directory,'vercel.json'),JSON.stringify({framework:null,buildCommand:null,installCommand:null,outputDirectory:'.',rewrites:[{source:'/(.*)',destination:'/index.html'}],headers:[{source:'/(.*)',headers:[{key:'Cache-Control',value:'no-store'},{key:'Referrer-Policy',value:'no-referrer'},{key:'Content-Security-Policy',value:"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}]}]},null,2)+'\n',{flag:'wx'});
await writeFile(path.join(directory,'notice-manifest.json'),JSON.stringify({preparedAt:new Date().toISOString(),destination:resolvePublicOrigin(destination),published:false,requireBeforePublication:['New site ready and checked','Supabase redirect origins configured','Database update verified','Existing users can sign in on new origin'],doesNotForward:['query','hash','sessions','recovery tokens']},null,2)+'\n',{flag:'wx'});
console.log('Aviso preparado localmente: '+directory+'. Nada foi publicado.');
