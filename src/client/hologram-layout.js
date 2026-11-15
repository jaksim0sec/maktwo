// Shared world-space hologram layout. A mode supplies content, never a second shell.
// Every card uses the same measurements, text rules and pointer target geometry.
const make=(id,name,x,y,w,h,role='control',extra={})=>({...extra,id,name,x,y,w,h,role,depth:-.045});
function evenlySpaced(entries,y,left,right,height,role='filter'){
 const step=(right-left)/entries.length;
 return entries.map(([id,name],i)=>make(id,name,left+step*(i+.5),y,step-.018,height,role));
}
function quickBar(slots=[],compact=false){
 return Array.from({length:7},(_,i)=>{
  const slot=slots[i]||{},cols=compact?7:7;
  const gap=compact?.125:.305;
  return make('quick:'+i,String(i+1),(i-(cols-1)/2)*gap,compact?-.88:-.86,
   compact?.115:.27,compact?.15:.19,'quick',{blockId:slot.blockId??null,count:slot.count??0});
 });
}
function bagContent({items,compact,page,craftFilter,palette}){
 const result=[],craft=palette==='craft';
 if(compact){
  const filters=craft?[['filter:all','전체'],['filter:available','가능']]:
   [['tab:all','전체'],['tab:blocks','블록'],['tab:parts','부품'],['tab:trees','수목'],['tab:items','소품']];
  result.push(...evenlySpaced(filters.slice(0,3),.58,-.45,.45,.15));
  if(filters.length>3)result.push(...evenlySpaced(filters.slice(3),.40,-.45,.45,.15));
  const start=filters.length>3?.19:.39;
  items.slice(0,6).forEach((item,i)=>result.push(make('item:'+i,item.name,
   (i%3-1)*.29,start-Math.floor(i/3)*.24,.266,.215,'item',{...item,blockId:item.id,variant:'grid'})));
 }else{
  const filters=craft?[['filter:all','전체 레시피'],['filter:available','제작 가능']]:
   [['tab:all','전체'],['tab:blocks','블록'],['tab:parts','부품'],['tab:trees','수목'],['tab:items','소품']];
  result.push(...evenlySpaced(filters,.56,-1.12,craft?-.10:1.10,.18));
  const columns=craft?3:4,step=craft?.46:.36,width=craft?.42:.324;
  items.slice(0,craft?9:12).forEach((item,i)=>result.push(make('item:'+i,item.name,
   -.93+(i%columns)*step,.30-Math.floor(i/columns)*.29,width,.255,'item',
   {...item,blockId:item.id,variant:'grid'})));
 }
 if(!items.length)result.push(make('empty',craft?'제작법이 없습니다':'소지품이 비었습니다',
  compact?0:-.40,compact?0:-.02,compact?.78:1.25,.28,'empty'));
 if(page?.total>1){
  result.push(...evenlySpaced([['page:prev','‹ 이전'],['page:next',`다음 ${page.index+1}/${page.total} ›`]],
   compact?-.66:-.62,compact?-.44:-1.12,compact?.44:-.10,compact?.16:.19,'page'));
 }
 return result;
}
function storageContent({storage,compact,page}){
 const result=[];
 if(compact){
  result.push(...evenlySpaced([['storage:carried','내 소지품'],['storage:stored',storage.label||'보관함']],.59,-.44,.44,.18,'label'));
  // Two visible inventories, not two separate menu pages.
  for(const [side,x] of [['carried',-.215],['stored',.215]]){
   (storage[side]||[]).slice(0,4).forEach((item,i)=>result.push(make('item:'+side+':'+i,item.name,x,
    .33-i*.23,.38,.205,'item',{...item,blockId:item.id,variant:'grid',side})));
  }
 }else{
  result.push(make('storage:carried','내 소지품',-.60,.56,1.01,.20,'label'));
  result.push(make('storage:stored',storage.label||'보관함',.60,.56,1.01,.20,'label'));
  for(const [side,startX] of [['carried',-.88],['stored',.35]]){
   (storage[side]||[]).slice(0,8).forEach((item,i)=>result.push(make('item:'+side+':'+i,item.name,
    startX+(i%2)*.44,.32-Math.floor(i/2)*.225,.41,.205,'item',{...item,blockId:item.id,variant:'grid',side})));
  }
 }
 if(page?.total>1)result.push(...evenlySpaced([['page:prev','‹'],['page:next',`${page.index+1}/${page.total} ›`]],
  compact?-.66:-.64,compact?-.42:-.46,compact?.42:.46,compact?.13:.17,'page'));
 return result;
}
export const HOLOGRAM_PLUGINS=Object.freeze({
 inventory:bagContent,
 craft:bagContent,
 storage:storageContent
});
export function workspaceCards({palette='all',items=[],compact=false,page=null,craftFilter='all',
 quickSlots=[],storage=null,selectedId=null}={}){
 const isStorage=Boolean(storage)||palette.startsWith('storage:'),mode=isStorage?'storage':palette==='craft'?'craft':'inventory';
 const cards=[];
 if(isStorage)cards.push(make('holo:title',storage?.label||'보관함',compact?-.18:-.65,.81,compact?.55:.86,.21,'label'));
 else{
  cards.push(make('view:inventory','소지품',compact?-.275:-.81,.81,compact?.27:.48,.21,'view'));
  cards.push(make('view:craft','제작',compact?.02:-.31,.81,compact?.23:.43,.21,'view'));
 }
 cards.push(make('close','✕',compact?.39:1.05,.81,compact?.15:.22,compact?.15:.22,'close'));
 cards.push(...HOLOGRAM_PLUGINS[mode]({items,compact,page,craftFilter,palette,storage:storage||{}}));
 if(!isStorage){
  cards.push(make('info:summary',selectedId==null?'아이템을 선택하세요':'선택한 아이템',
   compact?0:.72,compact?-.485:.14,compact?.86:.81,compact?.14:.52,'detail',{blockId:selectedId}));
  if(!compact){
   cards.push(make('info:shortcut','빠른 슬롯에 배치',.72,-.30,.81,.20,'action'));
   cards.push(make('hand','맨손',.72,-.57,.81,.16,'control'));
  }
 }
 cards.push(...quickBar(quickSlots,compact));
 if(cards.length>40)throw Error('Hologram atlas capacity exceeded: '+cards.length);
 return cards;
}
