import assert from 'node:assert/strict';
import {CRTEffect} from '../dist/crt-effect.js';
let uploads=0,copies=0,draws=0,scheduled=0;
globalThis.requestAnimationFrame=()=>scheduled++;
const sourceCanvas={width:1920,height:1080};
globalThis.window={room:{renderer:{domElement:sourceCanvas},renderVersion:1}};
const effect=Object.assign(Object.create(CRTEffect.prototype),{
 enabled:true,sourceCanvas,copyCanvas:{width:1920,height:1080},copyCtx:{drawImage(){copies++;}},options:{},uniforms:{},
 gl:new Proxy({texImage2D(){uploads++;},drawElements(){draws++;}},{get:(target,key)=>target[key]??(()=>{})})
});
for(let i=0;i<90;i++)effect.render();
assert.equal(uploads,1);assert.equal(copies,1);assert.equal(draws,90);assert.equal(scheduled,90);
window.room.renderVersion++;effect.render();assert.equal(uploads,2);
sourceCanvas.width=1280;effect.render();assert.equal(uploads,3);
effect.enabled=false;effect.render();assert.equal(draws,92);effect.enabled=true;effect.render();assert.equal(uploads,3);assert.equal(draws,93);
window.room.renderer.domElement={};effect.render();effect.render();assert.equal(uploads,5);
console.log(JSON.stringify({result:'pass',idleCRTFrames:90,sceneUploads:1,animatedDraws:90,checks:['new scene frame','source resize','toggle','unversioned source fallback']}));
