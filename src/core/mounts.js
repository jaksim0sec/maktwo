import {BLOCK as B} from './blocks.js';

// Each part is [left, bottom, depth, width, height, thickness, color, emissive].
export const MOUNT_PARTS = {
 [B.TORCH]: [
  [-.16,.13,.005,.32,.09,.25,'#746858'],
  [-.105,-.14,.10,.21,.27,.20,'#ffd19a',true],
  [-.14,-.19,.075,.28,.055,.25,'#746858'],
  [-.13,-.14,.08,.033,.28,.24,'#615950'],
  [.097,-.14,.08,.033,.28,.24,'#615950'],
 ],
 [B.SHOP_SIGN]: [
  [-.36,-.17,.005,.72,.34,.08,'#8f683e'],
  [-.30,-.09,.085,.60,.18,.013,'#d9bd8d'],
 ],
 [B.FLUORESCENT]: [
  [-.35,-.08,.005,.70,.16,.12,'#5f666a'],
  [-.30,-.045,.125,.60,.09,.05,'#eff6f1',true],
 ],
 [B.BROKEN_FLUORESCENT]: [
  [-.35,-.08,.005,.70,.16,.12,'#5f666a'],
  [-.30,-.045,.125,.60,.09,.05,'#899094'],
 ],
};
MOUNT_PARTS[B.LANTERN]=MOUNT_PARTS[B.TORCH];
export const isWallItem = id => Object.hasOwn(MOUNT_PARTS,id);

function rotatePair(u,v,facing){
 switch(facing&3){
  case 1:return [-v,u];
  case 2:return [-u,-v];
  case 3:return [v,-u];
  default:return [u,v];
 }
}
export function mountPoint(mount,u,v,d) {
 if(mount.facing)[u,v]=rotatePair(u,v,mount.facing);
 return [mount.x+mount.nz*u+mount.nx*d,mount.y+v,mount.z-mount.nx*u+mount.nz*d];
}

export function mountCell(mount) {
 const cell=mountPoint(mount,0,0,.09).map(Math.floor);
 for (const [u,v,d,w,h,t] of MOUNT_PARTS[mount.id]) {
  for (const left of [u,u+w]) for (const height of [v,v+h]) for (const depth of [d,d+t]) {
   const p=mountPoint(mount,left,height,depth);
   if (p[0]<cell[0]||p[0]>cell[0]+1||p[2]<cell[2]||p[2]>cell[2]+1||
       p[1]<cell[1]||p[1]>cell[1]+1) return null;
  }
 }
 return cell;
}

export function hitMount(mount,origin,direction,intersect) {
 const {nx,nz}=mount, dx=origin.x-mount.x, dz=origin.z-mount.z;
 const pos={x:nz*dx-nx*dz,y:origin.y-mount.y,z:nx*dx+nz*dz};
 const dir={x:nz*direction.x-nx*direction.z,y:direction.y,z:nx*direction.x+nz*direction.z};
 if(mount.facing){
  [pos.x,pos.y]=rotatePair(pos.x,pos.y,-mount.facing);
  [dir.x,dir.y]=rotatePair(dir.x,dir.y,-mount.facing);
 }
 let closest=null;
 for (const [u,v,d,w,h,t] of MOUNT_PARTS[mount.id]) {
  const hit=intersect(pos,dir,[u,v,d],[u+w,v+h,d+t]);
  if (hit&&(!closest||hit.distance<closest.distance)) closest=hit;
 }
 return closest;
}
