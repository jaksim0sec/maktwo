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
test('PWA installs one complete versioned asset set and never mixes revisioned source files',()=>{
 const sw=file('sw.js');
 assert.match(sw,/maktwo-shell-v1\.6\.1/);
 assert.match(sw,/cache\.addAll/);
 assert.match(sw,/cache:'reload'/);
 assert.match(sw,/await cache\.match\(url\)/);
 assert.doesNotMatch(sw,/ignoreSearch:true|cache\.put\(request/);
 assert.match(sw,/CANONICAL_ASSETS/);
 assert.match(file('src/client/pwa.js'),/registration\.update\(\)/);
});
test('render frame failures show a visible diagnostic instead of silently freezing',()=>{
 const game=file('src/client/game.js');
 assert.match(game,/scheduleFrame\(\)/);
 assert.match(game,/Frame error/);
 assert.match(game,/el\.hidden=false/);
});
