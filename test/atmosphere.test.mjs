import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LIGHTBAR,block} from '../src/core/blocks.js';

const read=name=>readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
test('light profiles use restrained, distinctly amber illumination',()=>{
 for(const id of LIGHTBAR){const {radius,intensity,color}=block(id).light;
  assert.ok(radius>=15&&radius<=18,'each fixture should have a restrained local radius');
  assert.ok(intensity>=.9&&intensity<=1.15,'warm centers should not overwhelm the frame');
  const red=parseInt(color.slice(1,3),16),green=parseInt(color.slice(3,5),16),blue=parseInt(color.slice(5,7),16);
  assert.ok(red>green*1.3&&green>blue*1.35,'fixture should have visible orange warmth');
 }
});
test('night uses a horizon gradient and a bounded, soft light falloff',()=>{
 const source=read('src/client/renderer.js');
 assert.match(source,/const SKY_FRAG=/);
 assert.match(source,/smoothstep\(uHorizon/);
 assert.match(source,/gl\.drawArrays\(gl\.TRIANGLES,0,3\)/);
 assert.match(source,/falloff\*falloff\*\(1\.5-\.5\*falloff\)/);
 assert.match(source,/uniform1f\(this\.u\.brightness,\.35\)/);
 assert.doesNotMatch(source,/const fog=\[\.046,\.056,\.085\]/);
});
test('spatial bag provides a no-escape item selection path',()=>{
 const html=read('index.html'),game=read('src/client/game.js'),css=read('style.css');
 for(const id of ['screen','bag-btn','spatial-layer','inventory-list','inventory-resume','inventory-close','preview-name'])assert.match(html,new RegExp(`id="${id}"`));
 assert.match(game,/e\.code==='KeyE'\|\|e\.code==='KeyI'/);
 assert.match(game,/this\.requestGameFocus\(\)/);
 assert.match(game,/this\.input\.setUiMode\(this\.uiOpen\)/);
 assert.match(css,/perspective:1450px/);
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 for(const [,id] of game.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.has(id),`missing DOM element #${id}`);
});
