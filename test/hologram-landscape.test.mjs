import test from 'node:test';
import assert from 'node:assert/strict';
import {Hologram,PANEL_DISTANCE,atlasRect,hologramTextLayout} from '../src/client/hologram.js';
import {workspaceCards} from '../src/client/hologram-layout.js';
import {FOV_TAN} from '../src/client/camera.js';

const items=Array.from({length:12},(_,i)=>({id:i+1,name:'아이템 '+(i+1)}));
function assertTouchTargets(cards,scale){
 const overlap=(a,b)=>Math.abs(a.x-b.x)<(a.w+b.w)/2-.003&&Math.abs(a.y-b.y)<(a.h+b.h)/2-.003;
 for(const [i,c] of cards.entries()){
  const pixels=390*scale/(2*FOV_TAN*(PANEL_DISTANCE+c.depth*scale));
  if(!['label','empty','summary','detail','compact-summary'].includes(c.role)){
   assert.ok(c.w*pixels>=44&&c.h*pixels>=44,c.id+' is smaller than 44 CSS pixels');
  }
  assert.ok(Math.abs(c.x*pixels)+c.w*pixels/2<422-66,c.id+' is outside the card area');
  assert.ok(Math.abs((c.y-.12/scale)*pixels)+c.h*pixels/2<195,c.id+' is outside the viewport');
  assert.ok(cards.slice(i+1).every(b=>!overlap(c,b)),c.id+' overlaps another target');
 }
}

test('short landscape rearranges the projected bag, craft and container controls',()=>{
 const holo=Object.create(Hologram.prototype);
 holo.gl={canvas:{clientWidth:844,clientHeight:390}};holo.buildGeometry=()=>{};
 assert.equal(holo.syncViewport(),true);
 assert.equal(holo.landscape,true);
 for(const palette of ['all','craft','storage:stored']){
  const storage=palette.startsWith('storage:')?{carried:items,stored:items,label:'상자'}:null;
  const page={index:0,total:3};
  const cards=workspaceCards({palette,items,storage,page,landscape:holo.landscape});
  assertTouchTargets(cards,holo.scale);
  for(const step of ['details','quantity',...(!storage?['slots']:[])]){
   holo.setInventory(palette,items,-1,'hand',page,'all',null,{storage});
   holo.setInventory('inspection',[],-1,'hand',null,'all',{
    name:'아이템',step,amount:2,confirm:'확정',slots:items.slice(0,7),
    actions:[['slots','빠른 슬롯'],['move','슬롯 이동'],['quantity','버리기']]
   });
   assertTouchTargets(holo.cards,holo.scale);
   if(!storage){
    const index=holo.cards.findIndex(card=>card.role==='summary'),{w,h}=atlasRect(holo.cards[index],index);
    assert.equal(hologramTextLayout('summary',w,h).compact,false,'recipe ingredients and detail notes stay visible');
   }
  }
 }
 holo.gl.canvas={clientWidth:1688,clientHeight:780};
 assert.equal(holo.syncViewport(),true,'resize changes layout even at the same aspect ratio');
 assert.equal(holo.landscape,false);
});
