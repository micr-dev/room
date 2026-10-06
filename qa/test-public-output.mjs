import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
for(const file of ['index.html','room.compact.gz','tree/index.html','wip/index.html','about/llms.txt','favicons/favicon.ico','robots.txt','sitemap.xml','.well-known/security.txt'])assert.ok(fs.existsSync('public/'+file),file);
for(const file of ['room.bundle.gz','room.json','scene.json','geometry-pack.json','scene.splinecode','runtime.js'])assert.ok(!fs.existsSync('public/'+file),file);
const html=fs.readFileSync('public/index.html','utf8');for(const m of html.matchAll(/(?:src|href)="\.\/([^"#]+)"/g))assert.ok(fs.existsSync('public/'+m[1]),m[1]);
const outputs=JSON.parse(fs.readFileSync('qa/runtime-build.json')).outputs;for(const [name,item] of Object.entries(outputs)){assert.ok(fs.existsSync('public/'+name.replace('dist/','')));for(const i of item.imports)if(!i.external)assert.ok(fs.existsSync('public/'+i.path.replace('dist/','')),i.path);}
assert.ok(!html.includes('scene.splinecode'));assert.ok(!html.includes('id="loader"'));
const vercel=JSON.parse(fs.readFileSync('vercel.json'));assert.equal(vercel.outputDirectory,'public');for(const rule of vercel.redirects.filter(r=>['/','/:match*'].includes(r.source))){const pattern=new RegExp('^(?:'+rule.has[0].value+')$');assert.ok(pattern.test('micr.dev'));assert.ok(pattern.test('www.micr.dev'));assert.ok(!pattern.test('room.micr.dev'));}
console.log('Public entry/modules/model, preserved auxiliary routes, excluded conversion/Spline inputs and apex redirect scope passed.');
