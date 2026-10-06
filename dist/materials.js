import {optimizedImages,videoPosters} from './asset-map.js';
import * as T from './vendor/three.module.js';
import {centeredTextureGLSL} from './texture-sampling.js';
import {outlineGLSL} from './outline.js';
const cache=new Map();
export function resolveAsset(value,shared){
 if(typeof value==='string'){if(/^(https?:|data:|assets\/)/.test(value))return value;for(const map of [shared.images,shared.videos,shared.audios,shared.lib?.images,shared.lib?.videos])if(map?.[value])return resolveAsset(map[value],shared);return null;}
 if(!value)return null;if(value.$asset)return value.$asset;
 for(const key of ['data','image','video','url','src']){const url=resolveAsset(value[key],shared);if(url)return url;}return null;
}
export function color(value,shared,fallback=0xffffff){if(typeof value==='string'){value=shared.colors?.[value]??shared.lib?.colors?.[value]??(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)?fallback:value);}return Array.isArray(value)?new T.Color(value[0],value[1],value[2]):typeof value==='object'&&value?new T.Color(value.r??1,value.g??1,value.b??1):typeof value==='number'?new T.Color().setHex(value,T.LinearSRGBColorSpace):typeof value==='string'?new T.Color().setStyle(value,T.LinearSRGBColorSpace):new T.Color().setHex(typeof fallback==='number'?fallback:0xffffff,T.LinearSRGBColorSpace);}
function texture(spec,shared,manager){const originalURL=resolveAsset(spec?.image??spec,shared),url=optimizedImages[originalURL]??originalURL;const key=JSON.stringify([url,spec?.wrapping??T.ClampToEdgeWrapping,spec?.minFilter??T.LinearMipmapLinearFilter,spec?.magFilter??T.LinearFilter]);if(cache.has(key))return cache.get(key);
 const t=url?new T.TextureLoader(manager).load(url):new T.DataTexture(new Uint8Array([0,0,0,0]),1,1);if(!url){t.generateMipmaps=true;t.needsUpdate=true;}t.colorSpace=T.NoColorSpace;t.wrapS=t.wrapT=spec?.wrapping??T.ClampToEdgeWrapping;t.minFilter=spec?.minFilter??T.LinearMipmapLinearFilter;t.magFilter=spec?.magFilter??T.LinearFilter;
 // Keep Three's map transform identity; the layer shader owns the entire transform.
 cache.set(key,t);return t;
}
export function materialTransparent(source,shared){
 const variable=v=>typeof v==='string'?Number(shared.variables?.find?.(x=>x.id===v)?.data?.value??shared.lib?.variables?.[v]?.value??100)/100:v;
 const light=source.layers?.find(x=>x.data.type==='light')?.data;
 if(light&&variable(light.alphaOverride)<1)return true;
 let alpha=0;
 for(const {data:x} of source.layers??[]){
  if(x.type!=='displace'&&x.isMask)return true;
  if(x.type==='displace'||!('alpha' in x)||['light','fresnel','texture','matcap','rainbow','outline','pattern'].includes(x.type))continue;
  let a=x.visible?variable(x.alpha):0;
  if((a===1&&x.type==='depth')||x.type==='gradient'){for(const c of x.colors??[])if(c[3]<1){a=c[3];break;}}
  else if(a===1&&x.type==='noise'){const rgba=[x.colorA,x.colorB,x.colorC,x.colorD].map(c=>typeof c==='string'?shared.colors?.[c]:c);const min=Math.min(...rgba.map(c=>Array.isArray(c)?c[3]??1:c?.a??1));if(min<1)a=min;}
  alpha+=(1-alpha)*a;
 }
 return alpha<1;
}
export function makeMaterial(source,data,shared,manager,videoMap,outlineContext){
 if(typeof source==='string')source=shared.materials?.[source]??shared.lib?.materials?.[source];source??={layers:[]};
 const layers=[...(source.layers??[])].sort((a,b)=>b.fi-a.fi).map(x=>x.data);
 const light=layers.find(x=>x.type==='light'),transmission=layers.find(x=>x.type==='transmission'),base=layers.find(x=>x.type==='color');
 const params={color:color(base?.color,shared),side:data.side===1?T.BackSide:data.side===2?T.DoubleSide:T.FrontSide,flatShading:data.flatShading??false,wireframe:data.wireframe??false};
 const material=transmission||light?.category==='physical'?new T.MeshPhysicalMaterial({...params,transmission:transmission?.alpha??0,thickness:transmission?.thickness??0,ior:transmission?.ior??1.5,roughness:Math.min(1,transmission?.roughness??light?.roughness??.5),metalness:light?.metalness??0,reflectivity:light?.reflectivity??.5,emissive:color(light?.emissive,shared,0)}):new T.MeshPhongMaterial({...params,shininess:light?.shininess??5,specular:color(light?.specular,shared,0x333333),emissive:color(light?.emissive,shared,0)});
 const texLayer=layers.find(x=>x.type==='texture');if(texLayer)material.map=texture(texLayer.texture,shared,manager);
 const matcap=layers.find(x=>x.type==='matcap');
 let videoBinding;
 const video=layers.find(x=>x.type==='video');if(video){const url=resolveAsset(video.texture?.video??video.video??video,shared);if(url){const layerId=(source.layers??[]).find(x=>x.data===video)?.id;let el=videoMap.get(layerId);if(!el){el=document.createElement('video');el.preload='none';el.playsInline=true;el.loop=false;el.muted=false;const play=el.play.bind(el);let attached=false;el.play=()=>{if(!attached){attached=true;el.src=url;el.preload='auto';}return play();};videoMap.set(layerId,el);}const tex=new T.VideoTexture(el);tex.colorSpace=T.NoColorSpace;tex.wrapS=tex.wrapT=video.texture?.wrapping??T.ClampToEdgeWrapping;tex.minFilter=T.LinearFilter;tex.magFilter=T.LinearFilter;
  if(videoPosters[url]&&el.readyState<2){material.map=texture({image:videoPosters[url],wrapping:tex.wrapS,minFilter:T.LinearFilter},shared,manager);videoBinding={el,tex,poster:material.map};}else{material.map=tex;if(!videoPosters[url]&&!el.src)el.src=url;}
 }}

 material.opacity=1;material.dithering=true;material.transparent=materialTransparent(source,shared);material.userData={source,outline:layers.find(x=>x.type==='outline'),approximations:[]};
 const compensatedOutline=layers.filter(x=>x.type==='outline'&&x.compensation&&x.visible!==false).at(-1);
 const uniforms={};let code='vec3 roomColor = vec3(0.329411765,0.329411765,0.356862745); float roomAccumAlpha=0.0;\n';let post='';let n=0;
 const uniform=(value,type='vec3')=>{const key='roomU'+n++;uniforms[key]={value};return {name:key,decl:`uniform ${type} ${key};\n`};};let declarations='varying vec3 roomWorldPosition; varying vec3 roomViewNormal; varying vec3 roomWorldNormal; varying vec3 roomLocalPosition; varying vec2 roomRawUV;\n';
 let afterLight=false,firstColor=true;let afterCode='';
 const blend=(expr,x,sampleAlpha='1.0')=>{const alpha=Math.max(0,Math.min(1,x.visible===false?0:x.alpha??1)),mode=Number(x.mode??0);const result=mode===1?`roomColor*(${expr})`:mode===2?`1.0-(1.0-roomColor)*(1.0-(${expr}))`:mode===3?`mix(2.0*roomColor*(${expr}),1.0-2.0*(1.0-roomColor)*(1.0-(${expr})),step(vec3(0.5),roomColor))`:`(${expr})`;let line=`{float layerAlpha=${alpha.toFixed(6)}*(${sampleAlpha});float weight=layerAlpha/clamp(layerAlpha+roomAccumAlpha,0.00001,1.0);`;
 if(firstColor&&!afterLight){line+=`roomColor=(${expr});`;firstColor=false;}else line+=`roomColor=clamp(mix(roomColor,${result},weight),0.0,1.0);`;
 line+='roomAccumAlpha+=(1.0-roomAccumAlpha)*layerAlpha;}\n';if(afterLight)afterCode+=line;else code+=line;};
 const textureUV=x=>centeredTextureGLSL(x.projection===2?'vec2(.5+atan(normalize(roomLocalPosition).z,normalize(roomLocalPosition).x)/(2.0*3.1415),.5+asin(normalize(roomLocalPosition).y)/3.1415)':'roomRawUV',x.texture??{});

 for(const x of layers){
  if(x.type==='light'){afterLight=true;continue;}
  if(x.type==='color'){const u=uniform(color(x.color,shared));declarations+=u.decl;blend(u.name,x);}
  else if(x.type==='texture'){
   const tex=texture(x.texture,shared,manager);if(tex){const u=uniform(tex,'sampler2D');declarations+=u.decl;if(x.projection!==2)material.defines={...(material.defines??{}),USE_MAP:''};const uv=textureUV(x),crop=x.crop?`step(0.0,(${uv}).x)*step(0.0,(${uv}).y)*step((${uv}).x,1.0)*step((${uv}).y,1.0)`:'1.0';let sample=`texture2D(${u.name},${uv})`;if(x.projection===2){const key='roomSpherical'+n++;let prefix=`vec2 ${key}UV=${uv};vec2 ${key}Df=fwidth(${key}UV);if(${key}Df.x>.5)${key}Df.x=0.0;vec2 ${key}Size=vec2(textureSize(${u.name},0));vec4 ${key}=textureLod(${u.name},${key}UV,log2(max(${key}Df.x,${key}Df.y)*min(${key}Size.x,${key}Size.y)));\n`;if(afterLight)afterCode+=prefix;else code+=prefix;sample=key;}blend(`${sample}.rgb`,x,`${sample}.a*(${crop})`);}}

  else if(x.type==='video'){
   if(material.map){const u=uniform(material.map,'sampler2D');declarations+=u.decl;blend(`texture2D(${u.name},${textureUV(x)}).rgb`,x,`texture2D(${u.name},${textureUV(x)}).a`);}
  }
  else if(x.type==='matcap'){
   const tex=texture(x.texture,shared,manager);if(tex){const u=uniform(tex,'sampler2D');declarations+=u.decl;blend(`texture2D(${u.name},vec2(dot(normalize(vec3(normalize(vViewPosition).z,0.0,-normalize(vViewPosition).x)),normal),dot(cross(normalize(vViewPosition),normalize(vec3(normalize(vViewPosition).z,0.0,-normalize(vViewPosition).x))),normal))*.495+.5).rgb`,x);}}
  else if(x.type==='outline'&&outlineContext){const u=uniform(color(x.outlineColor??x.color,shared,0));declarations+=u.decl;const values=[Number(x.outlineWidth??1)*(x.compensation?.5:1),Number(x.outlineThreshold??.35),Number(x.outlineSmoothing??0),Number(x.contourThreshold??0),Number(x.contourWidth??1),Number(x.contourFrequency??10),new T.Vector3(...(x.contourDirection??[0,1,0])),!!x.positionalLines];const args=values.map((value,i)=>{const p=uniform(value,i===6?'vec3':i===7?'bool':'float');declarations+=p.decl;return p.name;});blend(u.name,x,`roomOutline(${args.join(',')})`);}
  else if(x.type==='noise'){
   const a=uniform(color(x.colorA,shared)),b=uniform(color(x.colorB,shared));declarations+=a.decl+b.decl;blend(`mix(${a.name},${b.name},roomNoise(roomWorldPosition*${Number(x.scale??1).toFixed(5)}))`,x);material.userData.approximations.push('noise');}
  else if(x.type==='gradient'){
   const key='roomGradient'+n++,offset=uniform(new T.Vector2(...(x.offset??[0,0])),'vec2'),morph=uniform(new T.Vector2(...(x.morph??[0,0])),'vec2'),angle=uniform(Number(x.angle??0),'float');declarations+=offset.decl+morph.decl+angle.decl;
   let prefix=`vec2 ${key}M=${morph.name}/roomRawUV;vec2 ${key}Rot=vec2(.5+${key}M.x,${key}M.y);vec2 ${key}Dt=vec2(cos(${angle.name})*${key}Rot.x-sin(${angle.name})*${key}Rot.y,sin(${angle.name})*${key}Rot.x+cos(${angle.name})*${key}Rot.y);vec2 ${key}Pt=(roomRawUV-.5+${offset.name})/2.0+${key}Dt/2.0;float ${key}=dot(${key}Pt,${key}Dt)/dot(${key}Dt,${key}Dt);\n`;
   if(x.gradientType===1)prefix+=`${key}=distance((roomRawUV+${morph.name})*3.0,(roomRawUV+${offset.name})+1.0)+${angle.name};\n`;
   if(x.gradientType===2)prefix+=`${key}=fract(${angle.name}/3.141592653589793/-2.0+.5*(-atan(roomRawUV.x+${morph.name}.x-.5+${offset.name}.x,roomRawUV.y+${morph.name}.y-.5+${offset.name}.y)/3.141592653589793));\n`;
   const colors=x.colors??[x.colorA,x.colorB],steps=x.steps??[0,1],stops=colors.map((c,i)=>{const rgb=color(c,shared),u=uniform(new T.Vector4(rgb.r,rgb.g,rgb.b,Array.isArray(c)?c[3]??1:c?.a??1),'vec4'),step=uniform(Number(steps[i]??steps.at(-1)??1),'float');declarations+=u.decl+step.decl;return {color:u.name,step:step.name};});
   prefix+=`vec4 ${key}Color=${stops[0].color};\n`;
   for(let i=1;i<stops.length;i++){const t=`clamp((${key}-${stops[i-1].step})/(${stops[i].step}-${stops[i-1].step}),0.0,1.0)`;prefix+=`${key}Color=mix(${key}Color,${stops[i].color},${x.smooth?`smoothstep(0.0,1.0,${t})`:t});\n`;}
   if(afterLight)afterCode+=prefix;else code+=prefix;blend(`${key}Color.rgb`,x,`${key}Color.a`);}
  else if(x.type==='fresnel'){
   const u=uniform(color(x.color,shared));declarations+=u.decl;blend(`${u.name}*clamp(${Number(x.bias??0).toFixed(4)}+${Number(x.scale??1).toFixed(4)}*pow(1.0-abs(dot(normalize(roomViewNormal),normalize(vViewPosition))),${Number(x.factor??2).toFixed(4)}),0.0,1.0)`,x);}
  else if(x.type==='toon'){
   const colors=x.colors??[{r:0,g:0,b:0},{r:1,g:1,b:1}],steps=x.steps??[.48,.52],a=uniform(color(colors[0],shared)),b=uniform(color(colors.at(-1),shared));declarations+=a.decl+b.decl;
   const key='roomToon'+n++,positioning=x.positioning??0;let prefix=`float ${key}=0.0;\n`;
   if(positioning===0)prefix+=`#if NUM_DIR_LIGHTS > 0\n#pragma unroll_loop_start\nfor(int i=0;i<NUM_DIR_LIGHTS;i++){ ${key}=max(${key},dot((inverse(viewMatrix)*vec4(directionalLights[i].direction,0.0)).xyz,normalize(roomWorldNormal))*.5+.5); }\n#pragma unroll_loop_end\n#endif\n#if NUM_POINT_LIGHTS > 0\n#pragma unroll_loop_start\nfor(int i=0;i<NUM_POINT_LIGHTS;i++){ ${key}=max(${key},dot(normalize((inverse(viewMatrix)*vec4(pointLights[i].position,1.0)).xyz-roomWorldPosition),normalize(roomWorldNormal))*.5+.5); }\n#pragma unroll_loop_end\n#endif\n#if NUM_SPOT_LIGHTS > 0\n#pragma unroll_loop_start\nfor(int i=0;i<NUM_SPOT_LIGHTS;i++){ ${key}=max(${key},dot(normalize((inverse(viewMatrix)*vec4(spotLights[i].position,1.0)).xyz-roomWorldPosition),normalize(roomWorldNormal))*.5+.5); }\n#pragma unroll_loop_end\n#endif\n`;
   else{const source=positioning===2?'cameraPosition':`vec3(${(x.source??[0,0,0]).map(v=>Number(v).toFixed(8)).join(',')})`,offset=`vec3(${(x.offset??[0,0,0]).map(v=>Number(v).toFixed(8)).join(',')})`;prefix+=`${key}=dot(normalize(${source}-${offset}-roomWorldPosition),normalize(roomWorldNormal))*.5+.5;\n`;}
   const stops=colors.map((c,i)=>{const rgb=color(c,shared),u=uniform(new T.Vector4(rgb.r,rgb.g,rgb.b,Array.isArray(c)?c[3]??1:c.a??1),'vec4'),step=uniform(Number(steps[i]??steps.at(-1)??1),'float');declarations+=u.decl+step.decl;return {color:u.name,step:step.name};});
   prefix+=`vec4 ${key}Color=${stops[0].color};\n`;
   for(let i=1;i<stops.length;i++)prefix+=`${key}Color=mix(${key}Color,${stops[i].color},smoothstep(0.0,1.0,clamp((clamp(${key},0.0,1.0)-${stops[i-1].step})/(${stops[i].step}-${stops[i-1].step}),0.0,1.0)));\n`;
   if(afterLight)afterCode+=prefix;else code+=prefix;
   blend(`${key}Color.rgb`,x,`${key}Color.a`);
   if((x.noiseStrength??0)>0||(x.shadowColor?.a??0)>0)material.userData.approximations.push('toon-noise-shadow');
  }
 }

 if(light){const alpha=Number(light.visible===false?0:light.alpha??1).toFixed(8),mode=Number(light.mode??0);const lit=mode===1?'roomColor*outgoingLight':mode===2?'1.0-(1.0-roomColor)*(1.0-outgoingLight)':mode===3?'mix(2.0*roomColor*outgoingLight,1.0-2.0*(1.0-roomColor)*(1.0-outgoingLight),step(vec3(0.5),roomColor))':'outgoingLight';post+=`roomAccumAlpha+=(1.0-roomAccumAlpha)*${alpha}*clamp(length(reflectedLight.directSpecular+reflectedLight.indirectSpecular),0.0,1.0);outgoingLight=clamp(mix(roomColor,${lit},${alpha}),0.0,1.0);\n`;}else post+='outgoingLight=roomColor;\n';
 post+='roomColor=outgoingLight;\n'+afterCode+'outgoingLight=roomColor;diffuseColor.a=roomAccumAlpha;\n';
 material.onBeforeCompile=shader=>{material.userData.compiledShader=shader;shader.uniforms.roomObjectID=material.userData.roomObjectID??{value:0};Object.assign(shader.uniforms,uniforms,outlineContext?.outlineUniforms??{});shader.uniforms.roomPreviousModelView=material.userData.roomPreviousModelView??{value:new T.Matrix4()};shader.uniforms.roomPreviousProjection=material.userData.roomPreviousProjection??{value:new T.Matrix4()};shader.vertexShader='uniform mat4 roomPreviousModelView,roomPreviousProjection;varying vec4 roomCurrentClip,roomPreviousClip;\n'+(outlineContext?'uniform vec2 roomHalton;uniform vec2 roomResolution;\n':'')+(compensatedOutline&&outlineContext?'attribute vec3 extrudeNormal;uniform float roomPixelRatio;\n':'')+'varying vec3 roomWorldPosition; varying vec3 roomViewNormal; varying vec3 roomWorldNormal; varying vec3 roomLocalPosition; varying vec2 roomRawUV;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nroomRawUV=uv;roomLocalPosition=transformed;roomWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz; roomViewNormal=normalize(transformedNormal);roomWorldNormal=normalize((vec4(transformedNormal,0.0)*viewMatrix).xyz);');
 if(compensatedOutline&&outlineContext)shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>\n{vec3 roomClipNormal=mat3(projectionMatrix)*mat3(modelViewMatrix)*extrudeNormal+vec3(1e-7);gl_Position.xy+=normalize(roomClipNormal.xy)/roomResolution*${Number(compensatedOutline.outlineWidth??1).toFixed(8)}*gl_Position.w*roomPixelRatio;} `);
 if(outlineContext)shader.vertexShader=shader.vertexShader.replace('#include <fog_vertex>','#include <fog_vertex>\nroomCurrentClip=projectionMatrix*mvPosition;roomPreviousClip=roomPreviousProjection*roomPreviousModelView*vec4(transformed,1.0);roomPreviousClip.xy+=gl_Position.xy-roomCurrentClip.xy;roomCurrentClip=gl_Position;gl_Position.xy+=roomHalton/roomResolution*gl_Position.w;');
 if(light?.category==='toon'){shader.fragmentShader=shader.fragmentShader.replace('#include <lights_phong_pars_fragment>','#include <gradientmap_pars_fragment>\n'+T.ShaderChunk.lights_phong_pars_fragment.replace('vec3 irradiance = dotNL * directLight.color;','vec3 irradiance = getGradientIrradiance(geometryNormal,directLight.direction)*directLight.color;'));}
 shader.fragmentShader='precision highp sampler2D;\nlayout(location=1) out vec4 roomMotion;varying vec4 roomCurrentClip,roomPreviousClip;\n'+declarations+(outlineContext?outlineGLSL:'')+'float roomNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return fract(sin(dot(i+f,vec3(12.9898,78.233,37.719)))*43758.5453);}\n'+shader.fragmentShader;
 if(texLayer||video)shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','');
 shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n{vec3 roomFaceNormal=normalize(cross(dFdx(vViewPosition),dFdy(vViewPosition)));if(dot(normal,roomFaceNormal)<0.0)normal*=-1.0;}');
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+code+'diffuseColor.rgb=roomColor;');shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',post+'\nif(diffuseColor.a<=0.0)discard;\nroomMotion=vec4(.5*(roomCurrentClip.xy/roomCurrentClip.w-roomPreviousClip.xy/roomPreviousClip.w),0.0,1.0);\n#include <opaque_fragment>');};
 // UUIDs, labels and uniform values do not change compiled shader code.
 // Three.js includes its own material/light/geometry defines in the program key.
 const shaderKey=JSON.stringify([declarations,code,post,!!outlineContext,compensatedOutline?Number(compensatedOutline.outlineWidth??1).toFixed(8):null,light?.category==='toon',!!texLayer||!!video]);
 if(videoBinding){const {el,tex,poster}=videoBinding;const activate=()=>{material.map=tex;for(const uniform of Object.values(uniforms))if(uniform.value===poster)uniform.value=tex;material.needsUpdate=true;};el.addEventListener('loadeddata',activate,{once:true});material.addEventListener('dispose',()=>{el.removeEventListener('loadeddata',activate);tex.dispose();});}
 material.customProgramCacheKey=()=>shaderKey;return material;
}
