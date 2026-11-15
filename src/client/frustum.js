// View-frustum culling for chunk-sized boxes. Pure math, so it is unit-testable without WebGL.

// Six clip planes (left, right, bottom, top, near, far) from a column-major view-projection
// matrix, as [a,b,c,d]x6 with unit normals. A point is inside when a*x+b*y+c*z+d >= 0.
export function frustumPlanes(m,out=new Float32Array(24)){
 const row=(i)=>[m[i],m[4+i],m[8+i],m[12+i]];
 const r0=row(0),r1=row(1),r2=row(2),r3=row(3);
 const combos=[[1,r0],[-1,r0],[1,r1],[-1,r1],[1,r2],[-1,r2]];
 for(let p=0;p<6;p++){
  const [sign,r]=combos[p];
  let a=r3[0]+sign*r[0],b=r3[1]+sign*r[1],c=r3[2]+sign*r[2],d=r3[3]+sign*r[3];
  const length=Math.hypot(a,b,c)||1;
  out[p*4]=a/length;out[p*4+1]=b/length;out[p*4+2]=c/length;out[p*4+3]=d/length;
 }
 return out;
}

// False only when the box is entirely outside one plane, so a box that touches the view
// is never rejected. It can keep a box near a frustum corner, which only costs a draw call.
export function boxIntersectsFrustum(planes,x0,y0,z0,x1,y1,z1){
 for(let p=0;p<24;p+=4){
  const a=planes[p],b=planes[p+1],c=planes[p+2];
  // The box corner furthest along the plane normal.
  if(a*(a>=0?x1:x0)+b*(b>=0?y1:y0)+c*(c>=0?z1:z0)+planes[p+3]<0)return false;
 }
 return true;
}
