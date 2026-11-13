// Append-only botanical block IDs. Species and fallen leaves are separate records.
// A tree is ONE placed anchor, not a stack of cube leaves.
export const TREE_ASSET_START=238;
export const TREE_SPECIES=Object.freeze([
 Object.freeze({key:'SAKURA',name:'Cherry blossom tree',label:'벚꽃나무',height:6.1,spread:3.0,bark:'#67515b',crown:['#d78aab','#e6aec1','#bb678c','#e1a0b4','#edc5cb'],litter:['#b981a1','#d8a9b8','#b8668f','#e0bcc4']}),
 Object.freeze({key:'GINKGO',name:'Ginkgo tree',label:'은행나무',height:7.2,spread:2.45,bark:'#676052',crown:['#c4a44f','#d7ba66','#a68a41','#d4b459','#e1c778'],litter:['#b69b4f','#ceb661','#a88d43','#d9be71']}),
 Object.freeze({key:'MAPLE',name:'Japanese maple tree',label:'단풍나무',height:6.4,spread:2.85,bark:'#634e49',crown:['#b95445','#c6724a','#974844','#d18a56','#a44b51'],litter:['#a95143','#be744d','#954543','#cd8959']}),
 Object.freeze({key:'GREEN',name:'Leafy broadleaf tree',label:'일반나무',height:7.0,spread:3.0,bark:'#635849',crown:['#4c8b64','#79a16d','#396d57','#92aa76','#5b906d'],litter:['#58835b','#92944e','#5d8350','#a19665']})
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
