import {BLOCK as B} from '../core/blocks.js';
import {weapons,weaponBasis} from '../core/combat.js';
import {cube,quad,rgb} from './mesher.js';

const steel=rgb('#8b9491'),wood=rgb('#957655'),grain=rgb('#674d38');
const endGrain=rgb('#b49269'),bar=rgb('#646b6d'),rust=rgb('#755746');

function woodenClub(length){
 const mesh=[],sides=12;
 const rings=[[-.17,.041],[.19,.043],[length*.64,.057],[length-.09,.064],[length,.052]];
 const points=rings.map(([z,r],ring)=>Array.from({length:sides},(_,i)=>{
  const angle=i*2*Math.PI/sides;
  const radius=r*(1+.055*Math.sin(i*4.3));
  return [Math.cos(angle)*radius,Math.sin(angle)*radius,z+(ring===4?.018*Math.sin(i*2.7):0)];
 }));
 for(let ring=1;ring<points.length;ring++)for(let i=0;i<sides;i++){
  const j=(i+1)%sides;
  quad(mesh,[points[ring-1][i],points[ring-1][j],points[ring][j],points[ring][i]],
   i===2||i===8?grain:wood,.80+.19*Math.sin(i*2*Math.PI/sides));
 }
 for(const ring of [0,points.length-1])for(let i=0;i<sides;i++){
  const a=points[ring][i],b=points[ring][(i+1)%sides],center=[0,0,rings[ring][0]];
  quad(mesh,ring?[center,a,b,b]:[center,b,a,a],endGrain,.84);
 }
 return mesh;
}
const club=woodenClub(weapons[B.WOOD_CLUB].length);

export function weaponView(combat,eye,yaw,pitch,time,walk,wallDistance){
 const vertices=[],base=weaponBasis(yaw,pitch),attack=combat.pose();
 for(const side of [1,-1]){
  const id=side===1?combat.main:combat.off;
  if(!id)continue;
  const spec=weapons[id],active=attack?.side===side,weight=active?attack.weight:0;
  const yieldHand=attack&&!active?attack.weight:0;
  // Angle across the lower corner so the shaft reads at full length.
  const idleAngle=-side*.38;
  const angle=active?idleAngle+(attack.arc-idleAngle)*weight:idleAngle;
  const pull=active?attack.pull:0,recoil=active?attack.recoil:0;
  const aim=weaponBasis(yaw+(attack?.yaw??0)*weight-angle,
   pitch+.39*(1-weight)+pull*.33+(attack?.pitch??0)*weight);
  const swing=active?attack.extension:0;
  const center=eye.map((v,i)=>v+base.forward[i]*(.26+.32*weight+.20*swing-.57*pull-.10*recoil)+
   base.right[i]*side*(.50+.12*yieldHand-.34*weight+.27*pull)+
   base.up[i]*(-.43+.14*weight-.11*yieldHand+.07*swing+.17*pull+Math.sin(time*8)*walk*.013));
  const offset=center.map((v,i)=>v-eye[i]),distance=Math.hypot(...offset);
  const shoulder={x:offset[0]/distance,y:offset[1]/distance,z:offset[2]/distance};
  const gripRoom=wallDistance(eye,shoulder,distance+.06);
  const gripScale=Math.max(0,Math.min(1,(gripRoom-.06)/distance));
  for(let i=0;i<3;i++)center[i]=eye[i]+offset[i]*gripScale;
  const [dx,dy,dz]=aim.forward;
  const room=wallDistance(center,{x:dx,y:dy,z:dz},spec.length+.15);
  // Pull the entire weapon back along its axis to avoid drawing it
  // through the wall (also applies to the idle pose).
  const retract=Math.max(0,spec.length+.13-room);
  for(let i=0;i<3;i++)center[i]-=aim.forward[i]*retract;
  const piece=(x,y,z,w,h,d,color)=>cube(vertices,x,y,z,w,h,d,color,.90);
  const begin=vertices.length;
  if(spec.hands===2){
   piece(-.041,-.036,-.22,.082,.072,spec.length+.22,bar);
   for(const z of [.58,1.52,2.10])piece(-.043,-.038,z,.086,.076,.075,rust);
   piece(-.046,-.039,spec.length-.04,.092,.078,.065,steel);
  }else{
   for(const value of club)vertices.push(value);
  }
  for(let i=begin;i<vertices.length;i+=7){
   const x=vertices[i],y=vertices[i+1],z=vertices[i+2];
   // The camera looks down -Z. Reverse the local X axis to preserve winding.
   for(let j=0;j<3;j++)vertices[i+j]=center[j]-aim.right[j]*x+aim.up[j]*y+aim.forward[j]*z;
  }
 }
 return new Float32Array(vertices);
}
