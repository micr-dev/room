import fs from 'node:fs';
import {createGraph} from '../dist/graph.js';
import {resolveAsset} from '../dist/materials.js';
import {centeredTextureGLSL} from '../dist/texture-sampling.js';
const doc=JSON.parse(fs.readFileSync(new URL('../dist/room.json',import.meta.url))),graph=createGraph(doc),cases=[],seen=new Set();
for(const record of graph.records.values())for(const material of record.current.materials??[record.current.material])for(const layer of material?.layers??[]){const x=layer.data;if(!['texture','video'].includes(x.type)||x.visible===false)continue;const file=resolveAsset(x.texture?.image??x.texture?.video,doc.shared);if(!file)continue;const key=JSON.stringify([file,x.texture,x.crop,x.projection]);if(seen.has(key))continue;seen.add(key);cases.push({object:record.current.name,layer:layer.id,type:x.type,file,texture:x.texture,crop:!!x.crop,projection:x.projection??0,glsl:centeredTextureGLSL(x.projection===2?'vec2(0.5+atan(normalize(localPosition).z,normalize(localPosition).x)/6.283,0.5+asin(clamp(normalize(localPosition).y,-1.0,1.0))/3.1415)':'rawUV',x.texture),geometry:record.current.geometry?.type,compiled:record.current._geometry});}
fs.writeFileSync(new URL('./texture-cases.json',import.meta.url),JSON.stringify(cases,null,2));console.log(cases.length+' distinct visible texture/video cases');
