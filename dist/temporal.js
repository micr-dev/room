// Temporal reconstruction in YCoCg, with motion reprojection and neighborhood clipping.
export const temporalVertex=`varying vec2 vUv;varying vec2 neighbors[9];uniform vec2 resolution;
void main(){vUv=position.xy*.5+.5;int i=0;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){neighbors[i]=vUv+vec2(float(x),float(y))/resolution;i++;}gl_Position=vec4(position.xy,1.,1.);}`;
export const temporalFragment=`precision lowp sampler2D;
varying vec2 vUv;varying vec2 neighbors[9];uniform sampler2D inputBuffer,historyBuffer,velocityBuffer,depthBuffer;uniform vec2 resolution;
vec3 toYCoCg(vec3 c){return vec3(c.r/4.+c.g/2.+c.b/4.,c.r/2.-c.b/2.,-c.r/4.+c.g/2.-c.b/4.);}
vec3 fromYCoCg(vec3 c){return clamp(vec3(c.x+c.y-c.z,c.x+c.z,c.x-c.y-c.z),0.,1.);}
vec4 currentSample(vec2 uv){vec4 c=texture2D(inputBuffer,uv);return vec4(toYCoCg(c.rgb),c.a);}
vec4 historySample(vec2 uv){
 vec2 p=uv*resolution,base=floor(p-.5)+.5,f=p-base;
 vec2 w0=f*(-.5+f*(1.-.5*f)),w1=1.+f*f*(-2.5+1.5*f),w2=f*(.5+f*(2.-1.5*f)),w3=f*f*(-.5+.5*f),w12=w1+w2;
 vec2 a=(base-1.)/resolution,b=(base+w2/w12)/resolution,c=(base+2.)/resolution;
 vec4 result=vec4(0.);result+=texture2D(historyBuffer,vec2(b.x,a.y))*w12.x*w0.y;result+=texture2D(historyBuffer,vec2(a.x,b.y))*w0.x*w12.y;result+=texture2D(historyBuffer,b)*w12.x*w12.y;result+=texture2D(historyBuffer,vec2(c.x,b.y))*w3.x*w12.y;result+=texture2D(historyBuffer,vec2(b.x,c.y))*w12.x*w3.y;return result;
}
void main(){
 float closest=1000.;vec2 at=vec2(0.);for(int i=0;i<9;i++){float d=texture2D(depthBuffer,neighbors[i]).r;if(d<closest){closest=d;at=neighbors[i];}}
 vec4 current=currentSample(vUv),history=historySample(vUv-texture2D(velocityBuffer,at).rg);history.rgb=toYCoCg(history.rgb);
 vec4 c0=currentSample(neighbors[0]),c1=currentSample(neighbors[1]),c2=currentSample(neighbors[2]),c3=currentSample(neighbors[3]),c4=currentSample(neighbors[4]),c5=currentSample(neighbors[5]),c6=currentSample(neighbors[6]),c7=currentSample(neighbors[7]),c8=currentSample(neighbors[8]);
 vec4 lo=min(c0,min(c1,min(c2,min(c3,min(c4,min(c5,min(c6,min(c7,c8)))))))),hi=max(c0,max(c1,max(c2,max(c3,max(c4,max(c5,max(c6,max(c7,c8)))))))),crossLo=min(c1,min(c3,min(c4,min(c5,c7)))),crossHi=max(c1,max(c3,max(c4,max(c5,c7))));
 lo=.5*(lo+crossLo);hi=.5*(hi+crossHi);vec2 extent=vec2(.125*(hi.r-lo.r));lo.gb=current.gb-extent;hi.gb=current.gb+extent;
 vec4 result=mix(current,clamp(history,lo,hi),.9);gl_FragColor=vec4(fromYCoCg(result.rgb),result.a);
}`;
