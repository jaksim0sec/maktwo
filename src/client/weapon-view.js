import {weapons,weaponBasis} from '../core/combat.js';
import {cube,rgb} from './mesher.js';

const leather=rgb('#564a40'),skin=rgb('#a58d79'),steel=rgb('#aeb8ba'),edge=rgb('#d0d5ce'),bar=rgb('#737c7e');
export function weaponView(combat,eye,yaw,pitch,time,walk,wallDistance){
 const vertices=[],base=weaponBasis(yaw,pitch),attack=combat.pose();
 for(const side of [1,-1]){
  const id=side===1?combat.main:combat.off;
  if(!id)continue;
  const spec=weapons[id],active=attack?.side===side,weight=active?attack.weight:0;
  const yieldHand=attack&&!active?attack.weight:0;
  const angle=side*.27*(1-weight)+(attack?.arc??0)*weight;
  const aim=weaponBasis(yaw+(attack?.yaw??0)*weight-angle,
   pitch+.69*(1-weight)+(attack?.pitch??0)*weight);
  const swing=weight*(attack?.extension??0);
  const center=eye.map((v,i)=>v+base.forward[i]*(.59+.20*swing)+
   base.right[i]*side*(.35+.12*yieldHand-.19*weight)+
   base.up[i]*(-.29-.11*yieldHand+.07*swing+Math.sin(time*8)*walk*.013));
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
   piece(-.041,-.036,.10,.082,.072,spec.length,bar);
   piece(-.046,-.039,spec.length+.07,.092,.078,.055,steel);
   grip(-side*.06,.18);
  }else{
   piece(-.106,-.028,.09,.212,.056,.048,bar);
   piece(-.049,-.016,.137,.098,.032,spec.length-.20,steel);
   piece(.035,-.010,.144,.018,.020,spec.length-.23,edge);
   piece(-.029,-.013,spec.length-.063,.057,.026,.062,steel);
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
