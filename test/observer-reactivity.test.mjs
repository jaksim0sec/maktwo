import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ObserverPack,observerPose,observerCollapseProgress} from '../src/entities/observers.js';
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
 pack.tick(12,player,48);pack.publish(player,48);
 assert(pack.active,'corpse must not vanish after ten seconds');
 assert(pack.views.some(v=>v.member?.dead),'corpse should remain renderable');
 assert.deepEqual(member.at,origin);
 pack.tick(54,player,48);pack.publish(player,48);
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
