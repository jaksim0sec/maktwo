import {BLOCK as B} from './blocks.js';
import {raycast} from './physics.js';

export const weapons=Object.freeze({
 [B.WOOD_CLUB]:{damage:5,length:1.02,reach:1.76,windup:.27,swing:.25,recover:.32,hands:1,back:1.73,follow:1.08},
 [B.STEEL_BAR]:{damage:11,length:2.30,reach:2.87,windup:.44,swing:.32,recover:.47,hands:2,back:2.16,follow:1.24}
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
  const charge=ease(time/spec.windup);
  const release=(contact?.time??spec.windup+spec.swing)+(contact ? .065 : 0);
  const settle=1-ease((time-release)/spec.recover);
  const travel=ease((time-spec.windup)/spec.swing);
  const arc=time<spec.windup?.27+(spec.back-.27)*charge:
   contact?.arc??spec.back-(spec.back+spec.follow)*travel;
  const pull=time<spec.windup?charge:1-ease(travel/.43);
  const drive=contact?.extension??Math.sin(Math.PI*travel);
  const recoil=contact?Math.sin(Math.PI*clamp((time-contact.time)/.13,0,1)):0;
  return {side,id:a.id,weight:charge*settle,arc:(.27+(arc-.27)*settle)*side,
   pull:pull*settle,extension:drive*settle,recoil,yaw:a.yaw,pitch:a.pitch};
 }

 tick(dt,world,entities,player,eyeY,effects){
  const a=this.attack;if(!a)return;
  const old=a.time;a.time+=dt;
  const {spec}=a;
  if(a.time>=(a.contact?a.contact.time+.065:spec.windup+spec.swing)+spec.recover){this.cancel();return}
  if(a.contact||a.time<spec.windup||old>=spec.windup+spec.swing)return;
  const origin={x:player.x,y:eyeY-.18,z:player.z};
  const start=clamp((old-spec.windup)/spec.swing,0,1);
  const end=clamp((a.time-spec.windup)/spec.swing,0,1);
  const samples=Math.max(1,Math.ceil((ease(end)-ease(start))*(spec.back+spec.follow)/.085));
  for(let i=1;i<=samples;i++){
   const progress=ease(start+(end-start)*i/samples);
   if(this.strike(a,world,entities,player,origin,progress,effects))break;
  }
 }
 strike(a,world,entities,player,origin,progress,effects){
  const {spec}=a;
  const arc=spec.back-(spec.back+spec.follow)*progress;
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
  return true;
 }
}
