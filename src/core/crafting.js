import {BLOCK as B} from './blocks.js';

// Recipes are data, not UI decisions. A shaped recipe is a small matrix;
// the same schema will support furnaces and future dedicated stations.
const make=(name,id,count,station,pattern,key,label)=>{
 const width=Math.max(...pattern.map(s=>s.length));
 if(width>(station==='bench'?3:2)||pattern.length>(station==='bench'?3:2))throw Error('Recipe exceeds station grid');
 const needs={};
 for(const row of pattern)for(const c of row){if(c===' ')continue;const item=key[c];if(!Number.isInteger(item))throw Error(`Unknown ingredient ${c}`);needs[item]=(needs[item]||0)+1}
 return Object.freeze({name,id,count,station,pattern:Object.freeze(pattern),key:Object.freeze(key),needs:Object.freeze(needs),label});
};
export const RECIPES=Object.freeze([
 make('planks',B.PLANKS,4,'hand',['W'],{W:B.WOOD},'나무 판자 ×4'),
 make('torch',B.TORCH,4,'hand',['P','P'],{P:B.PLANKS},'횃불 ×4'),
 make('workbench',B.WORKBENCH,1,'hand',['PP','PP'],{P:B.PLANKS},'작업대'),
 make('door',B.DOOR,1,'bench',['PP','PP','PP'],{P:B.PLANKS},'나무 문'),
 make('fence',B.FENCE,3,'bench',['PPP','P P'],{P:B.PLANKS},'나무 울타리 ×3'),
 make('path',B.PATH,4,'bench',['CC'],{C:B.COBBLE},'돌길 ×4'),
 make('lantern',B.LANTERN,1,'bench',[' O ','OTO',' O '],{O:B.ORE,T:B.TORCH},'랜턴'),
 make('glass',B.GLASS,2,'bench',['SS','SS'],{S:B.SAND},'유리 ×2'),
 make('stone_stairs',B.STONE_STAIRS,4,'bench',['C  ','CC ','CCC'],{C:B.COBBLE},'돌 계단 ×4'),
 make('wood_stairs',B.WOOD_STAIRS,4,'bench',['P  ','PP ','PPP'],{P:B.PLANKS},'나무 계단 ×4'),
 make('stone_slab',B.STONE_SLAB,6,'bench',['CCC'],{C:B.COBBLE},'돌 반블록 ×6'),
 make('wood_slab',B.WOOD_SLAB,6,'bench',['PPP'],{P:B.PLANKS},'나무 반블록 ×6'),
 make('chair',B.CHAIR,1,'bench',['P P','PPP','P P'],{P:B.PLANKS},'나무 의자'),
 make('flower_pot',B.FLOWER_POT,2,'hand',['C C',' C '],{C:B.COBBLE},'꽃 화분 ×2'),
]);
export const recipeByName=name=>RECIPES.find(r=>r.name===name)||null;
export function recipeGrid(recipe){const grid=Array(9).fill(0);if(!recipe)return grid;
 recipe.pattern.forEach((row,y)=>[...row].forEach((sym,x)=>{if(sym!==' ')grid[y*3+x]=recipe.key[sym]}));return grid;
}
// Require the real shape, regardless of its offset within the 3x3 station.
export function matchesPattern(grid,recipe){if(!recipe||!Array.isArray(grid)||grid.length!==9)return false;
 const expected=recipeGrid(recipe);let minX=3,minY=3,maxX=-1,maxY=-1;
 for(let y=0;y<3;y++)for(let x=0;x<3;x++){if(grid[y*3+x]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}}
 const w=recipe.pattern.reduce((m,row)=>Math.max(m,row.length),0),h=recipe.pattern.length;
 if(maxX-minX+1!==w||maxY-minY+1!==h)return false;
 for(let y=0;y<3;y++)for(let x=0;x<3;x++){
  const match=x>=minX&&x<minX+w&&y>=minY&&y<minY+h?expected[(y-minY)*3+(x-minX)]:0;
  if(grid[y*3+x]!==match)return false;
 }
 return true;
}
