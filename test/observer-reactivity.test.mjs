import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ObserverPack,observerPose,observerCollapseProgress} from '../src/entities/observers.js';
import {observerMotion,observerHitRegions} from '../src/entities/observer-motion.js';
import {BLOCK as B} from '../src/core/blocks.js';
const world={
 seed:123,height:120,trainColliders:[],lightRevision:0,
 getChunk(cx,cz,create){assert.equal(create,false);return {}},
 get(x,y,z,create){assert.equal(create,false);return y<10?B.STONE:B.AIR}
};
const player={x:0,y:10,z:0,eye:1.39,width:.6,height:1.53,
 direction(){return {x:0,y:0,z:-1}}};
function spawn(count=1){
 const pack=new ObserverPack(world,{count,random:()=>.8});pack.clock=5;pack.spawn(player,48);
 assert(pack.active,'fixture needs a visible-possible observer');
 pack.publish(player,48);return pack;
}
test('a nonfatal hit registers an immediate individual alarm and actual escape intent',()=>{
 const pack=spawn(),s=pack.active.stalkers.get(0);
 assert(s);
 const origin={x:s.x+5,y:s.y,z:s.z};
 pack.damage(0,'body',origin);
 assert.equal(pack.active.members.get(0).hp,2);
 assert(s.startleUntil>pack.clock,'individual track must visibly react to being hit');
 assert(s.fearUntil>pack.clock+3,'reaction must outlive the first flinch');
 assert.equal(s.retreat,true,'flight intent belongs to the individual, not unused group.alert');
 assert.deepEqual(s.lastThreat,origin,'track should know where the hit came from');
 const at=s.yaw;
 pack.stepStalkers(player,.18);
 assert(Math.abs(s.yaw-at)>.04||Math.abs(s.headYaw)>.04,'observer must turn to acknowledge the hit');
});
test('on being watched, an ordinary observer interrupts wandering and retreats rather than continuing to stroll',()=>{
 const pack=spawn(),s=pack.active.stalkers.get(0);
 const watched={...player,direction(){
  const delta={x:s.x-this.x,y:0,z:s.z-this.z},len=Math.hypot(delta.x,delta.z)||1;
  return {x:delta.x/len,y:0,z:delta.z/len};
 }};
 // Explicitly give this ordinary creature a wandering destination.
 s.target={x:s.x+4,y:s.y,z:s.z};s.nextMove=Infinity;
 let noticed=false,retreated=false;
 for(let i=0;i<15;i++){
  pack.tick(.18,watched,48);
  noticed||=s.focus>.2;
  retreated||=s.retreat;
 }
 assert(noticed,'on-screen gaze must contribute to awareness');
 assert(retreated,'visible observation should provoke a retreat within a few seconds');
 assert(s.fleeing||s.retreat,'retreat must affect actual individual animation');
});
test('dead observer remains at its final location through extended encounter and eventually cleans up',()=>{
 const pack=spawn(),s=pack.active.stalkers.get(0);
 for(let n=0;n<3;n++)pack.damage(0,'body',player);
 const member=pack.active.members.get(0);
 assert(member.dead);assert.equal(pack.count,0);
 const origin={...member.at};
 pack.tick(12,player,48);
 assert(pack.active,'corpse must not vanish after ten seconds');
 assert(pack.views.some(v=>v.member?.dead),'corpse should remain renderable');
 assert.deepEqual(member.at,origin);
 pack.tick(54,player,48);
 assert(pack.views.some(v=>v.member?.dead),'corpse should remain after one minute');
 pack.tick(60,player,48);
 assert.equal(pack.active,null,'old corpses are eventually freed for performance');
});
test('death collapse has smooth, bounded progress and a distinct grounded shader transform',()=>{
 assert.equal(typeof observerCollapseProgress,'function');
 assert.equal(observerCollapseProgress(5,5),0);
 assert(observerCollapseProgress(5.55,5)>0&&observerCollapseProgress(5.55,5)<1);
 assert.equal(observerCollapseProgress(7,5),1);
 const pack=spawn();for(let i=0;i<3;i++)pack.damage(0,'body',player);
 const corpse=pack.views.find(v=>v.member?.dead);
 if(!corpse)pack.publish(player,48);
 const view=pack.views.find(v=>v.member?.dead);
 assert(view);
 assert(observerPose(view,pack.clock+1.2).to.startsWith('fall'));
 const render=readFileSync(new URL('../src/client/observer-render.js',import.meta.url),'utf8');
 assert.match(render,/uCollapse/,'renderer must receive actual collapse progress');
 assert.match(render,/gl\.uniform1f\(u\.Collapse/,'renderer must set per-body collapse uniform');
 assert.match(render,/p\.y\s*=|p\.y\s*\+=/,'collapse needs vertex height change not yaw-only rotation');
});

test('a hit during a scripted glimpse retreats along the proven entry path',()=>{
 const pack=spawn(),s=pack.active.stalkers.get(0);
 const entry={x:s.x-4,y:s.y,z:s.z};
 s.sighting={start:entry,seen:{x:s.x,y:s.y,z:s.z},phase:'watch',firstSeen:pack.clock,until:pack.clock+3};
 s.target=null;
 pack.damage(0,'body',player);
 assert.equal(s.sighting.phase,'withdraw');
 assert.deepEqual(s.target,entry,'impact must not discard the already walkable entry path');
 pack.stepStalkers(player,.18);
 assert(s.target,'startle may pause motion but must preserve escape waypoints');
});

test('a rendered observer takes an immediate visible chest impact from the actual targeting entry point',()=>{
 const pack=spawn(),s=pack.active.stalkers.get(0);
 Object.assign(s,{x:0,y:10,z:0,yaw:0,headYaw:0,headPitch:0});
 pack.publish(player,48);
 const attacker={x:0,y:10,z:2.4,eye:1.39};
 const hit=pack.pick({x:0,y:11.47,z:2.4},{x:0,y:0,z:-1},3);
 assert.equal(hit?.region,'body','a visible upright chest must not fall between hit regions');
 assert.equal(pack.pick({x:.04,y:11.74,z:2.4},{x:0,y:0,z:-1},3)?.region,'body','the narrow neck remains targetable');
 hit.entity.hurt(5,attacker);
 assert.equal(pack.views[0].member.hitAt,pack.clock,'visual hit state updates in the same frame as damage');
});

test('a blocked scripted exit is discarded and searched again before the runner stalls',()=>{
 const pack=spawn(),s=pack.active.stalkers.get(0);
 Object.assign(s,{x:0,y:10,z:-5,yaw:Math.PI,target:{x:0,y:10,z:-9},fearUntil:20,sighting:{
  start:{x:0,y:10,z:-9},seen:{x:0,y:10,z:-5},phase:'withdraw',firstSeen:4,until:5,deadline:13
 }});
 const exit={x:4,y:10,z:-6};
 let attempts=0;
 pack.walkClear=(from,to)=>to.x>from.x+.5;
 pack.escapeTarget=()=>{attempts++;return exit};
 for(let i=0;i<10;i++){pack.clock+=.18;pack.stepStalkers(player,.18)}
 assert.ok(attempts>0);
 assert.ok(s.x>.15,'the observer physically takes the replacement route');
});

test('gaze and sprint hit regions follow the position actually displayed between AI ticks',()=>{
 const pack=spawn(),s=pack.active.stalkers.get(0);
 const previous={x:-.6,y:10,z:0,yaw:0,travel:0,speed:3.5,headYaw:0,eyeYaw:0};
 Object.assign(s,previous,{x:0,travel:.6,headYaw:.3,eyeYaw:.4});
 pack.previous=[{...previous,id:0}];pack.sampleTime=pack.clock;pack.publish();pack.clock+=.09;
 const motion=observerMotion(pack.views[0],pack.clock,pack.sampleTime);
 assert.ok(Math.abs(motion.sample.x+.3)<1e-8);
 assert.ok(Math.abs(motion.head[0]-.15)<1e-8&&Math.abs(motion.eyes[0]-.2)<1e-8);
 const [,head]=observerHitRegions(motion)[0];
 assert.ok(head[1]<11.75,'the running head follows the lowered authored pose');
 const target=pack.pick({x:head[0],y:head[1],z:head[2]+2},{x:0,y:0,z:-1},2.25);
 assert.equal(target?.region,'head');
});

test('a hit triggers a glance before the neck settles, then a guard when all exits are blocked',()=>{
 const pack=spawn(),s=pack.active.stalkers.get(0);
 Object.assign(s,{x:0,y:10,z:-4,yaw:0,headYaw:0,eyeYaw:0});
 pack.walkClear=()=>false;
 pack.damage(0,'body',{...player,x:4,z:-3});
 pack.stepStalkers(player,.18);
 assert.ok(s.headYaw>.2&&s.eyeYaw>s.headYaw*.5,'the eye adds a quicker glance to the neck turn');
 for(let i=0;i<5;i++){pack.clock+=.18;pack.stepStalkers(player,.18)}
 assert.ok(s.guarding&&s.guardWeight>.7,'a cornered observer crouches and watches its attacker');
 assert.equal(s.z,-4);
});

test('an exposed running head prevents despawn at a corner even if the root is hidden',()=>{
 const pack=spawn(),s=pack.active.stalkers.get(0),viewer={...player,x:.1,z:4};
 pack.loadedWorld.get=(x,y,z)=>y<10||x===-1&&z===2&&y<=13?B.STONE:B.AIR;
 Object.assign(s,{x:-.45,y:10,z:.4,yaw:Math.PI/2,speed:3.5,travel:2/2.55,sighting:{
  phase:'withdraw',firstSeen:4,until:5,start:{x:-.45,y:10,z:-4}
 }});
 pack.publish();
 assert.equal(pack.clear({x:.1,y:11.39,z:4},{x:s.x,y:12.06,z:s.z}),false);
 pack.tick(.18,viewer,48);
 assert.equal(s.hidden,false);
 assert.equal(pack.views.length,1);
});

test('a guarded observer starts falling from the visible crouch and settles on the authored ground pose',()=>{
 const pack=spawn(),s=pack.active.stalkers.get(0);
 Object.assign(s,{speed:0,guardWeight:1});
 pack.active.members.set(0,{hp:1});pack.publish();
 const before=observerMotion(pack.views[0],pack.clock);
 pack.damage(0,'body',player);
 const start=observerMotion(pack.views[0],pack.clock);
 assert.deepEqual(observerHitRegions(start),observerHitRegions(before));
 const end=observerMotion(pack.views[0],pack.clock+1.2);
 assert.equal(end.overlay.to,'fall2');
 assert.equal(end.overlay.blend,1);
 assert.equal(end.ground,0);
});
