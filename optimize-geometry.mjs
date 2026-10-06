import {gzipSync} from 'node:zlib';
import * as T from './dist/vendor/three.module.js';
// Match complete vertex records by bytes, including all morph targets. Triangle
// order, groups, float bits and discontinuities remain unchanged.
export function optimizeGeometry(geometry){
 const attributes=Object.values(geometry.attributes),morphs=Object.values(geometry.morphAttributes).flat(),all=[...attributes,...morphs],count=geometry.attributes.position.count;
 if(!count||all.some(a=>a.isInterleavedBufferAttribute||a.count!==count))return null;
 const views=all.map(a=>Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength)),widths=all.map(a=>a.array.BYTES_PER_ELEMENT*a.itemSize),stride=widths.reduce((a,b)=>a+b,0),row=Buffer.allocUnsafe(stride),map=new Map(),representatives=[],order=geometry.index?.array??Uint32Array.from({length:count},(_,i)=>i),remapped=new Uint32Array(order.length);
 const used=new Uint8Array(count),lookup=new Uint32Array(count);for(const vertex of order)used[vertex]=1;
 for(let vertex=0;vertex<count;vertex++){
  if(!used[vertex])continue;let offset=0;for(let a=0;a<views.length;a++){views[a].copy(row,offset,vertex*widths[a],(vertex+1)*widths[a]);offset+=widths[a];}
  const key=row.toString('base64');let index=map.get(key);if(index===undefined){index=representatives.length;map.set(key,index);representatives.push(vertex);}lookup[vertex]=index;
 }
 for(let k=0;k<order.length;k++)remapped[k]=lookup[order[k]];
 const Index=representatives.length<=65535?Uint16Array:Uint32Array,bytesBefore=count*stride+(geometry.index?.array.byteLength??0),bytesAfter=representatives.length*stride+remapped.length*Index.BYTES_PER_ELEMENT;
 if(bytesAfter>=bytesBefore)return {verticesBefore:count,verticesAfter:count,bytesBefore,bytesAfter:bytesBefore,changed:false};
 const compact=a=>{const array=new a.array.constructor(representatives.length*a.itemSize);for(let k=0;k<representatives.length;k++)array.set(a.array.subarray(representatives[k]*a.itemSize,(representatives[k]+1)*a.itemSize),k*a.itemSize);const result=new T.BufferAttribute(array,a.itemSize,a.normalized);result.name=a.name;result.usage=a.usage;result.gpuType=a.gpuType;return result;};
 const replacements=all.map(compact),indexArray=new Index(remapped);
 const compressedBefore=views.reduce((sum,bytes)=>sum+gzipSync(bytes,{level:9}).length,0)+(geometry.index?gzipSync(Buffer.from(geometry.index.array.buffer,geometry.index.array.byteOffset,geometry.index.array.byteLength),{level:9}).length:0);
 const compressedAfter=replacements.reduce((sum,a)=>sum+gzipSync(Buffer.from(a.array.buffer),{level:9}).length,0)+gzipSync(Buffer.from(indexArray.buffer),{level:9}).length;
 if(compressedAfter>compressedBefore){
  if(geometry.index&&geometry.index.array instanceof Uint32Array&&geometry.index.array.every(i=>i<65535)){
   const narrowed=new Uint16Array(geometry.index.array);geometry.setIndex(new T.BufferAttribute(narrowed,1));return {verticesBefore:count,verticesAfter:count,bytesBefore,bytesAfter:count*stride+narrowed.byteLength,changed:true,compressionPreserved:true};
  }
  return {verticesBefore:count,verticesAfter:count,bytesBefore,bytesAfter:bytesBefore,changed:false,compressionPreserved:true};
 }
 let cursor=0;for(const [name]of Object.entries(geometry.attributes))geometry.setAttribute(name,replacements[cursor++]);
 for(const [name,list]of Object.entries(geometry.morphAttributes))geometry.morphAttributes[name]=list.map(()=>replacements[cursor++]);
 geometry.setIndex(new T.BufferAttribute(indexArray,1));
 return {verticesBefore:count,verticesAfter:representatives.length,bytesBefore,bytesAfter,changed:true};
}
