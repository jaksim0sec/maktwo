import {ARCH_MATERIALS,ARCH_MATERIAL_START} from './architectural-materials.js';
export const BLOCK={AIR:0,GRASS:1,DIRT:2,STONE:3,SAND:4,WATER:5,WOOD:6,LEAVES:7,COBBLE:8,PLANKS:9,GLASS:10,FLOWER:11,BEDROCK:12,ORE:13,TORCH:14,PORTAL:15,LANTERN:16,CAMPFIRE:17,DOOR:18,DOOR_TOP:19,PATH:20,GLOW_MUSHROOM:21,FENCE:22,WORKBENCH:23,STONE_STAIRS:24,WOOD_STAIRS:25,STONE_SLAB:26,WOOD_SLAB:27,CHAIR:28,FLOWER_POT:29,HIGHLAND_GRASS:30,ALPINE_SOIL:31,SNOW:32,ICE:33,SHALE:34,GRANITE:35,SLATE:36,BASALT:37,MOSS:38,CLAY:39,PEAT:40,RED_SAND:41,TERRACOTTA:42,LIMESTONE:43,MARBLE:44,CEDAR_WOOD:45,CEDAR_LEAVES:46,BIRCH_WOOD:47,BIRCH_LEAVES:48,REEDS:49,HEATHER:50,BLUE_FLOWER:51,GLOW_MOSS:52,FIREFLY_GRASS:53,QUARTZ:54,CONCRETE:55,CRACKED_CONCRETE:56,STAINED_PLASTER:57,FLOOR_TILE:58,CEILING_TILE:59,METAL_PANEL:60,RUSTED_METAL:61,DIRTY_GLASS:62,SHOP_SHUTTER:63,SHOP_SIGN:64,SHOP_BRICK:65,FLUORESCENT:66,BROKEN_FLUORESCENT:67,EXPOSED_REBAR:68,MOLD_PLASTER:69,CORRUGATED_METAL:70,RUBBLE:71,SHOP_AWNING:72,CONCRETE_BEAM:73,WET_TILE:74,WALL_TILE:75,WARNING_STRIPE:76,CONCRETE_SLAB:77,CONCRETE_STAIRS:78,THIN_WALL_NS:79,THIN_WALL_EW:80,WINDOW_NS:81,WINDOW_EW:82,UPPER_STAIR_TREAD:83,FLOOR_FINISH:84,CEILING_FINISH:85,...Object.fromEntries(ARCH_MATERIALS.map((m,i)=>[m.key,ARCH_MATERIAL_START+i]))};
// Orientation IDs in generated worlds remain valid. Both axes share one inventory item.
export const itemId=id=>id===BLOCK.WINDOW_EW?BLOCK.WINDOW_NS:id===BLOCK.THIN_WALL_EW?BLOCK.THIN_WALL_NS:id;
export const BLOCKS=[
 ['Air','#000000',false,'none',0],['Grass','#78966e',true,'cube',.8],['Dirt','#806c59',true,'cube',.7],['Stone','#858b90',true,'cube',1.5],['Sand','#b8ac87',true,'cube',.6],['Water','#688fa7',false,'fluid',0],['Wood','#806952',true,'cube',1.8],['Leaves','#648c68',false,'cutout',.2],['Cobblestone','#7a7f82',true,'cube',1.4],['Planks','#a69274',true,'cube',1],['Glass','#acbdc0',true,'glass',.4],['Flower','#b77b83',false,'cross',0],['Bedrock','#34343a',true,'cube',Infinity],['Ore','#858d9e',true,'cube',2.3],['Torch','#a58a64',false,'fixture',0],['Portal','#9282b5',false,'portal',0],['Lantern','#c8a56e',false,'fixture',0],['Campfire','#a07b61',false,'fixture',0],['Door','#aa8b65',true,'door',.9],['Door Top','#aa8b65',true,'door-top',.9],['Stone Path','#8d8b7f',false,'path',.4],['Glow Mushroom','#e5b78b',false,'mushroom',.18],['Wood Fence','#93795e',true,'fence',.85],['Workbench','#987959',true,'workbench',1.05],['Stone Stairs','#7a7f82',true,'stairs',1.15],['Wood Stairs','#a69274',true,'stairs',.85],['Stone Slab','#858b90',true,'slab',.85],['Wood Slab','#a69274',true,'slab',.65],['Wood Chair','#95785a',true,'chair',.7],['Flower Pot','#a47764',false,'flower-pot',.3],['Highland Grass','#79947d',true,'cube',0.7],['Alpine Soil','#6d665f',true,'cube',0.7],['Snow','#c8d0cf',true,'cube',0.35],['Ice','#8daeb8',true,'cube',0.7],['Shale','#696f78',true,'cube',1.25],['Granite','#a19a8f',true,'cube',1.65],['Slate','#66717b',true,'cube',1.55],['Basalt','#52565d',true,'cube',1.8],['Moss','#647f5f',true,'cube',0.5],['Clay','#858882',true,'cube',0.7],['Peat','#55463d',true,'cube',0.75],['Red Sand','#b4846d',true,'cube',0.55],['Terracotta','#986d5a',true,'cube',1.1],['Limestone','#c0b6a1',true,'cube',1.3],['Marble','#b9bab2',true,'cube',1.6],['Cedar Log','#706452',true,'cube',1.55],['Cedar Leaves','#587c72',false,'cutout',0.18],['Birch Log','#b7b5a1',true,'cube',1.45],['Birch Leaves','#819766',false,'cutout',0.19],['Reeds','#678c70',false,'cross',0.14],['Heather','#9b7d99',false,'cross',0.18],['Blue Flower','#7693be',false,'cross',0.12],['Glowing Moss','#718d65',true,'cube',0.52],['Firefly Grass','#6c976e',false,'cross',0.16],['Quartz','#c4c2ae',true,'cube',1.7],
 ['Aged Concrete','#777b80',true,'cube',1.8],['Fractured Concrete','#6c7076',true,'cube',1.65],['Water-Stained Plaster','#b5ada2',true,'cube',.9],['Speckled Floor Tile','#99999a',true,'cube',1.1],
 ['Drop Ceiling Tile','#b4b6b1',true,'cube',.7],['Scuffed Steel Panel','#787f84',true,'cube',1.9],['Rusting Metal','#755f59',true,'cube',1.6],['Dirty Storefront Glass','#a5adb0',true,'glass',.5],
 ['Rolling Shop Shutter','#7d7771',true,'cube',1.6],['Faded Shop Sign','#b8aca0',true,'cube',.65],['Old Facade Brick','#807a75',true,'cube',1.45],
 ['Fluorescent Strip','#c4d2d5',false,'fixture',.25],['Broken Fluorescent','#73797c',false,'fixture',.25],['Exposed Rebar','#666266',true,'cube',1.75],['Moldy Plaster','#8f9388',true,'cube',.75],
 ['Corrugated Steel','#6f7578',true,'cube',1.7],['Rubble','#75716d',true,'cube',1.15],['Torn Store Awning','#9d8177',true,'cube',.65],['Concrete Beam','#6f7278',true,'cube',1.95],
 ['Wet Floor Tile','#777e81',true,'cube',1.1],['Institutional Wall Tile','#b1b0a9',true,'cube',1.15],['Faded Warning Stripe','#a69d86',true,'cube',.8],
 ['Concrete Half Slab','#86898a',true,'slab',1.35],['Concrete Stairs','#818488',true,'stairs',1.35],
 ['Thin Concrete Wall NS','#9d9d98',true,'panel',1.15],['Thin Concrete Wall EW','#9d9d98',true,'panel',1.15],
 ['Framed Window NS','#7e8487',true,'frame',.85],['Framed Window EW','#7e8487',true,'frame',.85],
 ['Concrete Upper Stair Tread','#818488',true,'slab',1.35],['Interior Floor Finish','#9b9691',true,'slab',.75],['Ceiling Cladding','#b2b1aa',true,'slab',.65]
].map(([name,color,solid,render,hardness],id)=>({id,name,color,solid,render,hardness,opaque:solid&&render==='cube',replaceable:id===0||id===5||render==='cross'||id===14||id===15||id===16||id===17})).concat(ARCH_MATERIALS.map((m,i)=>({id:ARCH_MATERIAL_START+i,name:m.name,color:m.color,solid:true,render:'cube',hardness:1.25,opaque:true,replaceable:false})));
// Seconds of continuous holding required to mine each block. Separate from
// blast resistance (hardness), so future tools can modify mining speed.
const BREAK_SECONDS=[0,.65,.55,1.45,.48,.28,1.25,.35,1.32, .85,.62,.22,Infinity,2.1,.24,.65,.35,.50,.90,.90,.36,.24,.85,1.05,1.15,.85,.85,.65,.7,.3,0.70,0.70,0.35,0.70,1.25,1.65,1.55,1.80,0.50,0.70,0.75,0.55,1.10,1.30,1.60,1.55,0.30,1.45,0.30,0.20,0.20,0.20,0.52,0.20,1.70,1.80,1.65,.9,1.10,.7,1.90,1.60,.5,1.60,.65,1.45,.25,.25,1.75,.75,1.70,1.15,.65,1.95,1.10,1.15,.8,1.35,1.35,1.15,1.15,.85,.85,1.35,.75,.65];
for(let i=0;i<BLOCKS.length;i++)BLOCKS[i].breakTime=BREAK_SECONDS[i]??1.15;
export const block=id=>BLOCKS[id]||BLOCKS[0];
export const HOTBAR=[BLOCK.DIRT,BLOCK.PLANKS,BLOCK.TORCH,BLOCK.DOOR,null,null,null];
export const HOTBAR_SIZE=7;

// Warm practical lighting: three reusable fixtures; color and falloff are renderer-agnostic.
BLOCKS[BLOCK.TORCH].light={color:'#ff8750',radius:9,intensity:.73,offsetY:.75};
BLOCKS[BLOCK.LANTERN].light={color:'#ff985d',radius:10,intensity:.75,offsetY:.63};
BLOCKS[BLOCK.CAMPFIRE].light={color:'#ff814a',radius:10,intensity:.79,offsetY:.45};
BLOCKS[BLOCK.GLOW_MUSHROOM].light={color:'#ed976a',radius:4,intensity:.34,offsetY:.35};
export const LIGHTBAR=[BLOCK.TORCH,BLOCK.LANTERN,BLOCK.CAMPFIRE];

// Localized display labels are separate from stable code names and stored IDs.
export const BLOCK_LABELS=['공기','잔디','흙','돌','모래','물','나무','나뭇잎','조약돌','나무 판자','유리','꽃','기반암','광석','횃불','포탈','랜턴','모닥불','나무 문','문 윗부분','돌길','빛나는 버섯','나무 울타리','작업대','돌 계단','나무 계단','돌 반블록','나무 반블록','나무 의자','꽃 화분','고원 잔디','고산 흙','눈','얼음','셰일','화강암','점판암','현무암','이끼','점토','이탄','붉은 모래','테라코타','석회암','대리석','삼나무 원목','삼나무 잎','자작나무 원목','자작나무 잎','갈대','헤더꽃','파란 꽃','발광 이끼','반딧불 풀','석영','낡은 콘크리트','균열 콘크리트','물자국 회벽','점박이 바닥 타일','천장 패널','철제 벽판','녹슨 철판','오염된 유리','상가 셔터','바랜 간판','낡은 벽돌','형광등','파손된 형광등','노출 철근','곰팡이 회벽','골강판','잔해','찢어진 차양','콘크리트 보','젖은 타일','실내 벽 타일','경고 무늬','콘크리트 반블록','콘크리트 계단','얇은 콘크리트 벽','얇은 콘크리트 벽','철제 창문','철제 창문','상부 계단 디딤판','바닥 마감 반블록','천장 마감 반블록',...ARCH_MATERIALS.map(m=>m.label)];
export const blockLabel=id=>BLOCK_LABELS[id]||'알 수 없는 블록';

BLOCKS[BLOCK.GLOW_MOSS].light={color:'#d6bd83',radius:3,intensity:.21,offsetY:1.1};
BLOCKS[BLOCK.FIREFLY_GRASS].light={color:'#e4be76',radius:2,intensity:.25,offsetY:.50};

// Only surviving light strips illuminate corridors; broken tubes stay dark.
BLOCKS[BLOCK.FLUORESCENT].light={color:'#c9d9e5',radius:6,intensity:.33,offsetY:.86};
