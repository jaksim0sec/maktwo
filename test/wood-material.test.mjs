import test from 'node:test';
import assert from 'node:assert/strict';
import {makeTextureLayers,materialFor,barkGrain,endGrain,plankGrain,TEXTURE_SIZE} from '../src/client/textures.js';
import {BLOCK} from '../src/core/blocks.js';
const values=(material)=>{const {data,size}=makeTextureLayers(),stride=size*size*4,offset=(material-1)*stride;const a=[];for(let y=0;y<size;y++){a[y]=[];for(let x=0;x<size;x++)a[y][x]=data[offset+(y*size+x)*4]}return a};
test('wood bark grain is mostly vertical, without fixed horizontal y%6 stripes',()=>{
 const bark=values(materialFor(BLOCK.WOOD,0));let hd=0,vd=0;
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){
  hd+=Math.abs(bark[y][x]-bark[y][(x+1)%32]);
  vd+=Math.abs(bark[y][x]-bark[(y+1)%32][x]);
 }
 assert.ok(hd>vd*1.15,`bark should flow vertically; horizontal changes=${hd}, vertical=${vd}`);
 assert.ok(bark[5][5]!==bark[11][5]);
 assert.ok(Math.abs(barkGrain(4,2,32)-barkGrain(4,17,32))<.3);
});
test('wood ends show growth rings and planks subtle seams, all within one 32px material layer',()=>{
 const end=values(materialFor(BLOCK.WOOD,2));
 const plank=values(materialFor(BLOCK.PLANKS,0));
 const spread=layer=>Math.max(...layer.flat())-Math.min(...layer.flat());
 assert.ok(spread(end)>27);assert.ok(spread(plank)>20);
 assert.ok(endGrain(1,2,TEXTURE_SIZE)!==endGrain(17,18,TEXTURE_SIZE));
 assert.ok(plankGrain(10,0,32)<plankGrain(10,5,32));
 const atlas=makeTextureLayers();assert.equal(atlas.data.byteLength,atlas.layers*32*32*4);
});
