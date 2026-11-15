import {FOV_TAN} from '../src/client/camera.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cardGeometry,inspectionGeometry,atlasRect,createAnchor,spatialHit,Hologram,PANEL_SCALE,PANEL_DISTANCE} from '../src/client/hologram.js';

const player={x:2,y:35,z:4,eye:1.7,yaw:0,pitch:0,direction(){return{x:0,y:0,z:-1}}};
const normalize=p=>{const n=Math.hypot(...p);return p.map(v=>v/n)};
const aimAt=(anchor,card)=>normalize([
 anchor.center[0]+anchor.right[0]*card.x*PANEL_SCALE+anchor.forward[0]*card.depth*PANEL_SCALE-player.x,
 anchor.center[1]+card.y*PANEL_SCALE-(player.y+player.eye),
 anchor.center[2]+anchor.right[2]*card.x*PANEL_SCALE+anchor.forward[2]*card.depth*PANEL_SCALE-player.z,
]);
test('spatial bag consists of small separated in-world tiles, no fullscreen slab',()=>{
 const cards=cardGeometry('blocks',Array.from({length:6},(_,i)=>({name:`Block ${i}`,color:'#456789'})));
 assert.equal(cards.length,15);
 assert.ok(cards.filter(c=>c.role==='item').every(c=>c.w>1&&c.h<.28));
 assert.ok(cards.some(c=>c.id==='view:inventory')&&cards.some(c=>c.id==='view:craft'));
 assert.equal(cards.find(c=>c.id==='close').name,'✕');
 assert.equal(cards.filter(c=>c.id.startsWith('item:')).length,6);
 assert.ok(cards.some(c=>c.id==='hand'));
});
test('world-anchored inventory ray-picks each card and empty hand',()=>{
 const anchor=createAnchor(player),cards=cardGeometry('blocks',Array.from({length:6},(_,i)=>({name:`Block ${i}`})));
 for(const card of cards){const ray=aimAt(anchor,card);assert.equal(spatialHit(anchor,cards,player,ray)?.id,card.id)}
 assert.equal(spatialHit(anchor,cards,player,[0,1,0]),null);
});
test('spatial inventory remains upright and world-anchored after camera movement',()=>{
 const angled={...player,pitch:-.72};const anchor=createAnchor(angled);
 assert.ok(Math.abs(anchor.center[1]-(player.y+player.eye))<.3);assert.deepEqual(anchor.up,[0,1,0]);
 const before=structuredClone(anchor);angled.yaw=1;angled.pitch=.5;
 assert.deepEqual(anchor,before,'world-space anchor must not follow a later camera turn');
});
test('world-space hologram stays interactive while preserving WebGL depth state',()=>{
 const fs=readFileSync(new URL('../src/client/hologram.js',import.meta.url),'utf8');
 assert.match(fs,/gl\.uniformMatrix4fv\(this\.u\.vp/);
 assert.match(fs,/gl\.disable\(gl\.DEPTH_TEST\)/);
 assert.match(fs,/gl\.enable\(gl\.DEPTH_TEST\)/);
 assert.doesNotMatch(fs,/gl\.depthFunc\(gl\.GREATER\)/);
});

test('arrow keys navigate focus across actual spatial cards',()=>{
 const h=Object.create(Hologram.prototype);
 h.opened=true;h.cards=cardGeometry('all',Array.from({length:6},(_,i)=>({name:String(i)})));
 h.focusId='item:0';h.keyboardMode=false;
 assert.equal(h.moveFocus('right'),'item:1');
 assert.equal(h.moveFocus('down'),'item:3');
 assert.equal(h.focusedId(),'item:3');
});
test('craft list makes available recipes visually distinct',()=>{
 const cards=cardGeometry('craft',[{name:'목재',id:9,craftable:true,recipe:{count:4}}]);
 assert.ok(cards.some(c=>c.id==='filter:available'));
 assert.ok(cards.some(c=>c.id==='view:inventory'));
 assert.equal(cards.find(c=>c.id==='item:0').craftable,true);
});

test('atlas sampling exactly preserves each card aspect including wide buttons',()=>{
 for(const compact of [false,true])for(const mode of ['all','craft']){
  const cards=cardGeometry(mode,Array.from({length:mode==='craft'?(compact?6:10):(compact?5:6)},(_,i)=>({name:String(i)})),compact,{index:0,total:3});
  for(const [i,c] of cards.entries()){
   const rect=atlasRect(c,i);
   assert.ok(Math.abs(rect.w/rect.h-c.w/c.h)<1e-9,'distorted '+c.id);
   assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.w<=1024&&rect.y+rect.h<=1024,c.id);
  }
 }
});
test('portrait inventory controls, pagination and item cards fit in the camera field',()=>{
 const aspect=300/700,limitX=PANEL_DISTANCE*FOV_TAN*aspect;
 const limitY=PANEL_DISTANCE*FOV_TAN;
 const scale=Math.min(PANEL_SCALE,limitX*.90/.45);
 const cards=cardGeometry('all',Array.from({length:5},(_,i)=>({name:String(i)})),true,{index:0,total:3});
 const close=cards.find(c=>c.id==='close');
 assert.equal(close.w,close.h);
 const anchor=createAnchor(player),eye=[player.x,player.y+player.eye,player.z];
 for(const c of cards){
  const left=(c.x-c.w/2)*scale,right=(c.x+c.w/2)*scale;
  const top=-.12+(c.y+c.h/2)*scale,bottom=-.12+(c.y-c.h/2)*scale;
  assert.ok(Math.max(Math.abs(left),Math.abs(right))<limitX,'horizontal clipping '+c.id);
  assert.ok(Math.max(Math.abs(top),Math.abs(bottom))<limitY,'vertical clipping '+c.id);
  const target=[anchor.center[0]+anchor.right[0]*c.x*scale+anchor.forward[0]*c.depth*scale,
   anchor.center[1]+c.y*scale,
   anchor.center[2]+anchor.right[2]*c.x*scale+anchor.forward[2]*c.depth*scale];
  const ray=normalize(target.map((v,i)=>v-eye[i]));
  assert.equal(spatialHit(anchor,cards,player,ray,scale)?.id,c.id);
 }
});
test('uploaded hologram UVs match the painted atlas rectangle',()=>{
 let vertices;
 const gl={ARRAY_BUFFER:34962,bindBuffer(){},bufferSubData(_target,_offset,data){vertices=data}};
 const hologram=Object.create(Hologram.prototype);
 hologram.gl=gl;hologram.buffer={};hologram.anchor=createAnchor(player);
 hologram.cards=cardGeometry('all',[],false);hologram.scale=PANEL_SCALE;
 hologram.buildGeometry();
 assert.equal(vertices.length,hologram.cards.length*36);
 const rect=atlasRect(hologram.cards[0],0);
 assert.ok(Math.abs(vertices[3]-rect.x/1024)<1e-6);
 assert.ok(Math.abs(vertices[4]-(1-rect.y/1024))<1e-6);
 assert.ok(Math.abs(vertices[9]-(rect.x+rect.w)/1024)<1e-6);
});


test('details, destination slots and quantity controls are ray-pickable',()=>{
 const anchor=createAnchor(player);
 for(const step of ['details','slots','quantity']){
  const cards=inspectionGeometry({step,name:'콘크리트',blockId:55,amount:2,
   actions:[['slots','빠른 슬롯'],['quantity','버리기']],slots:Array.from({length:7},()=>({blockId:null})),
   confirm:'2개 버리기'},false);
  for(const card of cards){
   assert.equal(spatialHit(anchor,cards,player,aimAt(anchor,card))?.id,card.id);
  }
 }
});

test('landscape pagination and inspection controls stay inside the camera after a viewport change',()=>{
 const h=Object.create(Hologram.prototype);
 const canvas={clientWidth:960,clientHeight:540};
 h.gl={canvas};h.compact=false;
 assert.equal(h.syncViewport(),false);
 const panels=[
  cardGeometry('all',Array.from({length:6},()=>({name:'Item'})),false,{index:0,total:2}),
  inspectionGeometry({step:'quantity',name:'Item',amount:1,confirm:'버리기'},false),
 ];
 for(const cards of panels)for(const card of cards){
  const limit=(PANEL_DISTANCE+card.depth*h.scale)*FOV_TAN;
  assert(Math.abs(card.y*h.scale-.12)+card.h*h.scale/2<limit,card.id);
 }
 canvas.clientWidth=380;canvas.clientHeight=780;
 assert.equal(h.syncViewport(),true);
 assert(h.compact);
});
