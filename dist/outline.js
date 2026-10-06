import * as T from './vendor/three.module.js';
export const halton=[[0,-.333334],[-.5,.333334],[.5,-.777778],[-.75,-.111112],[.25,.555556],[-.25,-.555556],[.75,.111112],[-.875,.777778],[.125,-.925926],[-.375,-.259260],[.625,.407408],[-.625,-.703704],[.375,-.037038],[-.125,.629630],[.875,-.481482],[-.9375,.185186]];
export function objectColor(uuid){const seed=parseInt(uuid.replace(/\D/g,''))||0;return new T.Vector3(...[0,10000,20000].map(n=>Math.fround(T.MathUtils.seededRandom(seed+n))));}
export const outlineGLSL=`uniform sampler2D roomNormalTex,roomDepthTex;uniform vec2 roomResolution,roomHalton;uniform float roomPixelRatio,roomOutlineEnabled,roomObjectID;
vec2 roomVogel(int index,float angle){float r=sqrt(float(index)+.5)/3.0;float theta=float(index)*2.399963+angle;return vec2(cos(theta),sin(theta))*r;}
float roomOutline(float width,float threshold,float smoothing,float contourThreshold,float contourWidth,float frequency,vec3 direction,bool positional){
 vec2 uv=gl_FragCoord.xy/roomResolution,texel=1.0/roomResolution;
 float angle=fract(52.9829189*fract(dot(gl_FragCoord.xy+roomHalton,vec2(.06711056,.00583715))))*6.283185307179586;
 vec3 samples[9];int index=0;
 for(int y=-1;y<=1;y++){for(int x=-1;x<=1;x++){vec2 at=uv+vec2(float(x),float(y))*width*roomPixelRatio*texel;if(index!=4)at+=roomVogel(index,angle)*texel;vec4 n=texture2D(roomNormalTex,at);
  if(n.a!=0.0&&n.a!=roomObjectID&&gl_FragCoord.z>texture2D(roomDepthTex,at).x+.0001)return 0.0;
  samples[index]=n.rgb;index++;}}
 vec3 gx=samples[2]+2.0*samples[5]+samples[8]-(samples[0]+2.0*samples[3]+samples[6]);vec3 gy=samples[0]+2.0*samples[1]+samples[2]-(samples[6]+2.0*samples[7]+samples[8]);float magnitude=sqrt(dot(gx,gx)+dot(gy,gy));float result=smoothstep(threshold-smoothing,threshold+smoothing,magnitude);
 if(result==0.0){vec3 N=positional?roomLocalPosition:normalize(roomWorldNormal);float nt=dot(N,direction);
 if(positional){float df=fwidth(nt*frequency),f=fract(nt*frequency*.01),g=smoothstep(df*contourWidth*.01,df*contourWidth*.02,f);if(g<1.0)result=1.0;}
 else{float df=fwidth(nt*contourThreshold),f=sin(nt*frequency),g=smoothstep(0.0,df*contourWidth,1.0-f);if(df>(1.0-contourThreshold)*.5&&g<1.0)result=1.0-g;}}
 return result*roomOutlineEnabled;
}`;
