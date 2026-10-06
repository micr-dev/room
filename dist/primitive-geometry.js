import * as T from './vendor/three.module.js';
export function flatRectangle(width,height){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-width/2,height/2,0,width/2,-height/2,0,width/2,height/2,0,-width/2,-height/2,0],3));g.setAttribute('normal',new T.Float32BufferAttribute([0,0,1,0,0,1,0,0,1,0,0,1],3));g.setAttribute('uv',new T.Float32BufferAttribute([0,1,1,0,1,1,0,0],2));g.setIndex(new T.Uint32BufferAttribute([0,1,2,1,0,3],1));return g;}
export function roundedBox(g){const dimensions=[g.width??100,g.height??g.width??100,g.depth??g.width??100].map(v=>Math.abs(v)),radius=Math.max(0,Math.min(g.cornerRadius??0,...dimensions.map(v=>v/2)));if(!radius)return new T.BoxGeometry(...dimensions,g.widthSegments,g.heightSegments,g.depthSegments);
 const segments=Math.max(1,g.cornerSegments??8),half=dimensions.map(d=>d/2),inner=half.map(d=>d-radius),position=[],normal=[],uv=[],indices=[];
 function vertex(p,n,t=[0,0]){const index=position.length/3;position.push(...p);normal.push(...n);uv.push(...t);return index;}
 function triangle(a,b,c){const A=new T.Vector3().fromArray(position,a*3),B=new T.Vector3().fromArray(position,b*3),C=new T.Vector3().fromArray(position,c*3),N=new T.Vector3().fromArray(normal,a*3);if(B.sub(A).cross(C.sub(A)).dot(N)<0)[b,c]=[c,b];indices.push(a,b,c);}
 const divisions=[g.widthSegments??1,g.heightSegments??1,g.depthSegments??1].map(v=>Math.max(1,Math.floor(v)));
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const uAxis=axis===0?2:0,vAxis=axis===1?2:1,uSign=axis===1?1:axis===0?-sign:sign,vSign=axis===1?sign:-1,rows=[];
  for(let y=0;y<=divisions[vAxis];y++){const row=[];for(let x=0;x<=divisions[uAxis];x++){
   const u=x/divisions[uAxis],v=y/divisions[vAxis],p=[0,0,0],n=[0,0,0];p[axis]=sign*half[axis];p[uAxis]=(2*u-1)*inner[uAxis]*uSign;p[vAxis]=(2*v-1)*inner[vAxis]*vSign;n[axis]=sign;row.push(vertex(p,n,[u,1-v]));
  }rows.push(row);}
  for(let y=0;y<divisions[vAxis];y++)for(let x=0;x<divisions[uAxis];x++){triangle(rows[y][x],rows[y+1][x],rows[y][x+1]);triangle(rows[y+1][x],rows[y+1][x+1],rows[y][x+1]);}
 }

 for(let axis=0;axis<3;axis++){const [a,b]=[0,1,2].filter(x=>x!==axis);for(const sa of [-1,1])for(const sb of [-1,1]){const rows=[];for(let j=0;j<=segments;j++){const theta=j/segments*Math.PI/2,row=[];for(let k=0;k<=divisions[axis];k++){const sign=k/divisions[axis]*2-1,p=[0,0,0],n=[0,0,0];p[axis]=sign*inner[axis];n[a]=sa*Math.cos(theta);n[b]=sb*Math.sin(theta);p[a]=sa*inner[a]+radius*n[a];p[b]=sb*inner[b]+radius*n[b];row.push(vertex(p,n,[(sign*(axis===0?-sa*sb:sa*sb)+1)/2,0]));}rows.push(row);}for(let j=0;j<segments;j++)for(let k=0;k<divisions[axis];k++){triangle(rows[j][k],rows[j][k+1],rows[j+1][k+1]);triangle(rows[j][k],rows[j+1][k+1],rows[j+1][k]);}}}
 for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1]){const signs=[sx,sy,sz],rows=[];for(let m=0;m<=segments;m++){const phi=(1-m/segments)*Math.PI/2,row=[];for(let k=0;k<=m;k++){const theta=m?k/m*Math.PI/2:0,n=[Math.cos(phi)*Math.cos(theta),Math.sin(phi),Math.cos(phi)*Math.sin(theta)].map((v,i)=>v*signs[i]);row.push(vertex(n.map((v,i)=>signs[i]*inner[i]+radius*v),n));}rows.push(row);}for(let m=0;m<segments;m++)for(let k=0;k<=m;k++){triangle(rows[m][k],rows[m+1][k],rows[m+1][k+1]);if(k<m)triangle(rows[m][k],rows[m+1][k+1],rows[m][k+1]);}}
 const result=new T.BufferGeometry();result.setAttribute('position',new T.Float32BufferAttribute(position,3));result.setAttribute('normal',new T.Float32BufferAttribute(normal,3));result.setAttribute('uv',new T.Float32BufferAttribute(uv,2));result.setIndex(indices);return result;
}
