import {VERTICAL_FOV} from './camera.js';

// Screen-space ray for editing at the actual pointer location, not the view centre.
// Coordinates are canvas CSS pixels, independent of dynamic WebGL render scale.
export function screenRay(player,x,y,width,height,fov=VERTICAL_FOV){
 const aspect=width/Math.max(height,1),nx=2*x/Math.max(width,1)-1,ny=1-2*y/Math.max(height,1);
 const cp=Math.cos(player.pitch),sp=Math.sin(player.pitch),sy=Math.sin(player.yaw),cy=Math.cos(player.yaw);
 const f=[-sy*cp,sp,-cy*cp],r=[cy,0,-sy],u=[sy*sp,cp,cy*sp];
 const k=Math.tan(fov/2),hx=nx*k*aspect,vy=ny*k;
 const d=[f[0]+r[0]*hx+u[0]*vy,f[1]+r[1]*hx+u[1]*vy,f[2]+r[2]*hx+u[2]*vy];
 const l=Math.hypot(...d)||1;
 return{x:d[0]/l,y:d[1]/l,z:d[2]/l};
}
export function canvasPoint(e,canvas){const rect=canvas.getBoundingClientRect();return{x:e.clientX-rect.left,y:e.clientY-rect.top}}
