import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('world-space inventory remains visible as a faint occluded silhouette',()=>{
 const s=file('src/client/hologram.js');
 assert.match(s,/gl\.depthFunc\(gl\.GREATER\)/);
 assert.match(s,/gl\.depthFunc\(gl\.LEQUAL\)/);
 assert.match(s,/gl\.uniform1f\(this\.u\.opacity,\.32\)/);
 assert.match(s,/gl\.depthFunc\(gl\.LESS\)/);
});
test('PWA loads fresh online modules and falls back to cache offline',()=>{
 const sw=file('sw.js');
 assert.match(sw,/maktwo-shell-v1\.3\.0/);
 const pos=sw.indexOf('  // Network-first for source files');
 assert.ok(pos>=0);
 const network=sw.indexOf('await fetch\(request\)',pos); // literal index check in next assertion
 assert.match(sw.slice(pos),/await fetch\(request\)/);
 assert.match(sw.slice(pos),/cache\.match\(request,\{ignoreSearch:true\}\)/);
 assert.match(file('index.html'),/controllerchange/);
});
test('render frame failures show a visible diagnostic instead of silently freezing',()=>{
 const game=file('src/client/game.js');
 assert.match(game,/scheduleFrame\(\)/);
 assert.match(game,/Frame error/);
 assert.match(game,/el\.hidden=false/);
});
