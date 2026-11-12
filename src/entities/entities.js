import {moveBody,collides,inWater} from '../core/physics.js?v=1.1.0';import {dist2,hash} from '../util/math.js';
import {toVoxels} from '../core/scale.js';
let NEXT=1;
export class Entity{constructor(type,x,y,z){this.id=NEXT++;this.type=type;this.x=x;this.y=y;this.z=z;this.vx=0;this.vy=0;this.vz=0;this.width=.6;this.height=1.8;this.hp=20;this.maxHp=20;this.grounded=false;this.water=false;this.fly=false;this.age=0;this.dead=false;this.heading=0;this.flash=0}tick(w,dt){this.age+=dt;this.flash=Math.max(0,this.flash-dt);moveBody(w,this,dt)}hurt(amount,from){this.hp-=amount;this.flash=.2;if(from){let dx=this.x-from.x,dz=this.z-from.z,l=Math.hypot(dx,dz)||1;this.vx+=dx/l*4;this.vz+=dz/l*4;this.vy+=3}if(this.hp<=0)this.dead=true}}
export class Player extends Entity{constructor(x,y,z){super('player',x,y,z);this.width=toVoxels(.62);this.height=toVoxels(1.9);this.eye=toVoxels(1.70);this.yaw=0;this.pitch=0;this.selected=0;this.hp=20;this.fly=false;this.sprint=false;this.creative=true;this.cooldown=0;this.jumps=0;this.visualStepOffset=0}
 onStep(rise){this.visualStepOffset=Math.max(-1,Math.min(0,this.visualStepOffset-rise))}
 update(w,dt,input){const speed=toVoxels(this.fly?10:input.sprint?8:5),forward=(input.forward?1:0)-(input.backward?1:0)+(input.moveY||0),side=(input.right?1:0)-(input.left?1:0)+(input.moveX||0),len=Math.max(1,Math.hypot(forward,side));const sin=Math.sin(this.yaw),cos=Math.cos(this.yaw);this.vx=(-sin*forward+cos*side)/len*speed;this.vz=(-cos*forward-sin*side)/len*speed;
 if(this.fly){this.y+=(Number(input.jump)-Number(input.crouch))*speed*dt;this.vy=0}else if(input.jump&&(this.grounded||this.water)){this.vy=toVoxels(this.water?5:8.3);this.grounded=false}
 this.cooldown=Math.max(0,this.cooldown-dt);super.tick(w,dt);if(this.water&&!this.fly){this.vx*=.55;this.vz*=.55}}
 direction(){return{x:-Math.sin(this.yaw)*Math.cos(this.pitch),y:Math.sin(this.pitch),z:-Math.cos(this.yaw)*Math.cos(this.pitch)}}}
export class Mob extends Entity{constructor(type,x,y,z){super(type,x,y,z);this.width=toVoxels(type==='sheep'?.85:.6);this.height=toVoxels(type==='sheep'?1.15:1.8);this.hp=type==='sheep'?10:20;this.maxHp=this.hp;this.wander=0;this.wanderAngle=0;this.attackTimer=0}
 update(world,dt,player){this.wander-=dt;this.attackTimer=Math.max(0,this.attackTimer-dt);const d=dist2(this,player);let dx=0,dz=0,speed=0;
 if(this.type==='zombie'&&d<18*18&&d>1){const l=Math.sqrt(d);dx=(player.x-this.x)/l;dz=(player.z-this.z)/l;speed=toVoxels(2.35);if(d<1.5**2&&this.attackTimer===0){player.hurt(2,this);this.attackTimer=1.5}}
 else{if(this.wander<0){this.wander=1.5+hash(this.id,Math.floor(this.age),0)*3;this.wanderAngle=hash(Math.floor(this.age),this.id,1)*Math.PI*2}dx=Math.cos(this.wanderAngle);dz=Math.sin(this.wanderAngle);speed=toVoxels(1.05)}
 this.vx=dx*speed;this.vz=dz*speed;this.heading=Math.atan2(-dx,-dz);if((this.grounded||this.water)&&!this.fly){const aheadX=this.x+dx*.6,aheadZ=this.z+dz*.6;if(collides(world,aheadX,this.y,aheadZ,this.width,this.height)&&!collides(world,aheadX,this.y+1,aheadZ,this.width,this.height))this.vy=7}
 super.tick(world,dt);if(this.y<0)this.dead=true;
 }}
export class EntityManager{constructor(world){this.world=world;this.entities=[];this.spawnTimer=5}
 spawn(type,x,y,z){const m=new Mob(type,x,y,z);this.entities.push(m);return m}
 tick(dt,player){this.spawnTimer-=dt;if(this.spawnTimer<=0){this.spawnTimer=3;const seed=this.world.seed,t=Math.floor(this.world.time),angle=hash(t,this.entities.length,0,seed)*Math.PI*2,r=12+hash(t,0,1,seed)*17,x=Math.floor(player.x+Math.cos(angle)*r),z=Math.floor(player.z+Math.sin(angle)*r);if(this.entities.length<16){for(let y=55;y>1;y--){if(this.world.get(x,y-1,z)!==0&&this.world.get(x,y,z)===0&&this.world.get(x,y+1,z)===0){this.spawn('sheep',x+.5,y,z+.5);break}}}}
 for(const e of this.entities)if(Math.abs(e.x-player.x)<64&&Math.abs(e.z-player.z)<64)e.update(this.world,dt,player);this.entities=this.entities.filter(e=>!e.dead&&e.age<240)}
 attack(player,max=3.3){let chosen=null,best=max;const d=player.direction();for(const e of this.entities){const cx=e.x-player.x,cy=e.y+e.height*.5-(player.y+player.eye),cz=e.z-player.z,along=cx*d.x+cy*d.y+cz*d.z;if(along<0||along>best)continue;const perp=Math.hypot(cx-d.x*along,cy-d.y*along,cz-d.z*along);if(perp<e.width+.3){best=along;chosen=e}}if(chosen){chosen.hurt(5,player);return chosen}return null}
}
