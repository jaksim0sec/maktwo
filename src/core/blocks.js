export const BLOCK={AIR:0,GRASS:1,DIRT:2,STONE:3,SAND:4,WATER:5,WOOD:6,LEAVES:7,COBBLE:8,PLANKS:9,GLASS:10,FLOWER:11,BEDROCK:12,ORE:13,TORCH:14,PORTAL:15};
export const BLOCKS=[
 ['Air','#000000',false,'none',0],['Grass','#78966e',true,'cube',.8],['Dirt','#806c59',true,'cube',.7],['Stone','#858b90',true,'cube',1.5],['Sand','#b8ac87',true,'cube',.6],['Water','#688fa7',false,'fluid',0],['Wood','#806952',true,'cube',1.8],['Leaves','#648c68',false,'cutout',.2],['Cobblestone','#7a7f82',true,'cube',1.4],['Planks','#a69274',true,'cube',1],['Glass','#acbdc0',true,'glass',.4],['Flower','#b77b83',false,'cross',0],['Bedrock','#34343a',true,'cube',Infinity],['Ore','#858d9e',true,'cube',2.3],['Torch','#c5ac75',false,'cross',0],['Portal','#9282b5',false,'portal',0]
].map(([name,color,solid,render,hardness],id)=>({id,name,color,solid,render,hardness,opaque:solid&&render==='cube',replaceable:id===0||id===5||id===11||id===14||id===15}));
export const block=id=>BLOCKS[id]||BLOCKS[0];
export const HOTBAR=[BLOCK.GRASS,BLOCK.DIRT,BLOCK.STONE,BLOCK.WOOD,BLOCK.PLANKS,BLOCK.GLASS,BLOCK.SAND,BLOCK.WATER,BLOCK.TORCH,BLOCK.PORTAL];
