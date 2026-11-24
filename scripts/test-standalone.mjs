import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tests=readdirSync(path.join(root,'tests')).filter(f=>f.endsWith('.mjs')).sort();
let failures=0;
for(const file of [...tests.map(f=>'tests/'+f),'security/assert-deployment.mjs']){
 const result=spawnSync(process.execPath,[file],{cwd:root,encoding:'utf8'});
 console.log((result.status===0?'PASS ':'FAIL ')+file);
 if(result.status!==0){failures++;console.error(result.stderr||result.stdout||String(result.error));}
}
console.log(tests.length+' scripts JavaScript; '+failures+' falhas. SQL e serviços remotos não executados.');
process.exitCode=failures?1:0;
