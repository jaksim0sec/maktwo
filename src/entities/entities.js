import {moveBody,collides,inWater,intersectAabb} from '../core/physics.js';import {dist2,hash} from '../util/math.js';
import {toVoxels} from '../core/scale.js';
import {CITY_MODE,CITY_STATION_VERSION,createCityPlan} from '../worldgen/eternal-night-game.js';
import {createStationTrain} from '../worldgen/station-train.js';
import {STATION_PREVIEW_MODE} from '../worldgen/station-preview.js';
import {carryTrainPassenger} from '../core/train-collision.js';
let NEXT=1;
export class Entity{constructor(type,x,y,z){this.id=NEXT++;this.type=type;this.x=x;this.y=y;this.z=z;this.vx=0;this.vy=0;this.vz=0;this.width=.6;this.height=1.8;this.hp=20;this.maxHp=20;this.grounded=false;this.water=false;this.fly=false;this.age=0;this.dead=false;this.heading=0;this.flash=0}tick(w,dt){this.age+=dt;this.flash=Math.max(0,this.flash-dt);moveBody(w,this,dt)}hurt(amount,from){this.hp-=amount;this.flash=.2;if(from){let dx=this.x-from.x,dz=this.z-from.z,l=Math.hypot(dx,dz)||1;this.vx+=dx/l*4;this.vz+=dz/l*4;this.vy+=3}if(this.hp<=0)this.dead=true}}
export class Player extends Entity{constructor(x,y,z){super('player',x,y,z);this.width=toVoxels(.54);this.height=1.53;this.standingHeight=1.53;this.crouchedHeight=.94;this.standingEye=1.39;this.crouchedEye=.81;this.crouching=false;this.eye=1.39;this.yaw=0;this.pitch=0;this.selected=0;this.hp=20;this.stamina=100;this.staminaRecovery=0;this.exhausted=false;this.fly=false;this.sprint=false;this.creative=false;this.cooldown=0;this.jumps=0;this.visualStepOffset=0}
 hurt(amount,from){if(!this.creative)super.hurt(amount,from)}
 onStep(rise){this.visualStepOffset=Math.max(-1,Math.min(0,this.visualStepOffset-rise))}
 update(w,dt,input){
  // Sneaking reduces actual physical height. Don't stand up inside low ceilings.
  const wantsCrouch=Boolean(input.crouch)&&!this.fly;
  this.crouching=wantsCrouch||(!this.fly&&collides(w,this.x,this.y,this.z,this.width,this.standingHeight));
  this.height=this.crouching?this.crouchedHeight:this.standingHeight;
  this.eye+=((this.crouching?this.crouchedEye:this.standingEye)-this.eye)*(1-Math.exp(-Math.min(dt,.08)*8.5));
  // Never let the camera enter a ceiling while the capsule is crouched.
  if(collides(w,this.x,this.y+this.eye-.12,this.z,this.width,.12))this.eye=Math.min(this.eye,this.height-.08);
  const forward=(input.forward?1:0)-(input.backward?1:0)+(input.moveY||0),side=(input.right?1:0)-(input.left?1:0)+(input.moveX||0);
  this.staminaRecovery=Math.max(0,this.staminaRecovery-dt);
  if(this.exhausted&&this.stamina>=20)this.exhausted=false;
  this.sprint=Boolean(input.sprint)&&(forward>0||Math.abs(side)>.1)&&!this.fly&&!this.crouching&&!this.water&&!this.exhausted&&this.stamina>0;
  if(this.sprint&&!this.creative){this.stamina=Math.max(0,this.stamina-18*dt);this.staminaRecovery=.8;if(this.stamina===0){this.exhausted=true;this.sprint=false}}
  else if(this.staminaRecovery===0)this.stamina=Math.min(100,this.stamina+14*dt);
  const speed=toVoxels(this.fly?8:this.crouching?2.7:this.sprint?7:2.5),len=Math.max(1,Math.hypot(forward,side));const sin=Math.sin(this.yaw),cos=Math.cos(this.yaw);this.vx=(-sin*forward+cos*side)/len*speed;this.vz=(-cos*forward-sin*side)/len*speed;const horizontal=Math.hypot(this.vx,this.vz);const cap=toVoxels(7);if(horizontal>cap){this.vx*=cap/horizontal;this.vz*=cap/horizontal}
 if(this.fly){this.vy=(Number(Boolean(input.jump))-Number(Boolean(input.crouch)))*speed}else if(input.jump&&(this.grounded||this.water)){this.vy=toVoxels(this.water?5:8.3);this.grounded=false}
 this.cooldown=Math.max(0,this.cooldown-dt);super.tick(w,dt);if(this.water&&!this.fly){this.vx*=.55;this.vz*=.55}}
 direction(){return{x:-Math.sin(this.yaw)*Math.cos(this.pitch),y:Math.sin(this.pitch),z:-Math.cos(this.yaw)*Math.cos(this.pitch)}}}
export class Mob extends Entity{constructor(type,x,y,z){super(type,x,y,z);this.width=toVoxels(type==='sheep'?.85:.6);this.height=toVoxels(type==='sheep'?1.15:1.8);this.hp=type==='sheep'?10:20;this.maxHp=this.hp;this.wander=0;this.wanderAngle=0;this.attackTimer=0}
 update(world,dt,player){this.wander-=dt;this.attackTimer=Math.max(0,this.attackTimer-dt);const d=dist2(this,player);let dx=0,dz=0,speed=0;
 if(this.type==='zombie'&&d<18*18&&d>1){const l=Math.sqrt(d);dx=(player.x-this.x)/l;dz=(player.z-this.z)/l;speed=toVoxels(2.35);if(d<1.5**2&&this.attackTimer===0){player.hurt(2,this);this.attackTimer=1.5}}
 else{if(this.wander<0){this.wander=1.5+hash(this.id,Math.floor(this.age),0)*3;this.wanderAngle=hash(Math.floor(this.age),this.id,1)*Math.PI*2}dx=Math.cos(this.wanderAngle);dz=Math.sin(this.wanderAngle);speed=toVoxels(1.05)}
 this.vx=dx*speed;this.vz=dz*speed;this.heading=Math.atan2(-dx,-dz);if((this.grounded||this.water)&&!this.fly){const aheadX=this.x+dx*.6,aheadZ=this.z+dz*.6;if(collides(world,aheadX,this.y,aheadZ,this.width,this.height)&&!collides(world,aheadX,this.y+1,aheadZ,this.width,this.height))this.vy=7}
 super.tick(world,dt);if(this.y<0)this.dead=true;
 }}
export class ItemDrop{
 constructor(itemId,x,y,z,count=1){this.id=NEXT++;this.type='drop';this.itemId=itemId;this.count=count;this.x=x;this.y=y;this.z=z;this.age=0;this.dead=false}
}
export class SubwayTrain extends Entity{
 constructor(site){
  const train=createStationTrain({x:Math.round(site.x),z:Math.round(site.z),floorY:site.y-1,axis:site.axis});
  super('train',train.x,train.floorY,train.z);
  this.train=train;this.stationId=site.id;this.width=train.width;this.height=4;
  this.homeX=this.x;this.homeZ=this.z;this.offset=0;this.speed=0;
  this.doorTarget=0;this.doorOpen=0;this.throttle=false;this.brake=false;
  const length=site.bounds?(site.axis==='x'?site.bounds.x1-site.bounds.x0:site.bounds.z1-site.bounds.z0):56;
  const spare=Math.max(0,Math.floor(length/2-(train.end+1)-2));
  this.limit=Math.min(site.preview?7:10,spare);this.driver=false;this.boardSide=1;
 }
 hurt(){} // Not a combat entity.
 setDoors(open){
  if(this.speed>.035)return false;
  this.doorTarget=open?1:0;return true;
 }
 control(accelerate,brake){this.throttle=Boolean(accelerate);this.brake=Boolean(brake)}
 advance(dt){
  dt=Math.max(0,Math.min(.06,dt));
  const difference=this.doorTarget-this.doorOpen;
  this.doorOpen=Math.abs(difference)<=dt*.72?this.doorTarget:this.doorOpen+Math.sign(difference)*dt*.72;
  // Low-speed traction and braking. No chunk edits or scene remeshing.
  const traction=this.doorOpen<.005&&this.doorTarget===0&&this.throttle?.44:0;
  const resistance=this.brake?1.35:.14;
  this.speed=Math.max(0,Math.min(2.75,this.speed+(traction-resistance)*dt));
  this.offset=Math.max(-this.limit,Math.min(this.limit,this.offset+this.speed*dt));
  if(this.offset>=this.limit)this.speed=0;
  this.x=this.homeX+(this.train.axis==='x'?this.offset:0);
  this.z=this.homeZ+(this.train.axis==='z'?this.offset:0);
 }
 doorDistance(player){
  let distance=Infinity,side=1;
  for(const car of this.train.carriages)for(const [from]of car.doors)for(const sign of [-1,1]){
   const along=from+1+this.offset,cross=sign*(this.train.width+1)/2+.5;
   const x=this.train.axis==='x'?this.homeX+along:this.homeX+cross;
   const z=this.train.axis==='x'?this.homeZ+cross:this.homeZ+along;
   const d=Math.hypot(player.x-x,player.z-z);
   if(d<distance){distance=d;side=sign}
  }
  return {distance,side};
 }
 nearby(player){
  return Math.abs(player.y-(this.y+1))<2.6&&this.doorDistance(player).distance<3.6;
 }
 driverPosition(){
  const along=this.train.start+2+this.offset,cross=.5;
  return {x:this.train.axis==='x'?this.homeX+along:this.homeX+cross,
   y:this.y+1,z:this.train.axis==='x'?this.homeZ+cross:this.homeZ+along};
 }
 platformExit(side=this.boardSide){
  const along=this.train.carriages[0].doors[0][0]+1+this.offset;
  const cross=side*(this.train.width+2)/2+.5;
  return {x:this.train.axis==='x'?this.homeX+along:this.homeX+cross,
   y:this.y+1,z:this.train.axis==='x'?this.homeZ+cross:this.homeZ+along};
 }
}
export class EntityManager{
 constructor(world){this.world=world;this.entities=[];this.spawnTimer=12;this.spawnSequence=0;
  if(world.mode===STATION_PREVIEW_MODE)
   this.entities.push(new SubwayTrain({x:0,z:0,y:23,axis:'x',id:'preview',preview:true}));
  if(world.mode===CITY_MODE&&world.version>=CITY_STATION_VERSION)
   this.entities.push(...createCityPlan(world.seed,world.version).stations.map(site=>new SubwayTrain(site)));
  world.trainColliders=this.entities.filter(e=>e.type==='train');
 }
 spawnDrop(itemId,x,y,z,count=1){const d=new ItemDrop(itemId,x,y,z,count);this.entities.push(d);return d}
 spawn(type,x,y,z,{natural=false}={}){const m=new Mob(type,x,y,z);m.natural=natural;this.entities.push(m);return m}
 tick(dt,player,inventory=null){
  if(this.world.trainColliders?.length){
   const shifts=new Map();
   for(const e of this.world.trainColliders){
    const before=e.offset;e.advance(dt);
    if(e.offset!==before)shifts.set(e.id,e.offset-before);
   }
   if(shifts.size)carryTrainPassenger(this.world.trainColliders,player,shifts);
  }
  // Wildlife is sparse and long-lived enough to make a quiet village feel settled.
  // Manual/test animals do not count against the natural population limit.
  const LIMIT=6,SPAWN_INTERVAL=16,MIN_SEPARATION=10,MAX_RANGE=60;
  for(const e of this.entities)if(e.type==='drop'){
   e.age+=dt;
   if(inventory&&e.age>.22&&Math.abs(e.y-player.y)<2&&dist2(e,player)<2.15*2.15){
    const obtained=inventory.add(e.itemId,e.count);e.count-=obtained;
    if(obtained){inventory.assignQuickSlot(e.itemId);this.collected=true}
    if(!e.count)e.dead=true;
   }
  }
  this.entities=this.entities.filter(e=>e.type==='train'||!e.dead&&(e.type==='drop'?e.age<180:e.age<(e.natural?180:240))&&(!e.natural||dist2(e,player)<MAX_RANGE*MAX_RANGE));
  this.spawnTimer-=dt;
  if(this.spawnTimer<=0){
   this.spawnTimer=SPAWN_INTERVAL;
   if(this.entities.filter(e=>e.natural&&e.type==='sheep').length<LIMIT){
    const seed=this.world.seed,t=this.spawnSequence++,angle=hash(t,this.entities.length,0,seed)*Math.PI*2,r=16+hash(t,0,1,seed)*14;
    const x=Math.floor(player.x+Math.cos(angle)*r),z=Math.floor(player.z+Math.sin(angle)*r);
    const clear=this.entities.every(e=>dist2(e,{x,z})>=MIN_SEPARATION*MIN_SEPARATION);
    if(clear){for(let y=55;y>1;y--){if(this.world.get(x,y-1,z)!==0&&this.world.get(x,y,z)===0&&this.world.get(x,y+1,z)===0){this.spawn('sheep',x+.5,y,z+.5,{natural:true});break}}}
   }
  }
  for(const e of this.entities)if(e.type!=='drop'&&e.type!=='train'&&Math.abs(e.x-player.x)<64&&Math.abs(e.z-player.z)<64)e.update(this.world,dt,player);
 }

 hitRay(origin,direction,maxDistance=3.8,blockDistance=Infinity,padding=0){
  let choice=null,best=Math.min(maxDistance,blockDistance+1e-4);
  const assist=Math.min(.24,Math.max(0,padding));
  for(const e of this.entities){if(e.dead||e.type==='drop'||e.type==='train')continue;
   const r=e.width*.5+assist,vertical=assist*.5;
   const hit=intersectAabb(origin,direction,[e.x-r,e.y-vertical,e.z-r],[e.x+r,e.y+e.height+vertical,e.z+r]);
   if(hit&&hit.distance>=0&&hit.distance<best){best=hit.distance;choice=e}
  }
  return choice;
 }
 attack(player,max=3.3){let chosen=null,best=max;const d=player.direction();for(const e of this.entities){if(e.type==='drop'||e.type==='train')continue;const cx=e.x-player.x,cy=e.y+e.height*.5-(player.y+player.eye),cz=e.z-player.z,along=cx*d.x+cy*d.y+cz*d.z;if(along<0||along>best)continue;const perp=Math.hypot(cx-d.x*along,cy-d.y*along,cz-d.z*along);if(perp<e.width+.3){best=along;chosen=e}}if(chosen){chosen.hurt(5,player);return chosen}return null}
}
