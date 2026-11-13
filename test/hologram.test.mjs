import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cardGeometry,createAnchor,spatialHit,Hologram,PANEL_SCALE} from '../src/client/hologram.js';

const player={x:2,y:35,z:4,eye:1.7,yaw:0,pitch:0,direction(){return{x:0,y:0,z:-1}}};
const normalize=p=>{const n=Math.hypot(...p);return p.map(v=>v/n)};
const aimAt=(anchor,card)=>normalize([
 anchor.center[0]+anchor.right[0]*card.x*PANEL_SCALE+anchor.forward[0]*card.depth*PANEL_SCALE-player.x,
 anchor.center[1]+card.y*PANEL_SCALE-(player.y+player.eye),
 anchor.center[2]+anchor.right[2]*card.x*PANEL_SCALE+anchor.forward[2]*card.depth*PANEL_SCALE-player.z,
]);
test('spatial bag consists of small separated in-world tiles, no fullscreen slab',()=>{
 const cards=cardGeometry('blocks',Array.from({length:10},(_,i)=>({name:`Block ${i}`,color:'#456789'})));
 assert.equal(cards.length,18);
 assert.ok(cards.filter(c=>c.role==='item').every(c=>c.w<.52&&c.h<.48));
 assert.ok(cards.some(c=>c.id==='view:inventory')&&cards.some(c=>c.id==='view:craft'));
 assert.equal(cards.find(c=>c.id==='close').name,'✕');
 assert.equal(cards.filter(c=>c.id.startsWith('item:')).length,10);
 assert.ok(cards.some(c=>c.id==='hand'));
});
test('world-anchored inventory ray-picks each card and empty hand',()=>{
 const anchor=createAnchor(player),cards=cardGeometry('blocks',Array.from({length:10},(_,i)=>({name:`Block ${i}`})));
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
 h.opened=true;h.cards=cardGeometry('all',Array.from({length:10},(_,i)=>({name:String(i)})));
 h.focusId='item:0';h.keyboardMode=false;
 assert.equal(h.moveFocus('right'),'item:1');
 assert.equal(h.moveFocus('down'),'item:6');
 assert.equal(h.focusedId(),'item:6');
});
test('craft list makes available recipes visually distinct',()=>{
 const cards=cardGeometry('craft',[{name:'목재',id:9,craftable:true,recipe:{count:4}}]);
 assert.ok(cards.some(c=>c.id==='filter:available'));
 assert.ok(cards.some(c=>c.id==='view:inventory'));
 assert.equal(cards.find(c=>c.id==='item:0').craftable,true);
});
