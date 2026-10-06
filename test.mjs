import {objectColor} from './dist/outline.js';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {decodeRoomBundle} from './dist/geometry-pack.js';
import {centeredTextureUV} from './dist/texture-sampling.js';
assert.deepEqual(centeredTextureUV([.2,.3],{repeat:[1,-1]}),[.2,.7]);
assert.deepEqual(centeredTextureUV([.5,.5],{offset:[0,.17]}),[.5,.585]);
const rotatedUV=centeredTextureUV([.2,.3],{repeat:[2,3],offset:[.1,.2],rotation:90});assert(Math.abs(rotatedUV[0]-1)<1e-10&&Math.abs(rotatedUV[1]+.05)<1e-10);
import {blendChannel,pixelationGranularity,sobelMagnitude} from './dist/parity-math.js';
for(const [mode,expected] of [[0,.5],[1,.18],[2,.52],[3,.26],['1',.18]])assert(Math.abs(blendChannel(.2,.8,.5,mode)-expected)<1e-10);
assert.deepEqual([0,1,2,3,15].map(pixelationGranularity),[0,2,2,4,16]);
assert.equal(sobelMagnitude([3,0,0],[0,4,0]),5);
import assert from 'node:assert/strict';
import path from 'node:path';
import * as T from './dist/vendor/three.module.js';
import {Behavior,easing,merge,clone} from './dist/behavior.js';
import {createGraph,applyTransform} from './dist/graph.js';
import {resolveAsset,makeMaterial,materialTransparent} from './dist/materials.js';
import {Post} from './dist/post.js';
const base=path.dirname(new URL(import.meta.url).pathname),doc=JSON.parse(fs.readFileSync(path.join(base,'dist/room.json'))),graph=createGraph(doc);
const rawBundle=gunzipSync(fs.readFileSync(path.join(base,'dist/room.bundle.gz'))),packed=decodeRoomBundle(rawBundle.buffer.slice(rawBundle.byteOffset,rawBundle.byteOffset+rawBundle.byteLength));
const results={objects:graph.records.size,meshes:0,events:0,actions:{},missingTargets:[],missingStates:[],missingMedia:[],missingAssets:[],matrixFailures:[],shaderFailures:[],checks:[]};
assert.equal(graph.pages.length,2);assert.equal(graph.warnings.length,0);
assert.equal(graph.records.get('03cda255-d064-40e3-b046-74eee0ca807d').templateOnly,true);
assert.equal(graph.records.get('284b31c6-9e42-4275-8f49-8f14e923a894').templateOnly,false);
assert.equal(materialTransparent(graph.records.get('284b31c6-9e42-4275-8f49-8f14e923a894').current.materials[0],doc.shared),false);
assert.equal(materialTransparent(graph.records.get('03cda255-d064-40e3-b046-74eee0ca807d').current.materials[0],doc.shared),true);
assert.equal(graph.records.get('12e883cb-6472-4ff6-b2ce-495be71a28d9/684aa5bb-9992-49eb-9cb7-69bedd9139ba').templateOnly,false);
const sourceTree=[...doc.scene.objects];let stored=0;while(sourceTree.length){const n=sourceTree.pop();sourceTree.push(...n.children);stored++;}assert.equal(stored,783);
for(const record of graph.records.values()){
 const d=record.current;if(!record.object.matrixWorld.elements.every(Number.isFinite))results.matrixFailures.push(record.id);
 if(d._geometry){results.meshes++;assert(fs.existsSync(path.join(base,'dist',d._geometry)));if(d.geometry.type==='RectangleGeometry'&&!d.geometry.depth){const spec=JSON.parse(fs.readFileSync(path.join(base,'dist',d._geometry)));const uv=packed.array(spec.attributes.uv,Float32Array);assert(uv.every(v=>v>=-1e-6&&v<=1+1e-6),d.name+' UV out of range');}}
 for(const event of d.events??[]){results.events++;for(const action of event.data.actions??[]){const a=action.data;results.actions[a.type]=(results.actions[a.type]??0)+1;
  if(a.type==='Transition'){
   const target=graph.resolve(a.object,record);if(!target)results.missingTargets.push({owner:record.id,target:a.object});
   else for(const tween of a.tweens??[])if(tween.data.state&&!(target.base.states??[]).some(s=>s.id===tween.data.state))results.missingStates.push({target:target.id,state:tween.data.state});
  }
  if(a.type==='SwitchCamera'&&!graph.resolve(a.targetCamera,record)?.object.isCamera)results.missingTargets.push({camera:a.targetCamera});
  if(a.type==='SceneTransition'&&!graph.records.has(a.target))results.missingTargets.push({page:a.target});
  if(a.type==='Audio'&&!resolveAsset(a.audio,doc.shared))results.missingMedia.push({audio:action.id});
 }}
}
function findAssets(value){if(!value||typeof value!=='object')return;for(const [k,v]of Object.entries(value)){if(['$asset','$array','$draco'].includes(k)&&!fs.existsSync(path.join(base,'dist',v)))results.missingAssets.push(v);else if(typeof v==='object')findAssets(v);}}
findAssets(doc);
const identity=new T.Matrix4(),hidden=new T.Matrix4().makeTranslation(3,4,5),obj=new T.Object3D();applyTransform(obj,{position:[10,20,30],rotation:[0,0,0],scale:[1,1,1],hiddenMatrix:hidden.toArray()});obj.updateMatrixWorld(true);assert.deepEqual(obj.getWorldPosition(new T.Vector3()).toArray(),[13,24,35]);results.checks.push('hiddenMatrix × local transform');
assert(Math.abs(easing(.5,{easing:4})-.5)<1e-4);assert(Math.abs(easing(.25,{easing:0})-.25)<1e-4);results.checks.push('Spline easing mappings');results.checks.push('Raw centered UV: vertical flip, half-offset, rotation after nonuniform repeat');results.checks.push('Exact blend mode vectors, odd-to-even pixelation, Euclidean Sobel magnitude');
assert.deepEqual(merge([{id:'layer',data:{alpha:1,color:{r:1,g:1,b:1}}}],{layer:{data:{alpha:.5}}})[0].data,{alpha:.5,color:{r:1,g:1,b:1}});results.checks.push('ID-based layer overrides');
const target={id:'target',base:{position:[0,0,0],scale:[1,1,1],states:[{id:'state',data:{position:[10,0,0]}}]},current:{position:[0,0,0],scale:[1,1,1]}};
const calls=[],host={resolve:()=>target,apply:(r,d)=>r.current=d,warn:m=>{throw Error(m);},isDestroyed:()=>false,pageOf:()=>null,media:a=>calls.push(a.type),link:()=>calls.push('Link'),destroy:()=>calls.push('Destroy'),selectPage:()=>calls.push('SceneTransition'),switchCamera:()=>calls.push('SwitchCamera')};
let behavior=new Behavior(host),owner={id:'owner'};const transition={id:'transition',data:{type:'Transition',object:'target',runMode:'Toggle',tweens:[{fi:0,data:{state:null,duration:1000}},{fi:1,data:{state:'state',duration:300,easing:4,repeat:0}}]}};
behavior.action(owner,transition,true);behavior.tick(0);assert.equal(target.current.position[0],0);behavior.tick(150);assert(Math.abs(target.current.position[0]-5)<1e-3);behavior.tick(300);assert.equal(target.current.position[0],10);behavior.action(owner,transition,false);behavior.tick(300);behavior.tick(600);assert.equal(target.current.position[0],0);results.checks.push('Hover forward/reverse and first tween as initial state');
for(const type of ['Audio','Video','Link','Destroy','SceneTransition','SwitchCamera']){behavior.action(owner,{id:type,data:{type,objects:['target'],delay:1}});}assert.deepEqual(calls,['Link']);behavior.tick(601);assert.deepEqual(calls.sort(),['Audio','Link','Video'].sort());behavior.tick(1599);assert.equal(calls.length,3);behavior.tick(1600);assert.deepEqual(calls.sort(),['Audio','Destroy','Link','SceneTransition','SwitchCamera','Video'].sort());results.checks.push('All seven action handlers; millisecond media delays, second scene/camera/destroy delays, immediate links');
const renders=[],mockRenderer={autoClear:true,getContext:()=>({COLOR:0,clearBufferfv(){}}),setClearColor(){},clear(){},getPixelRatio:()=>2,setRenderTarget:target=>{mockRenderer.target=target;},render:(scene,camera)=>renders.push({target:mockRenderer.target,visible:scene.children.filter(x=>x.isMesh&&x.visible).map(x=>x.name)})},post=new Post(mockRenderer);post.resize(640,360);
const testScene=new T.Scene(),outlined=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial()),plain=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());outlined.name='outline';plain.name='plain';outlined.material.userData.outline={outlineWidth:2};testScene.add(outlined,plain);post.render(testScene,new T.OrthographicCamera(-1,1,1,-1,-100000,100000),{postprocessing:{pixelation:{enabled:true,granularity:3}}});assert.deepEqual(renders[0].visible,['outline']);assert.deepEqual(renders[1].visible,['outline','plain']);assert.equal(post.material.uniforms.pixelation.value,4);assert.equal(outlined.material.isMeshBasicMaterial,true);assert.equal(plain.visible,true);assert.equal(post.normalMaterial.uniforms.depthContrast.value,20);assert.equal(testScene.overrideMaterial,null);post.normalMaterial.onBeforeRender(null,null,null,null,outlined);assert.deepEqual(post.normalMaterial.uniforms.randomColor.value.toArray(),objectColor(outlined.uuid).toArray());assert.equal(post.normalMaterial.uniformsNeedUpdate,true);results.checks.push('Outline prepass visibility, material restoration, camera depth range and pixelation');
const shaderTemplate=T.ShaderLib.phong;let samples=0;const shaderPrograms=new Map();
// Material construction without network: intercept TextureLoader with in-memory textures.
const previous=T.TextureLoader.prototype.load;T.TextureLoader.prototype.load=()=>new T.Texture();
globalThis.document={createElement:()=>({play(){return Promise.resolve();},addEventListener(){},removeEventListener(){}})};
for(const r of graph.records.values())for(const mat of r.current.materials??[r.current.material])if(mat){
 const m=makeMaterial(mat,r.current,doc.shared,new T.LoadingManager(),new Map(),post);const template=m.isMeshPhysicalMaterial?T.ShaderLib.physical:shaderTemplate,shader={uniforms:cloneUniforms(template.uniforms),vertexShader:template.vertexShader,fragmentShader:template.fragmentShader};m.onBeforeCompile(shader);
 const programKey=m.type+':'+m.customProgramCacheKey(),sourceCode=shader.vertexShader+'\n'+shader.fragmentShader;if(shaderPrograms.has(programKey))assert.equal(sourceCode,shaderPrograms.get(programKey),'Program key collision');else shaderPrograms.set(programKey,sourceCode);
 assert(shader.fragmentShader.includes('roomOutline(float width'));assert(shader.vertexShader.includes('roomRawUV=uv;'));assert(!shader.fragmentShader.includes('vMapUv'));if(m.map){assert.deepEqual(m.map.repeat.toArray(),[1,1]);assert.deepEqual(m.map.offset.toArray(),[0,0]);assert.equal(m.map.rotation,0);}
 if(!shader.vertexShader.includes('roomWorldPosition=')||!shader.fragmentShader.includes('vec3 roomColor'))results.shaderFailures.push(r.id);
 for(const name of Object.keys(shader.uniforms).filter(k=>k.startsWith('roomU')))assert(shader.fragmentShader.includes(name));samples++;m.dispose();
}
T.TextureLoader.prototype.load=previous;results.checks.push(samples+' material shader assemblies and collision-free shared program keys');
function cloneUniforms(u){return Object.fromEntries(Object.entries(u).map(([k,v])=>[k,{value:v.value}]));}
const conversion=JSON.parse(fs.readFileSync(path.join(base,'conversion-results.json')));assert.equal(conversion.converted,693);assert.equal(conversion.failures.length,0);
assert.equal(results.matrixFailures.length,0);assert.equal(results.missingAssets.length,0);assert.equal(results.shaderFailures.length,0);
assert.equal(results.missingTargets.length,0);assert.equal(results.missingStates.length,0);assert.equal(results.missingMedia.length,0);
let dispatched=0;
for(const r of graph.records.values())for(const event of r.current.events??[]){
 const copies=new Map(),resolveCopy=(id,owner)=>{const original=graph.resolve(id,owner);if(!original)return null;if(!copies.has(original.id))copies.set(original.id,{...original,current:clone(original.base)});return copies.get(original.id);};
 const realHost={...host,resolve:resolveCopy,apply:(r,d)=>{r.current=d;for(const field of ['position','rotation','scale'])if(d[field])assert(d[field].every(Number.isFinite));},media:()=>{},link:()=>{},destroy:()=>{},selectPage:()=>{},switchCamera:()=>{},warn:m=>{throw Error(m);}};
 const e=new Behavior(realHost);e.event(r,event,true);e.tick(0);e.tick(500);e.tick(10000);e.event(r,event,false);e.tick(20000);dispatched+=event.data.actions?.length??0;
}
results.checks.push(dispatched+' real action bindings dispatched with external effects mocked');
results.limitations=['This suite checks data, scheduler, transforms and shader assembly. Native GPU and reference comparisons are reported separately in qa/.','Full visual and timing parity with Spline requires the separate reference render and interaction results; these unit checks alone do not establish it.'];
fs.writeFileSync(path.join(base,'test-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
