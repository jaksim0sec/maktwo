// Append-only botanical block IDs. Species and fallen leaves are separate records.
// A tree is ONE placed anchor, not a stack of cube leaves.
export const TREE_ASSET_START=238;
export const TREE_SPECIES=Object.freeze([
 Object.freeze({key:'SAKURA',name:'Cherry blossom tree',label:'벚꽃나무',height:9.2,spread:4.8,bark:'#624b58',crown:['#ff47ad','#ff79cb','#ffb1df','#ef2c94','#ffe0ef'],litter:['#ff7ab8','#ffb1db','#f659a0','#ffe1f0']}),
 Object.freeze({key:'GINKGO',name:'Ginkgo tree',label:'은행나무',height:10.6,spread:3.8,bark:'#67675b',crown:['#ffd530','#ffe853','#ffb624','#fff27b','#f8a924'],litter:['#f9bf18','#ffe04d','#fff38a','#f2a521']}),
 Object.freeze({key:'MAPLE',name:'Japanese maple tree',label:'단풍나무',height:9.7,spread:4.3,bark:'#6b4a45',crown:['#ff5138','#f1263a','#ff7a2e','#ffad3c','#df1740'],litter:['#e83431','#ff7b2b','#d62442','#ffab35']}),
 Object.freeze({key:'GREEN',name:'Leafy broadleaf tree',label:'일반나무',height:10.2,spread:4.6,bark:'#665a43',crown:['#28d965','#54f278','#9dff52','#10965b','#5fda38'],litter:['#4da74b','#b3bb4b','#7d9d36','#b28445']})
]);
export const TREE_BLOCKS=Object.freeze(TREE_SPECIES.map((t,kind)=>Object.freeze({
 id:TREE_ASSET_START+kind,key:'TREE_'+t.key,kind,name:t.name,label:t.label,color:t.bark,render:'tree'
})));
export const FALLEN_LEAF_BLOCKS=Object.freeze(TREE_SPECIES.map((t,kind)=>Object.freeze({
 id:TREE_ASSET_START+4+kind,key:'FALLEN_'+t.key,name:t.name+' leaf scatter',
 label:t.label+' 낙엽',color:t.litter[0],kind,render:'leaf-litter'
})));
export const treeKind=id=>id>=TREE_ASSET_START&&id<TREE_ASSET_START+8
 ?(id-TREE_ASSET_START)&3:-1;
export const isTreeAnchor=id=>id>=TREE_ASSET_START&&id<TREE_ASSET_START+4;
export const isFallenLeaves=id=>id>=TREE_ASSET_START+4&&id<TREE_ASSET_START+8;
