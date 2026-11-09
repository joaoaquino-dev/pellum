// Local-only acceptance runner. No project linking, remote SQL or deployment.
import {spawnSync} from 'node:child_process';
import {readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const env={...process.env,PELLUM_ENV:'development',PELLUM_MEDIA_ENABLED:'false'};
for(const key of ['VERCEL_ENV','PELLUM_SUPABASE_URL','PELLUM_SUPABASE_PUBLISHABLE_KEY','PELLUM_STAGING_PROJECT_REF'])delete env[key];
const results=[];
function run(label,command,args){
 const started=Date.now(),r=spawnSync(command,args,{env,encoding:'utf8',maxBuffer:5*1024*1024});
 if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
 results.push({label,passed:r.status===0,durationMs:Date.now()-started});
 if(r.status!==0)process.exitCode=1;
 return r.status===0;
}
if(!run('build',process.execPath,['standalone/build.mjs']))process.exit(1);
const tests=(await readdir('tests')).filter(name=>name.endsWith('.mjs')).sort();
for(const file of tests)run(file,process.execPath,['tests/'+file]);
for(const file of ['public/aura/app.js','public/aura/features.js','standalone/src/main.js','standalone/src/runtime-clinical.js','standalone/src/clinical-media.js','api/clinical-media.mjs'])run('syntax '+file,process.execPath,['--check',file]);
const npmCli=process.env.npm_execpath||path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
for(const prefix of ['standalone','clinical-server','tests/clinical'])run('audit '+prefix,process.execPath,[npmCli,'--prefix',prefix,'audit',...(prefix==='tests/clinical'?[]:['--omit=dev'])]);
const report={node:process.version,platform:process.platform,architecture:process.arch,completedAt:new Date().toISOString(),testFiles:tests.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results,scope:'Local synthetic fixtures only. Auth, scanner and Storage services are not remotely validated.'};
await mkdir('outputs',{recursive:true});await writeFile('outputs/phase2-verification.json',JSON.stringify(report,null,2)+'\n');
console.log(`Verification: ${tests.length} test files; ${report.failed} failed checks. Report: outputs/phase2-verification.json`);
