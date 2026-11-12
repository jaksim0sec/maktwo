import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LIGHTBAR,block} from '../src/core/blocks.js';

const read=name=>readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
test('light profiles use restrained, distinctly amber illumination',()=>{
 for(const id of LIGHTBAR){const {radius,intensity,color}=block(id).light;
  assert.ok(radius>=9&&radius<=11,'fixtures should have warm but tightly bounded local reach');
  assert.ok(intensity>=.7&&intensity<=.85,'warm centers should not overwhelm the frame');
  const red=parseInt(color.slice(1,3),16),green=parseInt(color.slice(3,5),16),blue=parseInt(color.slice(5,7),16);
  assert.ok(red>green*1.35&&green>blue*1.35,'fixture should have visible orange warmth');
 }
});
test('night uses a horizon gradient and a bounded, soft light falloff',()=>{
 const source=read('src/client/renderer.js');
 assert.match(source,/const SKY_FRAG=/);
 assert.match(source,/smoothstep\(uHorizon/);
 assert.match(source,/gl\.drawArrays\(gl\.TRIANGLES,0,3\)/);
 assert.match(source,/uLightVolume/);
 assert.match(source,/texelFetch\(uLightVolume/);
 assert.match(source,/uniform1f\(this\.u\.brightness,\.35\)/);
 assert.doesNotMatch(source,/const fog=\[\.046,\.056,\.085\]/);
});
test('hologram inventory renders in WebGL instead of a separate DOM overlay',()=>{
 const html=read('index.html'),game=read('src/client/game.js'),hologram=read('src/client/hologram.js');
 for(const id of ['screen','bag-btn','hotbar','toolbar'])assert.match(html,new RegExp(`id="${id}"`));
 assert.doesNotMatch(html,/id="spatial-layer"/);
 assert.match(game,/e.code==='KeyE'\|\|e.code==='KeyI'/);
 assert.match(game,/this\.input\.setUiMode\(this\.uiOpen&&this\.panel!=='inventory'\)/);
 assert.match(game,/this\.input\.setInventoryMode\(this\.panel==='inventory'\)/);
 assert.match(game,/this\.hologram\.open\(this\.player\)/);
 assert.match(hologram,/gl\.drawArrays\(gl\.TRIANGLES,0,this\.count\)/);
 assert.match(hologram,/gl\.enable\(gl\.DEPTH_TEST\)/);
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 for(const [,id] of game.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.has(id),`missing DOM element #${id}`);
});
