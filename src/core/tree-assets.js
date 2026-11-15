// Append-only botanical block IDs. Species and fallen leaves are separate records.
// A tree is ONE placed anchor, not a stack of cube leaves.
export const TREE_ASSET_START=238;
export const TREE_SPECIES=Object.freeze([
 Object.freeze({key:'SAKURA',name:'Cherry blossom tree',label:'벚꽃나무',height:6.1,spread:3.0,bark:'#615552',crown:['#a68c85','#b8a198','#8b7564','#ac9289','#c2aca0'],litter:['#977c77','#a9948c','#896f65','#b6a396']}),
 Object.freeze({key:'GINKGO',name:'Ginkgo tree',label:'은행나무',height:7.2,spread:2.45,bark:'#676052',crown:['#99824f','#ac9659','#786b42','#a58d5b','#b6a071'],litter:['#927c4c','#a99658','#8d7545','#b09a62']}),
 Object.freeze({key:'MAPLE',name:'Japanese maple tree',label:'단풍나무',height:6.4,spread:2.85,bark:'#634e49',crown:['#805852','#9a674c','#71534b','#9d7555','#895d50'],litter:['#825a4b','#976347','#795148','#9d7355']}),
 Object.freeze({key:'GREEN',name:'Leafy broadleaf tree',label:'일반나무',height:7.0,spread:3.0,bark:'#635849',crown:['#566c4e','#778364','#405943','#82906b','#637955'],litter:['#58835b','#92944e','#5d8350','#a19665']})
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
