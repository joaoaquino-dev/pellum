import {readFile,readdir} from 'node:fs/promises';import assert from 'node:assert/strict';
const v=JSON.parse(await readFile('vercel.json','utf8'));assert.equal(v.framework,null);assert.equal(v.outputDirectory,'standalone/dist');assert.match(v.installCommand,/npm ci --prefix standalone --workspaces=false/);assert.match(v.buildCommand,/npm --prefix standalone run build/);
const files=await readdir('standalone/dist',{recursive:true});assert.deepEqual([...files].sort(),['_headers','apple-touch-icon.png','favicon-32.png','favicon.svg','index.html','main.js','runtime.js','style.css'].sort());for(const f of files){assert.equal(/(^|\/)(?:\.env|node_modules|\.git|\.wrangler|\.openai)/.test(f),false);assert.equal(/\.map$/.test(f),false)}
assert.equal(files.includes('server/index.js'),false);assert.equal(files.some(f=>f.startsWith('api/')),false);
console.log('PASS: production target is static standalone only; no legacy server, environment files, source maps or dependency tree in output.');
