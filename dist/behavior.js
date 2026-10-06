export const clone=v=>structuredClone(v);
export function equalJSON(a,b){
 if(Object.is(a,b))return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const keys=Object.keys(a);if(keys.length!==Object.keys(b).length)return false;for(const k of keys)if(!Object.hasOwn(b,k)||!equalJSON(a[k],b[k]))return false;return true;
}
export function merge(base,patch){
 if(patch===null||typeof patch!=='object')return clone(patch);
 if(Array.isArray(base)&&!Array.isArray(patch))return base.map((v,i)=>merge(v,patch[v?.id]??patch[i]??{}));
 if(Array.isArray(patch))return clone(patch);
 const result=base&&typeof base==='object'?clone(base):{};for(const [k,v]of Object.entries(patch))result[k]=v&&typeof v==='object'?merge(result[k],v):v;return result;
}
const bezierSamples=new Map();
export function bezier(x,a,b,c,d){
 if(a===b&&c===d)return x;
 const B=3*c-6*a,C=3*a;
 const value=(t,p,q)=>((1-3*q+3*p)*t+(3*q-6*p))*t*t+3*p*t;
 const slope=t=>3*(1-3*c+3*a)*t*t+2*B*t+C;
 const sampleKey=a+":"+c;let samples=bezierSamples.get(sampleKey);if(!samples){samples=new Float32Array(11);for(let i=0;i<11;i++)samples[i]=value(i*.1,a,c);if(bezierSamples.size>=64)bezierSamples.clear();bezierSamples.set(sampleKey,samples);}
 let interval=0,index=1;for(;index!==10&&samples[index]<=x;index++)interval+=.1;index--;
 let t=interval+.1*(x-samples[index])/(samples[index+1]-samples[index]);const initialSlope=slope(t);
 if(initialSlope>=.001){for(let i=0;i<4;i++){const derivative=slope(t);if(derivative===0)break;t-=(value(t,a,c)-x)/derivative;}}
 else if(initialSlope!==0){let lo=interval,hi=interval+.1;for(let i=0;i<10;i++){t=lo+(hi-lo)/2;const error=value(t,a,c)-x;if(Math.abs(error)<=1e-7)break;if(error>0)hi=t;else lo=t;}}
 return value(t,b,d);
}
export function easing(t,spec){
 const codes=[[0,0,1,1],[.25,.1,.25,1],[.42,0,1,1],[0,0,.58,1],[.42,0,.58,1]];
 if(t<=0)return 0;if(t>=1)return 1;
 const p=spec.easing===5?[...(spec.control1??[.42,0]),...(spec.control2??[.58,1])]:codes[spec.easing]??codes[0];return bezier(t,...p);
}
function interpolate(a,b,t){
 if(typeof b==='number'&&typeof a==='number')return a+(b-a)*t;
 if(Array.isArray(b))return b.map((v,i)=>interpolate(a?.[i],v,t));
 if(b&&typeof b==='object'){const x=Array.isArray(a)?new Array(a.length):{};if(a&&typeof a==='object')for(const k of Object.keys(a))if(!Object.hasOwn(b,k))x[k]=clone(a[k]);for(const [k,v]of Object.entries(b))x[k]=interpolate(a?.[k],v,t);return x;}
 return t<1?a:b;
}
export class Behavior{
 constructor(host){this.host=host;this.now=0;this.jobs=[];this.animations=new Map();this.flags=new Map();this.log=[];}
 schedule(ms,fn,owner){this.jobs.push({at:this.now+Math.max(0,ms),fn,owner});}
 cancelPage(page){this.jobs=this.jobs.filter(j=>!j.owner||this.host.pageOf(j.owner)!==page);for(const [key,a]of this.animations)if(this.host.pageOf(a.target)===page)this.animations.delete(key);}
 event(owner,event,direction){const e=event.data??event;if(e.disabled)return;for(const a of [...(e.actions??[])].sort((a,b)=>a.fi-b.fi))this.action(owner,a,direction);}
 action(owner,entry,direction){
 const a=entry.data??entry,key=owner.id+':'+(entry.id??JSON.stringify(a));this.log.push({time:this.now,type:a.type,owner:owner.id});
 switch(a.type){
 case 'Transition':{
  const target=this.host.resolve(a.object,owner);if(!target){this.host.warn('Missing transition target '+a.object);return;}
  const status=this.flags.get(key)??{played:false,forward:false};if(a.runMode==='Once'&&status.played)return;
  const forward=direction!==undefined?direction:a.runMode==='Toggle'?!status.forward:true;status.forward=forward;status.played=true;this.flags.set(key,status);
  const tweens=[...(a.tweens??[])].sort((a,b)=>a.fi-b.fi).map(t=>t.data);if(tweens.length<2)return;
  const snapshot=state=>state?merge(target.base,(target.base.states??[]).find(s=>s.id===state)?.data??{}):clone(target.base);
  const frames=tweens.map(t=>({spec:t,value:snapshot(t.state)}));
  this.animations.set(target.id,{key,target,frames,index:forward?1:frames.length-1,reverse:!forward,start:this.now+(a.delay??0)+(tweens[0]?.delayDirection==='start-once'?(tweens[0].delay??0):0),from:clone(target.current),initialized:false,defer:(a.delay??0)+(tweens[0]?.delayDirection==='start-once'?(tweens[0].delay??0):0)>0,iteration:0,action:a});break;
 }
 case 'SwitchCamera':this.schedule((a.delay??0)*1000,()=>this.host.switchCamera(a,owner,this),owner);break;
 case 'SceneTransition':this.schedule((a.delay??0)*1000,()=>this.host.selectPage(a.target,a),owner);break;
 case 'Destroy':this.schedule((a.delay??0)*1000,()=>{for(const id of a.objects??[])this.host.destroy(this.host.resolve(id,owner));},owner);break;
 case 'Link':if(direction!==false)this.host.link(a);break;
 case 'Audio':case 'Video':if(direction!==false)this.schedule((a.delay??0),()=>this.host.media(a,owner),owner);break;
 default:this.host.warn('Unknown action '+a.type);
 }
 }
 tick(now){
 this.now=now;let count=0;while(count++<1000){const idx=this.jobs.findIndex(j=>j.at<=now);if(idx<0)break;const job=this.jobs.splice(idx,1)[0];job.fn();}
 for(const [id,a]of this.animations){
  if(this.host.isDestroyed(a.target)){this.animations.delete(id);continue;}
  if(!a.initialized){if(now<a.start)continue;if(a.defer){a.defer=false;continue;}a.start=now;a.initialized=true;}
  let guard=0;
  while(guard++<20){const frame=a.frames[a.index],spec=frame.spec,delay=spec.delay??0,start=a.start+delay;if(now<start)break;
   const duration=Math.max(.0001,spec.duration??0),t=Math.min(1,(now-start)/duration),dest=a.reverse?a.frames[a.index-1].value:frame.value;
   const eased=easing(t,spec);this.host.apply(a.target,interpolate(a.from,dest,eased),{from:a.from,to:dest,t:eased});
   if(t<1)break;
   const repetitions=spec.repeat??0;
   if(repetitions===-1||a.iteration<repetitions){a.iteration++;a.start=start+duration;if(spec.direction==='pingpong'||spec.direction==='pingpong-rewind'){a.reverse=!a.reverse;}else a.from=clone(a.frames[a.index-1].value);break;}
   a.iteration=0;a.start=start+duration;a.from=clone(dest);
   if(a.reverse){a.index--;if(a.index<1){this.animations.delete(id);break;}}
   else{a.index++;if(a.index>=a.frames.length){if(a.action.repeat===-1){a.index=1;a.from=clone(a.frames[0].value);}else{this.animations.delete(id);break;}}}
  }
 }
 }
}
