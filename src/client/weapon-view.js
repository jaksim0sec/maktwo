import {weapons,weaponBasis} from '../core/combat.js';
import {cube,rgb} from './mesher.js';

const leather=rgb('#564a40'),skin=rgb('#a58d79'),steel=rgb('#8b9491'),wood=rgb('#957655'),grain=rgb('#674d38'),splinter=rgb('#bc9c72'),bar=rgb('#646b6d'),rust=rgb('#755746');
export function weaponView(combat,eye,yaw,pitch,time,walk,wallDistance){
 const vertices=[],base=weaponBasis(yaw,pitch),attack=combat.pose();
 for(const side of [1,-1]){
  const id=side===1?combat.main:combat.off;
  if(!id)continue;
  const spec=weapons[id],active=attack?.side===side,weight=active?attack.weight:0;
  const yieldHand=attack&&!active?attack.weight:0;
  const angle=active?attack.arc:side*.27;
  const pull=active?attack.pull:0,recoil=active?attack.recoil:0;
  const aim=weaponBasis(yaw+(attack?.yaw??0)*weight-angle,
   pitch+.69*(1-weight)+pull*.33+(attack?.pitch??0)*weight);
  const swing=active?attack.extension:0;
  const center=eye.map((v,i)=>v+base.forward[i]*(.59+.20*swing-.57*pull-.10*recoil)+
   base.right[i]*side*(.35+.12*yieldHand-.19*weight+.27*pull)+
   base.up[i]*(-.29-.11*yieldHand+.07*swing+.17*pull+Math.sin(time*8)*walk*.013));
  const offset=center.map((v,i)=>v-eye[i]),distance=Math.hypot(...offset);
  const shoulder={x:offset[0]/distance,y:offset[1]/distance,z:offset[2]/distance};
  const gripRoom=wallDistance(eye,shoulder,distance+.06);
  const gripScale=Math.max(0,Math.min(1,(gripRoom-.06)/distance));
  for(let i=0;i<3;i++)center[i]=eye[i]+offset[i]*gripScale;
  const [dx,dy,dz]=aim.forward;
  const room=wallDistance(center,{x:dx,y:dy,z:dz},spec.length+.15);
  // Pull the entire weapon back along its axis instead of drawing a blade
  // through the wall (also applies to the idle pose).
  const retract=Math.max(0,spec.length+.13-room);
  for(let i=0;i<3;i++)center[i]-=aim.forward[i]*retract;
  const piece=(x,y,z,w,h,d,color)=>cube(vertices,x,y,z,w,h,d,color,.90);
  const begin=vertices.length;
  const grip=(x,z)=>{
   piece(x-.067,-.067,z,.134,.134,.16,skin);
   piece(x-.077,-.104,z-.15,.154,.13,.19,leather);
  };
  piece(-.033,-.029,-.18,.066,.058,.29,leather);
  if(spec.hands===2){
   piece(-.041,-.036,.10,.082,.072,spec.length-.10,bar);
   for(const z of [.58,1.52,2.10])piece(-.043,-.038,z,.086,.076,.075,rust);
   piece(-.046,-.039,spec.length-.04,.092,.078,.065,steel);
   grip(-side*.055,.29);
  }else{
   piece(-.052,-.042,.08,.105,.084,spec.length-.19,wood);
   piece(-.049,.042,.12,.018,.008,spec.length-.26,grain);
   piece(.016,-.032,spec.length-.11,.036,.060,.13,splinter);
   piece(-.039,-.027,spec.length-.11,.051,.053,.075,wood);
  }
  grip(side*.038,-.055);
  for(let i=begin;i<vertices.length;i+=7){
   const x=vertices[i],y=vertices[i+1],z=vertices[i+2];
   // The camera looks down -Z. Reverse the local X axis to preserve winding.
   for(let j=0;j<3;j++)vertices[i+j]=center[j]-aim.right[j]*x+aim.up[j]*y+aim.forward[j]*z;
  }
 }
 return new Float32Array(vertices);
}
