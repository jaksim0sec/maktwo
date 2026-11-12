export const BLOCK={AIR:0,GRASS:1,DIRT:2,STONE:3,SAND:4,WATER:5,WOOD:6,LEAVES:7,COBBLE:8,PLANKS:9,GLASS:10,FLOWER:11,BEDROCK:12,ORE:13,TORCH:14,PORTAL:15,LANTERN:16,CAMPFIRE:17,DOOR:18,DOOR_TOP:19};
export const BLOCKS=[
 ['Air','#000000',false,'none',0],['Grass','#78966e',true,'cube',.8],['Dirt','#806c59',true,'cube',.7],['Stone','#858b90',true,'cube',1.5],['Sand','#b8ac87',true,'cube',.6],['Water','#688fa7',false,'fluid',0],['Wood','#806952',true,'cube',1.8],['Leaves','#648c68',false,'cutout',.2],['Cobblestone','#7a7f82',true,'cube',1.4],['Planks','#a69274',true,'cube',1],['Glass','#acbdc0',true,'glass',.4],['Flower','#b77b83',false,'cross',0],['Bedrock','#34343a',true,'cube',Infinity],['Ore','#858d9e',true,'cube',2.3],['Torch','#a58a64',false,'fixture',0],['Portal','#9282b5',false,'portal',0],['Lantern','#c8a56e',false,'fixture',0],['Campfire','#a07b61',false,'fixture',0],['Door','#aa8b65',true,'door',.9],['Door Top','#aa8b65',true,'door-top',.9]
].map(([name,color,solid,render,hardness],id)=>({id,name,color,solid,render,hardness,opaque:solid&&render==='cube',replaceable:id===0||id===5||id===11||id===14||id===15||id===16||id===17}));
// Seconds of continuous holding required to mine each block. Separate from
// blast resistance (hardness), so future tools can modify mining speed.
const BREAK_SECONDS=[0,.65,.55,1.45,.48,.28,1.25,.35,1.32, .85,.62,.22,Infinity,2.1,.24,.65,.35,.50,.90,.90];
for(let i=0;i<BLOCKS.length;i++)BLOCKS[i].breakTime=BREAK_SECONDS[i];
export const block=id=>BLOCKS[id]||BLOCKS[0];
export const HOTBAR=[BLOCK.GRASS,BLOCK.DIRT,BLOCK.STONE,BLOCK.WOOD,BLOCK.PLANKS,BLOCK.GLASS,BLOCK.SAND,BLOCK.WATER,BLOCK.TORCH,BLOCK.DOOR];

// Warm practical lighting: three reusable fixtures; color and falloff are renderer-agnostic.
BLOCKS[BLOCK.TORCH].light={color:'#ff9955',radius:9,intensity:1.10,offsetY:.75};
BLOCKS[BLOCK.LANTERN].light={color:'#ffb66e',radius:11,intensity:1.04,offsetY:.63};
BLOCKS[BLOCK.CAMPFIRE].light={color:'#ff914d',radius:11,intensity:1.08,offsetY:.45};
export const LIGHTBAR=[BLOCK.TORCH,BLOCK.LANTERN,BLOCK.CAMPFIRE];

// Localized display labels are separate from stable code names and stored IDs.
export const BLOCK_LABELS=['공기','잔디','흙','돌','모래','물','나무','나뭇잎','조약돌','나무 판자','유리','꽃','기반암','광석','횃불','포탈','랜턴','모닥불','나무 문','문 윗부분'];
export const blockLabel=id=>BLOCK_LABELS[id]||'알 수 없는 블록';
