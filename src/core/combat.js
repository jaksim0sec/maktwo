import {BLOCK as B} from './blocks.js';
import {raycast} from './physics.js';

export const weapons=Object.freeze({
 [B.IRON_BLADE]:{damage:7,length:.94,reach:1.68,windup:.16,swing:.22,recover:.30,hands:1},
 [B.STEEL_BAR]:{damage:11,length:1.24,reach:2.00,windup:.26,swing:.28,recover:.42,hands:2}
});
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
export function weaponBasis(yaw,pitch){
 const sy=Math.sin(yaw),cy=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch);
 return {forward:[-sy*cp,sp,-cy*cp],right:[cy,0,-sy],up:[sy*sp,cp,cy*sp]};
}

export class Combat{
 constructor(){this.main=null;this.off=null;this.next=1;this.attack=null}
 cancel(){this.attack=null}
 equip(main,off){
  if(main!==this.main||off!==this.off){this.cancel();this.next=1}
  this.main=main;this.off=off;
 }
 start(ray,player){
  if(this.attack||!(this.main||this.off))return;
  const side=this.main&&(!this.off||this.next===1)?1:-1;
  const id=side===1?this.main:this.off;
  this.next=-side;
  const yaw=Math.atan2(-ray.x,-ray.z),pitch=Math.asin(clamp(ray.y,-1,1));
  this.attack={side,id,spec:weapons[id],time:0,contact:null,
   yaw:Math.atan2(Math.sin(yaw-player.yaw),Math.cos(yaw-player.yaw)),
   pitch:pitch-player.pitch};
 }
 pose(){
  const a=this.attack;
  if(!a)return null;
  const {spec,time,side,contact}=a;
  const travel=ease((time-spec.windup)/spec.swing);
  const charge=ease(time/spec.windup);
  const recovering=time>=spec.windup+spec.swing||contact!==null;
  const recovery=ease((time-(contact?contact.time+.065:spec.windup+spec.swing))/spec.recover);
  const weight=recovering?1-recovery:charge;
  return {side,id:a.id,weight,arc:(contact?.arc??(.74-1.48*travel))*side,
   extension:(contact?.extension??(.40+.60*Math.sin(travel*Math.PI)))*weight,
   yaw:a.yaw,pitch:a.pitch,contact:contact?.distance};
 }
 tick(dt,world,entities,player,eyeY,effects){
  const a=this.attack;if(!a)return;
  const old=a.time;a.time+=dt;
  const {spec}=a;
  if(a.time>=(a.contact?a.contact.time+.065:spec.windup+spec.swing)+spec.recover){this.cancel();return}
  if(a.contact||a.time<spec.windup||old>=spec.windup+spec.swing)return;
  const origin={x:player.x,y:eyeY-.18,z:player.z};
  const progress=ease((a.time-spec.windup)/spec.swing);
  const arc=.74-1.48*progress;
  const [x,y,z]=weaponBasis(player.yaw+a.yaw-arc*a.side,player.pitch+a.pitch).forward;
  const ray={x,y,z};
  const reach=spec.reach*(.84+.16*Math.sin(progress*Math.PI));
  const wall=raycast(world,origin,ray,reach,{solidOnly:true});
  let limit=wall?.distance??reach;
  for(const train of world.trainColliders??[])limit=train.shellDistance(origin,ray,limit);
  const hit=entities.hitRay(origin,ray,reach,limit,0,true);
  if(!hit&&!wall&&limit>=reach)return;
  const distance=hit?.distance??limit;
  a.contact={time:a.time,arc,distance,extension:clamp((distance-spec.length)/.62,0,.85)};
  if(hit)hit.entity.hurt(spec.damage,player);
  effects.burst(origin.x+x*distance,origin.y+y*distance,origin.z+z*distance,hit?'#aa8c79':'#9b9b93',4);
 }
}
