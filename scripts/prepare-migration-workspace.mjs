// Local SQL workspace only. Copies historical SQL bytes under the versions
// already recorded remotely; never edits source migrations or repairs history.
import {readFile,readdir,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const aliases={'20261029004713':'20261029004749','20261103000000':'20261103010054'};
const reviewed=JSON.parse(await readFile('security/release-preparation-evidence-2026-11-10.json','utf8'));
await mkdir('outputs',{recursive:true});const root=await mkdtemp(path.resolve('outputs/migration-release-'));await mkdir(path.join(root,'supabase/migrations'),{recursive:true});
await writeFile(path.join(root,'supabase/config.toml'),'project_id = "pellum_release"\n',{flag:'wx'});
const files=(await readdir('supabase/migrations')).filter(name=>name.endsWith('.sql')).sort(),manifest=[];
for(const file of files){const bytes=await readFile('supabase/migrations/'+file),sha256=createHash('sha256').update(bytes).digest('hex');const pending=reviewed.pending.find(item=>item.file===file);if(pending&&pending.sha256!==sha256)throw Error('Reviewed migration changed');const version=file.slice(0,14),target=(aliases[version]||version)+file.slice(14);await writeFile(path.join(root,'supabase/migrations',target),bytes,{flag:'wx'});manifest.push({source:file,workspace:target,sha256,pending:!!pending})}
if(manifest.filter(file=>file.pending).length!==10)throw Error('Unexpected pending migration set');
await writeFile(path.join(root,'manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),project:'iddiiisimjaquhxhskcn',sourcesUnchanged:true,remoteRepairPerformed:false,files:manifest},null,2)+'\n',{flag:'wx'});
await writeFile('.codex/migration-workspace.json',JSON.stringify({root})+'\n');console.log('SQL workspace prepared: '+root+'; no remote writes.');
