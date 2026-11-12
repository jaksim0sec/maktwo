import {BLOCK as B, BLOCKS, itemId} from './blocks.js';

export const FORMS = ['정육면체', '하단 반블록', '상단 반블록', '45° 벽', '경사'];
const MATERIAL={rotation:90,forms:true};
const ROTATABLE={rotation:90,forms:false};
const ARCH_PART={rotation:45,forms:false};
const PANEL={rotation:45,forms:false,panel:true};
const FIXED={rotation:0,forms:false};

export const BUILD_TYPES=Object.freeze(BLOCKS.map(({id,render})=>{
 if(id===B.AIR||id===B.BEDROCK||id===B.PORTAL||id===B.DOOR_TOP||render==='fluid')return FIXED;
 if(render==='panel'||render==='frame')return PANEL;
 if(render==='part')return ARCH_PART;
 if((render==='cube'||render==='glass')&&id!==B.SAND&&id!==B.RED_SAND&&id!==B.SHOP_SIGN)return MATERIAL;
 return ROTATABLE;
}));
export const buildType=id=>BUILD_TYPES[itemId(id)]??FIXED;
export const supportsForms=id=>buildType(id).forms;
export function placementRotation(id,form){
 const type=buildType(id);
 if(type.forms&&form===3)return {step:90,offset:45};
 return {step:type.forms&&form===4?45:type.rotation,offset:0};
}
export function formCode(form, rotation) {
 if (form < 3) return form;
 return (form === 3 ? 3 : 7) + (rotation & 3);
}
export function orientedForm(form,angle){
 if(form===4){
  const eighth=Math.round(angle/45)&7;
  return eighth&1?11+(eighth>>1):7+(eighth>>1);
 }
 return formCode(form,Math.floor(angle/90));
}

// Clip a cube by one plane once. All three consumers use the resulting convex solid.
const cube = [
 [[1,0,0],[1,1,0],[1,1,1],[1,0,1]], [[0,0,1],[0,1,1],[0,1,0],[0,0,0]],
 [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], [[0,0,0],[1,0,0],[1,0,1],[0,0,1]],
 [[1,0,1],[1,1,1],[0,1,1],[0,0,1]], [[0,0,0],[0,1,0],[1,1,0],[1,0,0]],
];
const axes = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function clipped(plane, limit, material) {
 const rim = new Map();
 const faces = cube.map((face, index) => {
  const points = [];
  for (let i=0; i<face.length; i++) {
   const a=face[i], b=face[(i+1)%face.length], da=dot(a,plane)-limit, db=dot(b,plane)-limit;
   if (da<=0) points.push(a);
   if (da===0) rim.set(a.join(),a);
   if (da*db<0) {
    const point=a.map((v,j)=>v+(b[j]-v)*da/(da-db));
    points.push(point);
    rim.set(point.join(),point);
   }
  }
  return {points, material:index, side:index, normal:axes[index]};
 }).filter(face=>face.points.length>=3);
 const points=[...rim.values()];
 const center=axes[0].map((_,i)=>points.reduce((sum,p)=>sum+p[i],0)/points.length);
 const u=plane[0]||plane[2]?[plane[2],0,-plane[0]]:[1,0,0];
 const v=[plane[1]*u[2]-plane[2]*u[1],plane[2]*u[0]-plane[0]*u[2],plane[0]*u[1]-plane[1]*u[0]];
 const angle=p=>Math.atan2(dot(p.map((n,i)=>n-center[i]),v)/Math.hypot(...v),dot(p.map((n,i)=>n-center[i]),u)/Math.hypot(...u));
 points.sort((a,b)=>angle(a)-angle(b));
 faces.push({points,material,side:-1,normal:plane});
 return {plane,limit,faces};
}
export const FORMED = [
 null, clipped([0,1,0],.5,2), clipped([0,-1,0],-.5,3),
 ...[[1,0,1],[-1,0,1],[-1,0,-1],[1,0,-1]].map(p=>clipped(p,(p[0]+p[2])/2,0)),
 ...[[0,1,-1],[-1,1,0],[0,1,1],[1,1,0]].map(p=>clipped(p,Math.max(0,p[0],p[2]),2)),
 ...[[-.5,1,-.5],[-.5,1,.5],[.5,1,.5],[.5,1,-.5]].map(p=>clipped(p,Math.max(0,p[0])+Math.max(0,p[2]),2)),
];

export function formedOverlap(shape,x,y,z,body,epsilon) {
 const half=body.width/2, [a,b,c]=shape.plane;
 const loX=Math.max(0,body.x-half+epsilon-x), hiX=Math.min(1,body.x+half-epsilon-x);
 const loY=Math.max(0,body.y+epsilon-y), hiY=Math.min(1,body.y+body.height-epsilon-y);
 const loZ=Math.max(0,body.z-half+epsilon-z), hiZ=Math.min(1,body.z+half-epsilon-z);
 return loX<hiX && loY<hiY && loZ<hiZ &&
  a*(a<0?hiX:loX)+b*(b<0?hiY:loY)+c*(c<0?hiZ:loZ)<shape.limit;
}

export function hitFormed(shape,x,y,z,origin,direction) {
 const pos=[origin.x-x,origin.y-y,origin.z-z], dir=[direction.x,direction.y,direction.z];
 let enter=-Infinity, exit=Infinity, entering, exiting;
 for (const face of shape.faces) {
  const n=face.normal, distance=dot(face.points[0],n)-dot(pos,n), rate=dot(dir,n);
  if (Math.abs(rate)<1e-10) {
   if (distance<-1e-9) return null;
   continue;
  }
  const t=distance/rate;
  if (rate<0 && t>enter) {enter=t;entering=face;}
  if (rate>0 && t<exit) {exit=t;exiting=face;}
  if (enter>exit+1e-9) return null;
 }
 if (exit<0) return null;
 const face=enter>=0?entering:exiting;
 if (!face) return null;
 const [nx,ny,nz]=face.normal, length=Math.hypot(nx,ny,nz);
 const anchor=face.points.reduce((p,v)=>({x:p.x+v[0]/face.points.length,y:p.y+v[1]/face.points.length,z:p.z+v[2]/face.points.length}),{x,y,z});
 return {distance:enter>=0?enter:exit,normal:{x:nx/length,y:ny/length,z:nz/length},anchor};
}
