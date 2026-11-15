import test from 'node:test';
import assert from 'node:assert/strict';
import {cardGeometry,inspectionGeometry,atlasRect,hologramTextLayout,hologramControlFont} from '../src/client/hologram.js';

test('inventory and crafting tiles reserve separate bands for icon, name and status',()=>{
 for(const compact of [false,true])for(const palette of ['all','craft']){
  const item=cardGeometry(palette,[{id:8,name:'나무 울타리',count:3,craftable:true}],compact)
   .find(card=>card.id==='item:0');
  const atlas=atlasRect(item,0);
  const layout=hologramTextLayout('grid',atlas.w,atlas.h);
  assert(layout.iconTop+layout.iconSize+3<=layout.titleY-layout.titleSize,
   'icon and name overlap at '+palette+'/'+compact);
  assert(layout.titleY+3<=layout.statusY-layout.statusSize,
   'name and status overlap at '+palette+'/'+compact);
  assert(layout.statusY<=atlas.h-3,'status escapes card');
 }
});
test('landscape detail title, icon, information and note occupy distinct vertical bands',()=>{
 const card=inspectionGeometry({name:'나무 판자',info:'16개 · 설치할 수 있는 건축재',note:'빠른 슬롯'},false)
   .find(card=>card.id==='inspect:summary');
 const atlas=atlasRect(card,0),layout=hologramTextLayout('summary',atlas.w,atlas.h);
 assert.equal(layout.compact,false);
 assert(layout.iconTop+layout.iconSize+3<=layout.titleY-layout.titleSize);
 assert(layout.titleY+3<=layout.infoY-layout.infoSize);
 assert(layout.infoY+3<=layout.noteY-layout.noteSize);
 assert(layout.noteY<=atlas.h-3);
});
test('short portrait summary has one readable centered label, not three crowded lines',()=>{
 const card=inspectionGeometry({name:'나무 판자',info:'상세',note:'메모'},true).find(card=>card.id==='inspect:summary');
 const atlas=atlasRect(card,0),layout=hologramTextLayout('summary',atlas.w,atlas.h);
 assert.equal(layout.compact,true);
 assert(layout.titleSize>=18);
 assert.equal(layout.iconSize,0);
});
test('tabs and small action buttons share legible typography without changing their hitboxes',()=>{
 assert(hologramControlFont('view',180,80)>=22);
 assert(hologramControlFont('filter',180,65)>=22);
 assert(hologramControlFont('action',180,120)>=24);
 const actions=inspectionGeometry({name:'나무 판자',step:'details',actions:[['slots','빠른 슬롯'],['move','슬롯 이동'],['quantity','버리기']]},false)
  .filter(card=>card.role==='action');
 assert.equal(actions.length,3);
 assert(actions.every(card=>Math.abs(card.w-actions[0].w)<1e-9&&Math.abs(card.h-actions[0].h)<1e-9));
});
