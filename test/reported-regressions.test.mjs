import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Hologram,createAnchor,cardGeometry} from '../src/client/hologram.js';
import {Player,EntityManager} from '../src/entities/entities.js';
import {DOOR_HEIGHT} from '../src/core/door.js';
import {toMeters} from '../src/core/scale.js';
import {World} from '../src/core/world.js';
import {BLOCK as B} from '../src/core/blocks.js';
import {GestureState} from '../src/client/gestures.js';
import {Input} from '../src/client/input.js';

const source=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const rect={left:0,top:0,width:1000,height:700};
test('inventory pointer-down uses current screen pixel rather than stale previous-frame hover',()=>{
 const player={x:0,y:30,z:0,eye:1.59,yaw:0,pitch:0,visualStepOffset:0,direction(){return{x:0,y:0,z:-1}}};
 const mock=Object.create(Hologram.prototype);
 mock.opened=true;mock.anchor=createAnchor(player);
 mock.cards=cardGeometry('blocks',Array.from({length:10},(_,i)=>({name:`물건 ${i}`,color:'#777777'})));
 mock.buildGeometry=()=>{};
 const left=mock.pickAt(player,450,350,rect);assert.equal(left,'item:0');
 const right=mock.pickAt(player,650,350,rect);assert.equal(right,'item:3');
 assert.notEqual(left,right);assert.equal(mock.click(),right);
 assert.match(source('src/client/game.js'),/hologram\.pickAt\(this\.player,event\.clientX,event\.clientY/);
});
test('inventory mobile look is independent of inventory hover and stays responsive',()=>{
 const p=new Player(0,25,0);
 const gestures=new GestureState();gestures.down(1,75,350,500,100,1000);gestures.down(2,765,350,500,100,1000);
 gestures.move(1,175,350);gestures.move(2,810,330);
 assert.ok(gestures.movement().x>0);
 const [dx,dy]=gestures.consumeLook();assert.ok(dx>20&&dy<0);
 assert.match(source('src/client/game.js'),/event\.pointerType==='mouse'/);
 assert.match(source('src/client/game.js'),/this\.input\.gestures\.right!==null\)this\.hologram\.pointer=null/);
});
test('player collision and eye height fit under the existing two-block door without changing saved block scale',()=>{
 const p=new Player(0,23,0);
 assert.ok(p.height<DOOR_HEIGHT,p.height+' vs '+DOOR_HEIGHT);
 assert.ok(p.eye<p.height&&p.eye>1.4);
 assert.ok(toMeters(p.height)<toMeters(DOOR_HEIGHT));
});
test('light index includes installed torches throughout the local light volume rather than closest 20',()=>{
 const w=new World({mode:'flat'});
 for(let x=1;x<=25;x++)w.set(x,24,2,B.TORCH,{simulate:false});
 w.set(37,24,3,B.TORCH,{simulate:false});
 const far=w.lights.inBounds(-32,48,-32,48,{limit:80});
 assert.equal(far.length,26);
 assert.ok(far.some(s=>s.x===37.5&&s.z===3.5));
 assert.equal(w.lights.near(0,24,0,20,52).some(s=>s.x===37.5),false);
 assert.match(source('src/client/renderer.js'),/world\.lights\.inBounds/);
});
test('natural sheep spawns have a sparse cap and minimum separation; manually spawned entities remain possible',()=>{
 const w=new World({mode:'flat'});const manager=new EntityManager(w),p=new Player(0,24,0);
 for(let i=0;i<80;i++){manager.spawnTimer=0;manager.tick(1/60,p)}
 const natural=manager.entities.filter(e=>e.natural);
 assert.ok(natural.length>0&&natural.length<=6,`natural sheep count ${natural.length}`);
 for(let a=0;a<natural.length;a++)for(let b=a+1;b<natural.length;b++){
  const dx=natural[a].x-natural[b].x,dz=natural[a].z-natural[b].z;
  assert.ok(Math.hypot(dx,dz)>=8,'natural animals should be spread apart');
 }
 assert.equal(manager.spawn('sheep',0,25,0).natural,false);
});
