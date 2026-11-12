import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLightVolume,makeOccluderSnapshot,LIGHT_WIDTH,LIGHT_HEIGHT,LIGHT_DEPTH} from '../src/core/lightVolume.js';
import {World} from '../src/core/world.js';
import {BLOCK as B} from '../src/core/blocks.js';

const at=(volume,x,y,z,width,height)=>volume[(((z*height)+y)*width+x)*4];
const small=(blocks,sources,width=17,height=9,depth=17)=>buildLightVolume(blocks,sources,{width,height,depth,origin:[0,0,0]});
test('solid walls occlude the other side instead of transmitting point light',()=>{
 const width=17,height=9,depth=17,occupancy=new Uint8Array(width*height*depth);
 for(let z=0;z<depth;z++)for(let y=0;y<height;y++)occupancy[(z*height+y)*width+8]=1;
 const src=[{x:4.5,y:4.5,z:8.5,radius:10,intensity:1,rgb:[1,.55,.26]}];
 const lights=small(occupancy,src,width,height,depth);
 assert.ok(at(lights,7,4,8,width,height)>100,'near side of wall receives amber light');
 assert.equal(at(lights,9,4,8,width,height),0,'air behind continuous wall is dark');
 assert.equal(at(lights,14,4,8,width,height),0,'shadow persists beyond the wall');
});
test('light travels through a doorway and can wrap around an opening',()=>{
 const width=17,height=9,depth=17,blocks=new Uint8Array(width*height*depth);
 for(let z=0;z<depth;z++)for(let y=0;y<height;y++)blocks[(z*height+y)*width+8]=1;
 blocks[(8*height+4)*width+8]=0;
 const lights=small(blocks,[{x:4.5,y:4.5,z:8.5,radius:11,intensity:1,rgb:[1,.55,.26]}],width,height,depth);
 assert.ok(at(lights,9,4,8,width,height)>0,'open doorway transmits light');
 assert.ok(at(lights,9,4,3,width,height)<at(lights,9,4,8,width,height)*.25,'the wall preserves a strong side shadow');
});
test('one lamp produces an amber local gradient with no overbright additive clipping',()=>{
 const width=17,height=9,depth=17,blocks=new Uint8Array(width*height*depth);
 const lamp={x:8.5,y:4.5,z:8.5,radius:8,intensity:1.1,rgb:[1,.58,.28]};
 const a=small(blocks,[lamp],width,height,depth),b=small(blocks,[lamp,lamp,lamp],width,height,depth);
 const p=(((8*height+4)*width+8)*4),q=(((8*height+4)*width+13)*4);
 assert.ok(a[p]>a[q]);assert.ok(a[p]>a[p+1]*1.2&&a[p+1]>a[p+2]);
 assert.ok(b[p]<=255&&b[p] > a[p] && b[p] < a[p]*2,'multiple lamps compress instead of blowing out colors');
});
test('occlusion snapshot reads loaded chunks without generating new chunks',()=>{
 const world=new World({mode:'flat'});world.set(4,30,4,B.STONE);world.set(5,30,4,B.TORCH);
 const count=world.chunks.size,origin=[-32,0,-32],snapshot=makeOccluderSnapshot(world,origin);
 assert.equal(snapshot.length,LIGHT_WIDTH*LIGHT_HEIGHT*LIGHT_DEPTH);
 assert.equal(world.chunks.size,count);
 const idx=(x,y,z)=>(((z-origin[2])*LIGHT_HEIGHT+y)*LIGHT_WIDTH)+(x-origin[0]);
 assert.equal(snapshot[idx(4,30,4)],1);assert.equal(snapshot[idx(5,30,4)],0);
});
