import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const read=f=>readFile('standalone/dist/'+f,'utf8');
assert.match(await read('index.html'),/name="robots" content="noindex, nofollow"/);
const sitemap=await read('sitemap.xml');assert.equal((sitemap.match(/<loc>/g)||[]).length,1);assert.match(sitemap,/<loc>https:\/\/usepellum.vercel.app\/conheca\/<\/loc>/);
assert.match(await read('robots.txt'),/Sitemap: https:\/\/usepellum.vercel.app\/sitemap.xml/);
const landing=await read('conheca/index.html');assert.ok(!landing.includes('noindex'));assert.match(landing,/property="og:image"/);assert.match(landing,/rel="canonical"/);
assert.match(await read('404.html'),/Página não encontrada/);
console.log('PASS: public landing discoverable; application noindex; sitemap excludes private routes; OG and 404 present.');
