import test from 'node:test';
import assert from 'node:assert/strict';
import {Chunk} from '../src/core/chunk.js';
import {BLOCK as B} from '../src/core/blocks.js';
import {meshChunkData} from '../src/client/mesher.js';
import {makeTextureLayers} from '../src/client/textures.js';
import {readFileSync} from 'node:fs';

test('greedy faces use uniform authored shading instead of vertex AO',()=>{
 const c=new Chunk(0,0,32),set=(x,y,z)=>c.data[(y*16+z)*16+x]=B.STONE;
 set(8,8,8);set(7,9,8);set(8,9,7);set(7,9,7);
 const data=meshChunkData(c).opaque;
 assert.equal(data.length%7,0);
 assert.ok(data.every(Number.isFinite));
 // Vertex shades are constant within every emitted triangle.
 for(let i=0;i<data.length;i+=21)
  assert.ok(Math.abs(data[i+6]-data[i+13])<1e-6&&Math.abs(data[i+13]-data[i+20])<1e-6);
});
test('original material layers remain deterministic and keep their identifiers',()=>{
 const a=makeTextureLayers(),b=makeTextureLayers();
 assert.equal(a.size,32);assert.equal(a.data.length,a.layers*a.size*a.size*4);
 assert.deepEqual(a.data,b.data);
});
test('dome outer wall uses the same white tile material as enclosed passage wall',()=>{
 const library=readFileSync(new URL('../src/worldgen/eternal-night-library.js',import.meta.url),'utf8');
 const parts=readFileSync(new URL('../src/core/part-library.js',import.meta.url),'utf8');
 const city=readFileSync(new URL('../src/worldgen/eternal-night-game.js',import.meta.url),'utf8');
 assert.match(library,/const WALL=B\.ARCH_TILE_VERTICAL_WHITE/);
 assert.match(city,/cityPart\('wall',1\)/);
 assert.match(parts,/const mat=\[concretes\[3\],tiles\[0\]/);
});
test('both status progress rings have no glow shadow',()=>{
 const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
 const rule=css.match(/\.ring-fill\{([^}]+)\}/)?.[1]||'';
 assert.ok(rule.includes('transition:stroke-dasharray'));
 assert.doesNotMatch(rule,/(?:filter|box-shadow|text-shadow)/);
});
