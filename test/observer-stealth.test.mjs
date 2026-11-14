import test from 'node:test';
import assert from 'node:assert/strict';
import {ObserverPack,OBSERVER_NAME} from '../src/entities/observers.js';
import {BLOCK as B} from '../src/core/blocks.js';

const world={
 seed:123,height:120,trainColliders:[],lightRevision:0,
 getChunk(cx,cz,create){assert.equal(create,false);return {};},
 get(x,y,z,create){
  assert.equal(create,false);
  return y<10||y===20?B.STONE:B.AIR;
 }
};
const player={x:0,y:10,z:0,eye:1.39,width:.6,height:1.53,
 direction(){return{x:0,y:0,z:-1}}};
function make(){
 const pack=new ObserverPack(world,{count:3});
 pack.clock=5;pack.spawn(player,48);pack.publish();
 assert.ok(pack.active,'an observer must find a concealed position');
 return pack;
}
test('shy observers spread out rather than spawning as a bright cluster',()=>{
 const pack=make();
 assert.equal(OBSERVER_NAME,'소심한 관찰자');
 assert.equal(pack.views.length,3);
 for(let i=0;i<pack.views.length;i++)for(let j=i+1;j<pack.views.length;j++){
  assert.ok(Math.hypot(pack.views[i].x-pack.views[j].x,pack.views[i].z-pack.views[j].z)>=7.49);
 }
 const eye={x:player.x,y:player.y+player.eye,z:player.z};
 assert.ok(pack.views.every(p=>pack.invisible(eye,player.direction(),p)));
});
test('center-screen observation ends before five seconds with a discreet retreat',()=>{
 const pack=make();
 const s=pack.active.stalkers.values().next().value;
 const watched={...player,direction(){
  const x=s.x-this.x,z=s.z-this.z,m=Math.hypot(x,z);
  return{x:x/m,y:0,z:z/m};
 }};
 for(let i=0;i<30;i++)pack.tick(.18,watched,48);
 assert.ok(s.hidden||s.presence<.2,'a sustained stare must stop the sighting');
 assert.ok(pack.views.every(v=>v.id!==s.id||v.track.presence<.2));
});
test('neck follows independently while the body does not snap toward the viewer',()=>{
 const pack=make();
 const s=pack.active.stalkers.values().next().value,initialYaw=s.yaw;
 const watched={...player,direction(){
  const x=s.x-this.x,z=s.z-this.z,m=Math.hypot(x,z);
  return{x:x/m,y:0,z:z/m};
 }};
 for(let i=0;i<4;i++)pack.tick(.18,watched,48);
 assert.ok(Math.abs(s.headYaw)>.03,'head should aim without fully rotating the torso');
 assert.ok(Math.abs(s.yaw-initialYaw)<.35,'torso should not snap at the viewer');
});
test('roof shadows outrank lamp-lit positions',()=>{
 const pack=make(),p={x:5,y:10,z:5};
 assert.equal(pack.shadowScore(p,[]),2);
 assert.ok(pack.shadowScore(p,[{x:5,y:12,z:5,radius:8}])<pack.shadowScore(p,[]));
});

test('lighting candidates use array focus and are cached between short AI ticks',()=>{
 let queries=0;
 const lit={...world,lightRevision:19,lights:{inBounds(x0,x1,z0,z1,{focus}){
  assert.deepEqual(focus,[0,10,0]);
  queries++;return [];
 }}};
 const pack=new ObserverPack(lit,{count:1});
 pack.clock=5;pack.lightCandidates(player);
 pack.clock+=.18;pack.lightCandidates(player);
 assert.equal(queries,1);
});
