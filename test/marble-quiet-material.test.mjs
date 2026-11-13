import test from 'node:test';
import assert from 'node:assert/strict';
import {BLOCK as B} from '../src/core/blocks.js';
import {makeTextureLayers,materialFor} from '../src/client/textures.js';
import {sampleDetailedMaterial} from '../src/client/material-art.js';

const materials=[
 {id:B.MARBLE,group:'extra',index:1},
 {id:B.ARCH_STONE_MARBLE,group:'architecture',index:9}
];

test('marble materials retain separate stable 32px layers with restrained veining',()=>{
 const atlas=makeTextureLayers();
 assert.equal(atlas.size,32);assert.equal(atlas.layers,98);
 assert.deepEqual(materials.map(({id})=>materialFor(id,0)),[92,50]);
 const signatures=[];
 for(const {id,group,index} of materials){
  const shades=[],colors=new Set(),layer=materialFor(id,0)-1;
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
   const pixel=sampleDetailedMaterial(group,index,x,y);
   assert.deepEqual(pixel,sampleDetailedMaterial(group,index,x,y));
   const [light,r,g,b]=pixel;
   assert.ok(pixel.every(Number.isFinite));
   shades.push(light);
   colors.add(pixel.map(v=>Math.round(v*255)).join(','));
   const offset=(layer*32*32+y*32+x)*4;
   for(const [channel,multiplier] of [r,g,b].entries())
    assert.equal(atlas.data[offset+channel],Math.round(Math.min(255,255*light*multiplier)));
  }
  assert.ok(colors.size>45);
  const mean=shades.reduce((a,b)=>a+b,0)/shades.length;
  const spread=Math.sqrt(shades.reduce((a,b)=>a+(b-mean)**2,0)/shades.length);
  assert.ok(spread>.012&&spread<.05,`marble must have restrained organic pigment, spread=${spread}`);
  assert.ok(Math.min(...shades)>.86,'no repeatedly engraved dark motifs');
  signatures.push(shades.join(','));
 }
 assert.notEqual(signatures[0],signatures[1],'both marble finishes stay distinct');
});
