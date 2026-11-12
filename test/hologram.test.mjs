import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cardGeometry,createAnchor,spatialHit} from '../src/client/hologram.js';

const player={x:2,y:35,z:4,eye:1.7,yaw:0,pitch:0,direction(){return{x:0,y:0,z:-1}}};
const normalize=p=>{const n=Math.hypot(...p);return p.map(v=>v/n)};
const aimAt=(anchor,card)=>normalize([
 anchor.center[0]+anchor.right[0]*card.x+anchor.forward[0]*card.depth-player.x,
 anchor.center[1]+card.y-(player.y+player.eye),
 anchor.center[2]+anchor.right[2]*card.x+anchor.forward[2]*card.depth-player.z,
]);
test('spatial bag consists of small separated in-world tiles, no fullscreen slab',()=>{
 const cards=cardGeometry('blocks',Array.from({length:10},(_,i)=>({name:`Block ${i}`,color:'#456789'})));
 assert.equal(cards.length,15);
 assert.ok(cards.every(c=>c.w<.5&&c.h<.4));
 assert.equal(cards.filter(c=>c.id.startsWith('item:')).length,10);
 assert.ok(cards.some(c=>c.id==='hand'));
});
test('world-anchored inventory ray-picks each card and empty hand',()=>{
 const anchor=createAnchor(player),cards=cardGeometry('blocks',Array.from({length:10},(_,i)=>({name:`Block ${i}`})));
 for(const card of cards){const ray=aimAt(anchor,card);assert.equal(spatialHit(anchor,cards,player,ray)?.id,card.id)}
 assert.equal(spatialHit(anchor,cards,player,[0,1,0]),null);
});
test('spatial inventory placement follows the players pitch but not later camera movement',()=>{
 const angled={...player,pitch:-.72};const anchor=createAnchor(angled);
 assert.ok(anchor.center[1]<player.y+player.eye-1);
 const before=structuredClone(anchor);angled.yaw=1;angled.pitch=.5;
 assert.deepEqual(anchor,before,'world-space anchor must not follow a later camera turn');
});
test('hologram enables the real scene depth buffer instead of rendering through walls',()=>{
 const fs=readFileSync(new URL('../src/client/hologram.js',import.meta.url),'utf8');
 assert.match(fs,/gl\.enable\(gl\.DEPTH_TEST\)/);
 assert.doesNotMatch(fs,/gl\.disable\(gl\.DEPTH_TEST\)/);
});
