import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../clinical-server/package.json',import.meta.url));
const sharp=require('sharp');
import {PDFDocument,PDFName,PDFString} from '../clinical-server/node_modules/pdf-lib/cjs/index.js';
import {processClinicalFile,detectFile,sha256} from '../clinical-server/files.js';
const scan=async()=>({clean:true,engine:'explicit-test-double'});let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
const jpeg=await sharp({create:{width:32,height:24,channels:3,background:'#345e4d'}}).jpeg().withExif({IFD0:{Artist:'Synthetic QA',ImageDescription:'Synthetic private metadata'}}).toBuffer();
const output=await processClinicalFile(jpeg,{name:'ficticia.jpg',mime:'image/jpeg',scan});
eq(output.original.equals(jpeg),true);eq(output.evidence.originalSha256,sha256(jpeg));eq(output.evidence.width,32);eq((await sharp(output.display).metadata()).exif,undefined);eq((await sharp(output.display).metadata()).icc,undefined);
// Deterministic synthetic texture: compare against the previous 95-quality
// presentation encoder. This is a size regression, not clinical validation.
const pixels=Buffer.alloc(1024*768*3);let seed=17;
for(let y=0;y<768;y++)for(let x=0;x<1024;x++){seed=(seed*1664525+1013904223)>>>0;const i=(y*1024+x)*3,n=(seed>>>27)-16;pixels[i]=Math.max(0,Math.min(255,90+x/12+n));pixels[i+1]=Math.max(0,Math.min(255,80+y/12+n));pixels[i+2]=Math.max(0,Math.min(255,100+(x+y)/24+n))}
const textured=await sharp(pixels,{raw:{width:1024,height:768,channels:3}}).jpeg({quality:98,chromaSubsampling:'4:4:4'}).toBuffer();
const previous=await sharp(textured).jpeg({quality:95,chromaSubsampling:'4:4:4'}).toBuffer();
const optimized=await processClinicalFile(textured,{name:'textura-ficticia.jpg',mime:'image/jpeg',scan});
eq(optimized.display.length<previous.length,true);eq(optimized.original.equals(textured),true);eq(optimized.evidence.width,1024);eq(optimized.evidence.height,768);
console.log(`Synthetic presentation size: previous ${previous.length} bytes; optimized ${optimized.display.length} bytes. Originals unchanged; savings vary by image.`);
for(const [bytes,name,mime] of [[Buffer.from('<svg onload="alert(1)"></svg>'),'fake.jpg','image/jpeg'],[jpeg,'photo.exe','image/jpeg'],[jpeg,'photo.png','image/png'],[Buffer.alloc(4000001),'large.jpg','image/jpeg'],[Buffer.alloc(0),'empty.jpg','image/jpeg']]){assert.throws(()=>detectFile(bytes,name,mime));checks++}
await assert.rejects(()=>processClinicalFile(jpeg,{name:'ficticia.jpg',mime:'image/jpeg'}));checks++;
await assert.rejects(()=>processClinicalFile(jpeg,{name:'ficticia.jpg',mime:'image/jpeg',scan:async()=>({clean:false})}));checks++;
await assert.rejects(()=>processClinicalFile(Buffer.from([255,216,255,0,1,2]),{name:'invalid.jpg',mime:'image/jpeg',scan}));checks++;
const oversized=await sharp({create:{width:6000,height:5000,channels:3,background:'#345e4d'}}).png().toBuffer();await assert.rejects(()=>processClinicalFile(oversized,{name:'pixels.png',mime:'image/png',scan}));checks++;
const pdf=await PDFDocument.create();pdf.addPage([100,100]);const pdfBytes=Buffer.from(await pdf.save());eq((await processClinicalFile(pdfBytes,{name:'ficticio.pdf',mime:'application/pdf',scan})).display,null);
pdf.catalog.set(PDFName.of('OpenAction'),pdf.context.obj({S:PDFName.of('JavaScript'),JS:PDFString.of('alert(1)')}));
await assert.rejects(async()=>processClinicalFile(Buffer.from(await pdf.save()),{name:'active.pdf',mime:'application/pdf',scan}),e=>e.code==='PDF_ACTIVE_CONTENT');checks++;
console.log(`PASS: ${checks} real image/PDF processor checks, preserved original/hash, stripped EXIF, magic/extension/type/size/pixel limits, invalid files and active PDF rejection. Antivirus in these tests is an explicit double.`);
