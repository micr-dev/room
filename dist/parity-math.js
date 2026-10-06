export function blendChannel(a,b,alpha,mode){
 let c=b;switch(Number(mode)){case 1:c=a*b;break;case 2:c=1-(1-a)*(1-b);break;case 3:c=a<=.5?2*a*b:1-2*(1-a)*(1-b);break;}
 return Math.max(0,Math.min(1,a*(1-alpha)+c*alpha));
}
export function pixelationGranularity(value){const n=Math.floor(value);return n<=0?0:n+(n%2);}
export function sobelMagnitude(gx,gy){return Math.sqrt(gx.reduce((s,x)=>s+x*x,0)+gy.reduce((s,x)=>s+x*x,0));}
