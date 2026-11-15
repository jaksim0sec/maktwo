import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {workspaceCards,HOLOGRAM_PLUGINS} from '../src/client/hologram-layout.js';
import {inspectionGeometry,atlasRect} from '../src/client/hologram.js';
import {orderInventoryIds,SurvivalInventory} from '../src/core/inventory.js';
const items=Array.from({length:12},(_,i)=>({id:i+1,name:'소지품 '+(i+1),count:i+1}));
function overlapping(a,b){return Math.abs(a.x-b.x)<(a.w+b.w)/2-.003&&Math.abs(a.y-b.y)<(a.h+b.h)/2-.003}
test('the same bounded workspace supports bag, craft and two-sided container content',()=>{
 assert.deepEqual(Object.keys(HOLOGRAM_PLUGINS),['inventory','craft','storage']);
 for(const compact of [false,true])for(const palette of ['all','craft','storage:stored']){
  const storage=palette.startsWith('storage:')?{carried:items,stored:items,label:'상자'}:null;
  const cards=workspaceCards({palette,items,compact,storage,page:{index:0,total:3}});
  assert(cards.length<=40);assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);
  assert(cards.some(c=>c.id==='close'));assert(cards.some(c=>c.id==='quick:0'));
  assert(cards.every(c=>Math.abs(c.x)+c.w/2<(compact?.47:1.18)));
  for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++)
   assert(!overlapping(cards[i],cards[j]),'Overlap '+cards[i].id+' '+cards[j].id);
  if(storage){
   assert(cards.some(c=>c.id==='item:carried:0'));
   assert(cards.some(c=>c.id==='item:stored:0'));
   assert(!cards.some(c=>c.id==='view:craft'),'container reuses the shell without unrelated tabs');
  }else{
   assert(cards.some(c=>c.id==='view:inventory'));
   assert(cards.some(c=>c.id==='view:craft'));
  }
 }
});
test('item identity remains a pickable card ID rather than a numeric inventory ID',()=>{
 const cards=workspaceCards({palette:'all',items:items.slice(0,2)});
 assert.equal(cards.find(c=>c.id==='item:0').blockId,1);
 assert.equal(cards.find(c=>c.id==='item:1').blockId,2);
});
test('atlas accommodates the expanded card capacity without stretched UV aspect',()=>{
 const cards=workspaceCards({palette:'storage:stored',compact:false,
  storage:{carried:items,stored:items,label:'상자'},page:{index:0,total:2}});
 for(const [i,c] of cards.entries()){const r=atlasRect(c,i);
  assert(Math.abs(r.w/r.h-c.w/c.h)<1e-9);
  assert(r.x>=0&&r.y>=0&&r.x+r.w<=2048&&r.y+r.h<=1024);
 }
});
test('inventory ordering is display-only and survives the version 2 save format',()=>{
 const storage={data:new Map(),getItem(key){return this.data.get(key)??null},setItem(key,val){this.data.set(key,val)}};
 const inv=new SurvivalInventory(storage,'holo-test');
 const ids=[...inv.items.keys()];
 assert(ids.length>=2);
 const [first,second]=ids;
 assert.equal(inv.reorder(second,first),true);
 assert.equal(inv.orderedIds(ids)[0],second);
 const saved=JSON.parse(storage.getItem(inv.key));
 assert.deepEqual(saved.itemOrder.slice(0,2),[second,first]);
 const restored=new SurvivalInventory(storage,'holo-test');
 assert.equal(restored.orderedIds(ids)[0],second);
 assert.deepEqual(orderInventoryIds([4,2,9],[9,4]),[9,4,2]);
});
test('details occupy the contextual region without discarding the underlying item grid',()=>{
 const base=workspaceCards({palette:'all',items,compact:false});
 const detail=inspectionGeometry({step:'details',name:'상세 정보',blockId:1,info:'설명',
  actions:[['slots','빠른 슬롯'],['quantity','버리기']]},false);
 assert(base.some(c=>c.id==='item:0'));
 assert(detail.some(c=>c.id==='inspect:summary'));
 const left=base.filter(c=>c.role==='item');
 for(const card of left)for(const right of detail)
  assert(!overlapping(card,right),'Detail overlaps item '+card.id);
});
test('single-touch hologram drag captures item pointers without freezing outside camera gestures',()=>{
 const game=readFileSync(new URL('../src/client/game.js',import.meta.url),'utf8');
 const input=readFileSync(new URL('../src/client/input.js',import.meta.url),'utf8');
 assert.match(game,/hologram\.containsAt/);
 assert.doesNotMatch(game,/holoLastTap/);
 assert.match(game,/hologramDrop\(drag.source,target\)/);
 assert.match(input,/hologramCaptured\.add/);
 assert.match(input,/hologramCamera\.set/);
});
