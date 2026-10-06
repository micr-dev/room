import {Application} from './adapter.js';
import {loadTiming} from './load-timing.js';
const output=document.getElementById('load-time');
function update(){
 output.title=Object.entries(loadTiming.values).map(([name,ms])=>`${name}: ${(ms/1000).toFixed(2)}s`).join(" · ");
 const {firstFrame,textures}=loadTiming.values;
 output.textContent=firstFrame===undefined?`${loadTiming.values.bundle===undefined?'Downloading':'Preparing'} · ${(performance.now()/1000).toFixed(2)}s`:
  `First frame ${(firstFrame/1000).toFixed(2)}s · ${textures===undefined?'textures loading':`textures ${(textures/1000).toFixed(2)}s`}`;
}
loadTiming.listeners.add(update);
const timer=setInterval(update,100);
loadTiming.listeners.add(({firstFrame,textures})=>{if(firstFrame!==undefined&&textures!==undefined)clearInterval(timer);});
new Application(document.getElementById('canvas3d')).load().then(()=>{
 import('./crt-integration.js').then(({initCRTEffect})=>initCRTEffect(document.getElementById('canvas3d'))).catch(console.error);
}).catch(error=>{clearInterval(timer);output.textContent='Load failed: '+error.message;console.error(error);});
update();
