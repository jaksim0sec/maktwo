import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('bag and crafting are distinct hologram views with available recipe filter',()=>{
 const game=read('src/client/game.js'),holo=read('src/client/hologram.js'),layout=read('src/client/hologram-layout.js');
 assert.match(game,/category==='all'\?CREATIVE_ITEMS\.filter/);
 assert.match(game,/knownRecipes\('bench'\)/);
 assert.match(game,/this\.inventory\.canCraft\(recipe,station\)/);
 assert.match(holo,/workspaceCards/);assert.match(layout,/view:inventory/);assert.match(layout,/view:craft/);
 assert.match(layout,/filter:available/);
});
test('arrow keys and enter navigate while C retains camera mode',()=>{
 const game=read('src/client/game.js'),input=read('src/client/input.js');
 assert.match(game,/this\.hologram\.moveFocus/);
 assert.match(game,/this\.inventoryClick\(this\.hologram\.focusedId\(\)\)/);
 assert.match(input,/!this\.inventoryMode&&k\.has\('ArrowUp'\)/);
 assert.match(game,/e\.code==='KeyC'/);
});
test('visible X and mobile taps can close/select the hologram',()=>{
 const page=read('index.html'),css=read('style.css'),game=read('src/client/game.js');
 assert.match(page,/id="inventory-close"/);
 assert.match(css,/body\.holo-open #inventory-close\{display:block\}/);
 assert.match(game,/bindClick\('inventory-close'/);
 assert.match(game,/this\.hologram\.pickAt/);
});
