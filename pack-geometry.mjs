import {predictWords} from './dist/buffer-codec.js';
import {createHash} from 'node:crypto';
import fs from 'node:fs';import path from 'node:path';import {gzipSync,gunzipSync,constants} from 'node:zlib';
const base=path.dirname(new URL(import.meta.url).pathname),dist=path.join(base,'dist'),doc=JSON.parse(fs.readFileSync(path.join(dist,'room.json'))),names=new Set(),pending=[...doc.scene.objects];
while(pending.length){const n=pending.pop();pending.push(...n.children);if(n.data._geometry)names.add(n.data._geometry);}
const geometries=Object.fromEntries([...names].sort().map(file=>[file,JSON.parse(fs.readFileSync(path.join(dist,file)))])),files=new Set();
for(const g of Object.values(geometries)){for(const a of Object.values(g.attributes))files.add(a.file);for(const list of Object.values(g.morphAttributes??{}))for(const a of list)files.add(a.file);if(g.index)files.add(g.index.file);}
const widths=new Map(),strides=new Map();for(const g of Object.values(geometries)){const attributes=[...Object.values(g.attributes),...Object.values(g.morphAttributes??{}).flat(),...(g.index?[g.index]:[])];for(const a of attributes){strides.set(a.file,a.itemSize??1);widths.set(a.file,/64/.test(a.type)?8:/32/.test(a.type)?4:/16/.test(a.type)?2:1);}}
const {decodeRoomBundle}=await import('./dist/geometry-pack.js');const existingFile=path.join(dist,'room.bundle.gz');let existing;if(fs.existsSync(existingFile)){const b=gunzipSync(fs.readFileSync(existingFile));existing=decodeRoomBundle(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}
const buffers={},parts=[];let byteLength=0;
for(const file of [...files].sort()){const alignment=(8-byteLength%8)%8;if(alignment){parts.push(Buffer.alloc(alignment));byteLength+=alignment;}const bytes=fs.existsSync(path.join(dist,file))?fs.readFileSync(path.join(dist,file)):Buffer.from(existing.array({file},Uint8Array));const width=widths.get(file)??1,words=bytes.length/width;const shuffle=input=>{const output=Buffer.allocUnsafe(input.length);for(let lane=0;lane<width;lane++)for(let word=0;word<words;word++)output[lane*words+word]=input[word*width+lane];return output;};
 let best={bytes:shuffle(bytes),predictor:null};let size=gzipSync(best.bytes,{level:6}).length;
 if(width===4&&bytes.length>256)for(const mode of ['xor','delta'])for(const stride of new Set([1,strides.get(file)])){
  const candidate=Buffer.from(bytes);predictWords(new Uint32Array(candidate.buffer,candidate.byteOffset,words),{mode,stride},true);const shuffled=shuffle(candidate),candidateSize=gzipSync(shuffled,{level:6}).length;
  if(candidateSize<size){size=candidateSize;best={bytes:shuffled,predictor:{mode,stride}};}
 }
 buffers[file]={offset:byteLength,byteLength:bytes.length,shuffleWidth:width,...(best.predictor?{predictor:best.predictor}:{})};parts.push(best.bytes);byteLength+=bytes.length;}
const packed=Buffer.concat(parts),manifest={version:3,archive:'room.bundle.gz',byteLength,geometries,buffers};
const documentBytes=fs.readFileSync(path.join(dist,'room.json')),metadata=Buffer.from(JSON.stringify(manifest)),header=Buffer.alloc(16);header.write('ROOM');header.writeUInt32LE(3,4);header.writeUInt32LE(documentBytes.length,8);header.writeUInt32LE(metadata.length,12);
const prefixLength=16+documentBytes.length+metadata.length,padding=Buffer.alloc((8-prefixLength%8)%8),bundle=Buffer.concat([header,documentBytes,metadata,padding,packed]);
const candidates=[constants.Z_DEFAULT_STRATEGY,constants.Z_FILTERED].map(strategy=>({strategy,bytes:gzipSync(bundle,{level:9,strategy})})),best=candidates.reduce((a,b)=>a.bytes.length<=b.bytes.length?a:b);
fs.writeFileSync(path.join(dist,'geometry-pack.json'),metadata);fs.writeFileSync(path.join(dist,manifest.archive),best.bytes);
const bundleURL='./room.bundle.gz?v='+createHash('sha256').update(best.bytes).digest('hex').slice(0,20);fs.writeFileSync(path.join(dist,'bundle-version.js'),'export const bundleURL='+JSON.stringify(bundleURL)+';\n');
const htmlFile=path.join(dist,'index.html');let html=fs.readFileSync(htmlFile,'utf8');
html=html.replace(/<link rel="preload" as="fetch" href="[^"]*room\.bundle\.gz[^"]*" crossorigin>/g,'').replace(/<!-- room bundle preload -->[\s\S]*?<!-- \/room bundle preload -->/g,'');
const preload=`<!-- room bundle preload --><script>(()=>{const url=${JSON.stringify(bundleURL)};function preload(){const link=document.createElement('link');link.rel='preload';link.as='fetch';link.href=url;link.crossOrigin='anonymous';link.fetchPriority='high';document.head.appendChild(link);}if(globalThis.caches)caches.open('room-models-v1').then(cache=>cache.match(url)).then(hit=>{if(!hit)preload();}).catch(preload);else preload();})();</script><!-- /room bundle preload -->`;
html=html.replace('</head>',preload+'</head>');fs.writeFileSync(htmlFile,html);
fs.rmSync(path.join(dist,'geometry-pack.bin.gz'),{force:true});
console.log(JSON.stringify({geometryFiles:names.size,binaryFiles:files.size,requestsBefore:names.size+files.size+1,requestsAfter:1,uncompressedGeometryBytes:byteLength,uncompressedBundleBytes:bundle.length,compressedBytes:best.bytes.length,strategy:best.strategy}));
