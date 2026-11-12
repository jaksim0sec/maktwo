export const BLOCK={AIR:0,GRASS:1,DIRT:2,STONE:3,SAND:4,WATER:5,WOOD:6,LEAVES:7,COBBLE:8,PLANKS:9,GLASS:10,FLOWER:11,BEDROCK:12,ORE:13,TORCH:14,PORTAL:15};
export const BLOCKS=[
 ['Air','#000000',false,'none',0],['Grass','#74ae4a',true,'cube',.8],['Dirt','#866046',true,'cube',.7],['Stone','#8d939a',true,'cube',1.5],['Sand','#d8c17f',true,'cube',.6],['Water','#3984cc',false,'fluid',0],['Wood','#8b6342',true,'cube',1.8],['Leaves','#4a954d',false,'cutout',.2],['Cobblestone','#777b83',true,'cube',1.4],['Planks','#ba9057',true,'cube',1],['Glass','#b5e3ef',true,'glass',.4],['Flower','#e46d74',false,'cross',0],['Bedrock','#34343a',true,'cube',Infinity],['Ore','#8b94ae',true,'cube',2.3],['Torch','#edbd59',false,'cross',0],['Portal','#9558e5',false,'portal',0]
].map(([name,color,solid,render,hardness],id)=>({id,name,color,solid,render,hardness,opaque:solid&&render==='cube',replaceable:id===0||id===5||id===11||id===14||id===15}));
export const block=id=>BLOCKS[id]||BLOCKS[0];
export const HOTBAR=[BLOCK.GRASS,BLOCK.DIRT,BLOCK.STONE,BLOCK.WOOD,BLOCK.PLANKS,BLOCK.GLASS,BLOCK.SAND,BLOCK.WATER,BLOCK.TORCH,BLOCK.PORTAL];
