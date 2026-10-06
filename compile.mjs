import {optimizeGeometry} from './optimize-geometry.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import * as T from './dist/vendor/three.module.js';
import {flatRectangle,roundedBox} from './dist/primitive-geometry.js';
import {rectangleGeometry,textGeometry} from './dist/parametric-geometry.js';
const require=createRequire(import.meta.url);
const draco=await require('./tools/draco/draco3d.js').createDecoderModule({});
const opentype=require('./tools/opentype/opentype.js');
const base=path.dirname(new URL(import.meta.url).pathname),dist=path.join(base,'dist');
const doc=JSON.parse(fs.readFileSync(process.argv[2]??path.join(dist,'scene.json'))),cache=new Map(),fonts=new Map();
const geometryOptimization=[];
const diagnostics={converted:0,types:{},failures:[],approximate:['Generic features beyond this room fixture remain unverified','Browser media and pointer QA remain separate from native GPU tests']};
function array(v){if(v?.$array){const b=fs.readFileSync(path.join(dist,v.$array));return new Float64Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}return v??[];}
function blob(raw,ext){const b=Buffer.from(raw.buffer,raw.byteOffset,raw.byteLength),name=crypto.createHash('sha256').update(b).digest('hex')+'.'+ext;fs.writeFileSync(path.join(dist,'assets',name),b);return 'assets/'+name;}
function dracoGeometry(url){
 const b=fs.readFileSync(path.join(dist,url)),buffer=new draco.DecoderBuffer(),decoder=new draco.Decoder(),mesh=new draco.Mesh();buffer.Init(new Int8Array(b),b.length);
 const status=decoder.DecodeBufferToMesh(buffer,mesh);if(!status.ok())throw Error(status.error_msg());const g=new T.BufferGeometry();
 for(const [semantic,name] of [[draco.POSITION,'position'],[draco.NORMAL,'normal'],[draco.TEX_COORD,'uv'],[draco.COLOR,'color']]){
  const id=decoder.GetAttributeId(mesh,semantic);if(id<0)continue;const a=decoder.GetAttribute(mesh,id),values=new draco.DracoFloat32Array();decoder.GetAttributeFloatForAllPoints(mesh,a,values);
  g.setAttribute(name,new T.BufferAttribute(Float32Array.from({length:values.size()},(_,i)=>values.GetValue(i)),a.num_components()));draco.destroy(values);
 }
 const face=new draco.DracoInt32Array(),indices=new Uint32Array(mesh.num_faces()*3);
 for(let i=0;i<mesh.num_faces();i++){decoder.GetFaceFromMesh(mesh,i,face);for(let j=0;j<3;j++)indices[i*3+j]=face.GetValue(j);}g.setIndex(new T.BufferAttribute(indices,1));
 for(const x of [face,status,mesh,decoder,buffer])draco.destroy(x);return g;
}
function buffered(gd){const g=new T.BufferGeometry();for(const [name,a] of Object.entries(gd.attributes??{})){
 const C=TYPED[a.type]??Float32Array;g.setAttribute(name,new T.BufferAttribute(new C(array(a.array)),a.itemSize,a.normalized??false));}
 for(const [name,attributes]of Object.entries(gd.morphAttributes??{}))g.morphAttributes[name]=attributes.map(a=>{const attr=new T.BufferAttribute(new (TYPED[a.type]??Float32Array)(array(a.array)),a.itemSize,a.normalized??false);attr.name=a.name??'';return attr;});g.morphTargetsRelative=gd.morphTargetsRelative??false;
 if(gd.index)g.setIndex(new T.BufferAttribute(new (TYPED[gd.index.type]??Uint32Array)(array(gd.index.array)),1));
 for(const group of gd.groups??[])g.addGroup(group.start,group.count,group.materialIndex);return g;}
const TYPED={Float32Array,Float64Array,Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array};
function text(g){
 const fontInfo=doc.shared.fonts[g.font],fontPath=fontInfo?.data?.$asset??(g.font==='Arya_regular'?'assets/arya.ttf':null);if(!fontPath)throw Error('Font unavailable: '+g.font);
 let font=fonts.get(g.font);if(!font){const b=fs.readFileSync(path.join(dist,fontPath));font=opentype.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));fonts.set(g.font,font);}return textGeometry(g,font);
}
function convert(g){
 const key=crypto.createHash('sha256').update(JSON.stringify(g)).digest('hex');if(cache.has(key))return cache.get(key);let geometry;
 if(g.data?.draco?.$draco)geometry=dracoGeometry(g.data.draco.$draco);
 else if(g.type==='NonParametricGeometry'||g.type==='SubdivGeometry')geometry=buffered(g.data);
 else if(g.type==='CubeGeometry')geometry=roundedBox(g);
 else if(g.type==='RectangleGeometry')geometry=rectangleGeometry(g);
 else if(g.type==='TextGeometry')geometry=text(g);
 else throw Error('Unknown geometry '+g.type);
 if(!geometry.attributes.position)throw Error('Missing position attribute');
 if(g.type==='NonParametricGeometry'){geometry.computeBoundingBox();const size=geometry.boundingBox.getSize(new T.Vector3());geometry.scale(size.x?(g.width??size.x)/size.x:1,size.y?(g.height??size.y)/size.y:1,size.z?(g.depth??size.z)/size.z:1);}
 if(!geometry.attributes.position.array.every(Number.isFinite))throw Error('Non-finite geometry');
 if(geometry.index&&!geometry.index.array.every(i=>i<geometry.attributes.position.count))throw Error('Out-of-range index');
 if(!geometry.attributes.normal)geometry.computeVertexNormals();
 const position=geometry.attributes.position,normal=geometry.attributes.normal,extrude=new Float32Array(position.count*3);
 if(g.type==='RectangleGeometry'&&!g.depth){for(let i=0;i<position.count;i++)extrude.set(new T.Vector3().fromBufferAttribute(position,i).normalize().toArray(),i*3);}
 // Source vector extrusions are indexed: repeated triangle corners must not weight a face twice.
 else{const groups=new Map();for(let i=0;i<position.count;i++){const key=[position.getX(i),position.getY(i),position.getZ(i)].join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}for(const indices of groups.values()){const v=new T.Vector3(),normals=new Map();for(const i of indices){const n=new T.Vector3().fromBufferAttribute(normal,i);normals.set(n.toArray().join(','),n);}const values=(g.type==='RectangleGeometry'||g.type==='TextGeometry')?[...normals.values()]:indices.map(i=>new T.Vector3().fromBufferAttribute(normal,i));for(const n of values)v.add(n);v.divideScalar(values.length);for(const i of indices)extrude.set(v.toArray(),i*3);}}
 geometry.setAttribute('extrudeNormal',new T.BufferAttribute(extrude,3));geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const optimization=optimizeGeometry(geometry);if(optimization)geometryOptimization.push({key,type:g.type,...optimization});
 const spec={attributes:{},groups:geometry.groups,sphere:[geometry.boundingSphere.center.toArray(),geometry.boundingSphere.radius],bounds:geometry.boundingBox.toArray?.()??[geometry.boundingBox.min.toArray(),geometry.boundingBox.max.toArray()]};
 for(const [name,a] of Object.entries(geometry.attributes)){spec.attributes[name]={file:blob(a.array,'buffer'),type:a.array.constructor.name,itemSize:a.itemSize,normalized:a.normalized,count:a.count};}
 spec.morphTargetsRelative=geometry.morphTargetsRelative;spec.morphAttributes={};for(const [name,list]of Object.entries(geometry.morphAttributes))spec.morphAttributes[name]=list.map(a=>({file:blob(a.array,'buffer'),type:a.array.constructor.name,itemSize:a.itemSize,normalized:a.normalized,count:a.count,name:a.name}));
 if(geometry.index)spec.index={file:blob(geometry.index.array,'buffer'),type:geometry.index.array.constructor.name,count:geometry.index.count};
 const filename='assets/'+key+'.geometry.json';fs.writeFileSync(path.join(dist,filename),JSON.stringify(spec));cache.set(key,filename);geometry.dispose();return filename;
}
const pending=[...doc.scene.objects];while(pending.length){const n=pending.pop();pending.push(...n.children);const d=n.data;if(d.geometry){try{d._geometry=convert(d.geometry);diagnostics.converted++;diagnostics.types[d.geometry.type]=(diagnostics.types[d.geometry.type]??0)+1;}catch(e){diagnostics.failures.push({id:n.id,name:d.name,type:d.geometry.type,error:e.message});}}}
fs.writeFileSync(path.join(dist,'room.json'),JSON.stringify(doc));fs.writeFileSync(path.join(base,'conversion-results.json'),JSON.stringify({...diagnostics,uniqueGeometries:cache.size},null,2));console.log(JSON.stringify({...diagnostics,uniqueGeometries:cache.size},null,2));
fs.writeFileSync(path.join(base,'qa/geometry-optimization.json'),JSON.stringify({scope:'Bit-exact full-attribute vertex deduplication and smaller indices; triangle order and all morph targets preserved.',geometries:geometryOptimization},null,2));
if(diagnostics.failures.length)process.exitCode=1;

if(!diagnostics.failures.length){await import('./pack-geometry.mjs');await import('./prune-assets.mjs');}
