import fs from 'node:fs';
import path from 'node:path';
// Model/source conversion inputs stay in Git, outside the deployed static output.
const output='public';fs.rmSync(output,{recursive:true,force:true});fs.mkdirSync(output);
const sourceFiles=new Set(['room.bundle.gz','room.json','scene.json','geometry-pack.json','conversion-results.json']);
fs.cpSync('dist',output,{recursive:true,filter(file){const name=path.basename(file);return !sourceFiles.has(name)&&!name.endsWith('.drc')&&!name.endsWith('.f64')&&!name.endsWith('.geometry.json');}});
for(const name of ['tree','wip','about','favicons','.well-known','robots.txt','sitemap.xml','humans.txt'])if(fs.existsSync(name))fs.cpSync(name,path.join(output,name),{recursive:true});
console.log('Built optimized room and existing auxiliary routes in public/');
