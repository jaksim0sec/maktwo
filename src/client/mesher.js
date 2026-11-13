import {SIZE,MESH_NEIGHBORS, TURN_STYLE, EXTERIOR_STYLE,CITY_STAIR_STYLE,CITY_STAIR_LEVEL_MASK} from '../core/chunk.js';
import {BLOCK as B,isBed,isBedFoot,itemId, BLOCKS, block} from '../core/blocks.js';
import {hash} from '../util/math.js';
import {materialFor,materialUVTransform} from './textures.js';
import {doorBounds,DOOR_HEIGHT} from '../core/door.js';
import {shapeBoxes,isStairs,isSlab,rotateCellXZ,isPanel,diagonalPanel} from '../core/shapes.js';
import {decodeSplitTread} from '../worldgen/eternal-night-stairs.js';
import {fenceJoints,fencePrisms} from '../core/fence-joints.js';
import {panelJoints,panelNeighbor,panelKind} from '../core/panel-joints.js';
import {FORMED} from '../core/construction.js';
import {MOUNT_PARTS,mountPoint} from '../core/mounts.js';
import {partById} from '../core/part-library.js';
import {partPrisms,prismFaces,prismNormal,stairConnections,stairRailRise,signConnections} from '../core/part-prisms.js';
import {treeGeometryForBlock} from './tree-mesh.js';

// Winding and direction are kept consistent with the WebGL cull-face convention.
const FACES = [
  {d:[1,0,0],  n:0, u:1, v:2, corners:[[1,0,0],[1,1,0],[1,1,1],[1,0,1]],shade:.78},
  {d:[-1,0,0], n:0, u:1, v:2, corners:[[0,0,1],[0,1,1],[0,1,0],[0,0,0]],shade:.74},
  {d:[0,1,0],  n:1, u:0, v:2, corners:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]],shade:1},
  {d:[0,-1,0], n:1, u:0, v:2, corners:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],shade:.56},
  {d:[0,0,1],  n:2, u:1, v:0, corners:[[1,0,1],[1,1,1],[0,1,1],[0,0,1]],shade:.88},
  {d:[0,0,-1], n:2, u:1, v:0, corners:[[0,0,0],[0,1,0],[1,1,0],[1,0,0]],shade:.82}
];
const COLORS = BLOCKS.map(({color}) => rgb(color));
const TRANSPARENT = BLOCKS.map(({render})=>render==='fluid'||render==='glass'||render==='portal');
const OPAQUE = BLOCKS.map(({opaque})=>opaque);
const CROSS = BLOCKS.map(({render})=>['cross','fixture','door','door-top','path','mushroom','fence','workbench','stairs','slab','panel','frame','chair','flower-pot','part','tree','leaf-litter'].includes(render));
const CUTOUT = BLOCKS.map(({render})=>render==='cutout');
const partTemplates=new Map();

function partTemplate(id,facing,connected,simple,stairRise,cityStair=false,treadHeight=1,rail=false,cityBridge=false,bridgePost=false,splitTread=null,joints=null){
 const baseKey=id|(facing<<8)|(connected?.left?1<<11:0)|(connected?.right?1<<12:0)
  |(simple?1<<13:0)|((stairRise===undefined?0:Math.round(stairRise*4)+1)<<14)
  |(cityStair?1<<18:0)|(cityStair?(Math.round(treadHeight*4)-1)<<19:0)|(rail?1<<22:0)
  |(cityBridge?1<<23:0)|(bridgePost?1<<24:0)|((splitTread?splitTread.index+1:0)<<25);
 const key=(joints?`${baseKey}:${joints.left.direction}:${joints.right.direction}:${+joints.left.joined}${+joints.right.joined}${+joints.bottom}${+joints.top}`:baseKey)+
  (connected?.top?':T':'')+(connected?.bottom?':B':'');
 if(partTemplates.has(key))return partTemplates.get(key);
 const opaque=[],transparent=[];
 for(const piece of partPrisms(id,0,0,0,{facing,connected,simple,stairRise,cityStair,treadHeight,rail,cityBridge,bridgePost,splitTread,panelJoints:joints})||[]){
  const color=piece.emissive?[.97,.90,.78]:COLORS[piece.material],target=piece.alpha?transparent:opaque;
  for(const face of prismFaces(piece,true)){
   const n=prismNormal(face);if(!n)continue;
   const shade=piece.emissive?-1.2:(.74+.26*Math.abs(n[1]))*Math.max(.58,Math.min(1.08,piece.tone??1))+4*materialFor(piece.material,0);
   for(let j=1;j<face.length-1;j++)for(const i of [0,j,j+1])target.push(...face[i],...color,shade);
  }
 }
 if(!simple&&partById(id)?.family==='ventilation')fanRotorMesh(opaque,0,0,0,id,facing);
 const template=[new Float32Array(opaque),new Float32Array(transparent)];
 partTemplates.set(key,template);return template;
}

function emitPart(target,vertices,x,y,z){
 for(let i=0;i<vertices.length;i+=7)target.push(x+vertices[i],y+vertices[i+1],z+vertices[i+2],vertices[i+3],vertices[i+4],vertices[i+5],vertices[i+6]);
}

export function rgb(hex){const s=hex.replace('#','');return [parseInt(s.slice(0,2),16)/255,parseInt(s.slice(2,4),16)/255,parseInt(s.slice(4,6),16)/255]}
export function quad(arr,v,color,shade){for(const i of [0,1,2,0,2,3])arr.push(...v[i],...color,shade)}
export function cube(arr,x,y,z,w,h,d,color,shade=1){for(const face of FACES){const v=face.corners.map(([a,b,c])=>[x+a*w,y+b*h,z+c*d]);quad(arr,v,color,face.shade*shade)}}

// Six directional masks; every rectangular run of the same block becomes ONE quad.
// Cross plants remain individual crossed quads. No changes to storage or world rules.
export function meshChunkData(chunk,{neighbors=[],states=new Map(),visualSeed=0,yMin=0,yMax=chunk.data.length/(SIZE*SIZE),detailY}={}){
 const height=chunk.data.length/(SIZE*SIZE),dims=[SIZE,yMax-yMin,SIZE];
 const adjacent=new Map(neighbors.map(([dx,dz,data,forms,styles,cornerY])=>[`${dx},${dz}`,{data,forms,styles,cornerY}]));
 const stateAt=(x,y,z)=>states?.get(`${x},${y},${z}`);
 const opaque=[],transparent=[],ox=chunk.cx*SIZE,oz=chunk.cz*SIZE,forms=chunk.forms;
 // Store top-face UV turns in the existing material field. Only chunks with
 // rotated cubes need this array, and only the horizontal masks use it.
 let cubeTurns;
 for(const [pos,state] of states){
  if(!state.facing)continue;
  const [wx,y,wz]=pos.split(',').map(Number),x=wx-ox,z=wz-oz;
  if(x<0||x>=SIZE||z<0||z>=SIZE||y<yMin||y>=yMax)continue;
  const idx=(y*SIZE+z)*SIZE+x;
  if(CROSS[chunk.data[idx]]||forms?.[idx])continue;
  cubeTurns??=new Uint8Array(chunk.data.length);
  cubeTurns[idx]=state.facing&3;
 }
 for(let faceIndex=0;faceIndex<FACES.length;faceIndex++){
  const f=FACES[faceIndex];const {d,n,u,v,corners,shade}=f,nu=dims[u],nv=dims[v],sign=d[n];
  const mask=new Int32Array(nu*nv);
  const edgeData=n===0?adjacent.get(`${sign},0`):n===2?adjacent.get(`0,${sign}`):null;
  const data=chunk.data;
  for(let layer=0;layer<dims[n];layer++){
   let i=0;
   for(let j=0;j<nv;j++)for(let k=0;k<nu;k++,i++){
    const x=n===0?layer:n===1?k:j;
    const y=yMin+(n===1?layer:k);
    const z=n===2?layer:j;
    const idx=(y*SIZE+z)*SIZE+x,id=data[idx];
    if(id===B.AIR||CROSS[id]||forms?.[idx]){mask[i]=0;continue}
    let neighborIdx,other,otherForm;
    if(n===0){
     const next=x+sign;
     if(next>=0&&next<SIZE){neighborIdx=idx+sign;other=data[neighborIdx];otherForm=forms?.[neighborIdx]}
     else{neighborIdx=(y*SIZE+z)*SIZE+(sign===1?0:SIZE-1);other=edgeData?.data[neighborIdx];otherForm=edgeData?.forms?.[neighborIdx]}
    }else if(n===1){
     const next=y+sign;
     if(next<0)other=B.BEDROCK;
     else if(next<height){neighborIdx=idx+sign*SIZE*SIZE;other=data[neighborIdx];otherForm=forms?.[neighborIdx]}
    }else{
     const next=z+sign;
     if(next>=0&&next<SIZE){neighborIdx=idx+sign*SIZE;other=data[neighborIdx];otherForm=forms?.[neighborIdx]}
     else{neighborIdx=(y*SIZE+(sign===1?0:SIZE-1))*SIZE+x;other=edgeData?.data[neighborIdx];otherForm=edgeData?.forms?.[neighborIdx]}
    }
    const transparent=TRANSPARENT[id];
    mask[i]=(!otherForm&&OPAQUE[other])||(id===other&&(transparent||CUTOUT[id]))||(!transparent&&other===B.GLASS)
      ?0:id|(id===B.WATER&&n!==1?y<<8:0)|(n===1?(cubeTurns?.[idx]||0)<<14:0);
   }
   for(let j=0;j<nv;j++)for(let k=0;k<nu;){
    const idx=j*nu+k,mat=mask[idx];if(!mat){k++;continue}
    let width=1,height=1;
    while(k+width<nu&&mask[idx+width]===mat)width++;
    heightLoop:while(j+height<nv){for(let t=0;t<width;t++)if(mask[(j+height)*nu+k+t]!==mat)break heightLoop;height++}
    for(let jj=0;jj<height;jj++)mask.fill(0,(j+jj)*nu+k,(j+jj)*nu+k+width);
    const id=mat&255,dest=TRANSPARENT[id]?transparent:opaque;
    const c=[0,0,0];c[n]=layer;c[u]=k;c[v]=j;
    const xyz=[ox+c[0],yMin+c[1],oz+c[2]],water=id===B.WATER;
    const verts=corners.map(q=>{
     const p=[...xyz];p[n]+=q[n];p[u]+=q[u]*width;p[v]+=q[v]*height;
     if(water&&q[1]===1)p[1]-=.13;
     return p;
    });
    // Tiny world-coordinate variation only per merged face, never per vertex.
    const color=COLORS[id],variationSeed=hash(xyz[0],xyz[1],xyz[2],visualSeed);
    const variation=id===B.GLASS?1:.95+variationSeed*.06;
    const material=materialFor(id,faceIndex);
    // One deterministic transform per greedy quad, encoded in existing vertex bits.
    const turns=materialUVTransform(material,variationSeed,id===B.WATER?0:(mat>>>14)&3);
    quad(dest,verts,[color[0]*variation,color[1]*variation,color[2]*variation],
      (id===B.GLASS?1:shade)+4*material+512*turns);
    k+=width;
   }
  }
 }
 // Thin crossed planes must remain double-sided, irrespective of face culling.
 for(let y=yMin;y<yMax;y++)for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){
  const idx=(y*SIZE+z)*SIZE+x,id=chunk.data[idx],form=FORMED[forms?.[idx]];
  if(form){
   for(const face of form.faces){
    if(face.side>=0){
     const [dx,dy,dz]=FACES[face.side].d;
     const nx=x+dx,ny=y+dy,nz=z+dz;
     const edge=nx<0||nx>=SIZE||nz<0||nz>=SIZE;
     const neighbor=edge?adjacent.get(`${dx},${dz}`):chunk;
     const i=(ny*SIZE+(nz+SIZE)%SIZE)*SIZE+(nx+SIZE)%SIZE;
     if(OPAQUE[neighbor?.data[i]]&&!neighbor?.forms?.[i])continue;
    }
    const shade=FACES[face.material].shade+4*materialFor(id,face.material);
    const vertices=face.points.map(([a,b,c])=>[ox+x+a,y+b,oz+z+c]);
    for(let i=1;i<vertices.length-1;i++){
     for(const j of [0,i,i+1])(TRANSPARENT[id]?transparent:opaque).push(...vertices[j],...COLORS[id],shade);
    }
   }
   continue;
  }
  if(!CROSS[id]||id===B.DOOR_TOP)continue;
  if(BLOCKS[id].render==='tree'||BLOCKS[id].render==='leaf-litter'){
   const local=treeGeometryForBlock(id,(chunk.styles?.[idx]||0)&3);
   if(local)emitPart(opaque,local,ox+x,y,oz+z);
   continue;
  }
  const wx=ox+x,wz=oz+z,authored=states.size?stateAt(wx,y,wz):undefined;
  const style=chunk.styles?.[idx]||0,variant=style&TURN_STYLE?0:style;
  const state=style&TURN_STYLE?{facing:style&7,...authored}:variant?{variant,...authored}:authored;
  const neighbor=(dx,dy,dz)=>{
   const nx=x+dx,nz=z+dz,ny=y+dy;
   const cx=Math.floor(nx/SIZE),cz=Math.floor(nz/SIZE);
   const data=cx||cz?adjacent.get(`${cx},${cz}`):chunk;
   const k=data?.cornerY===undefined?(ny*SIZE+(nz+SIZE)%SIZE)*SIZE+(nx+SIZE)%SIZE:ny-data.cornerY;
   const style=data?.styles?.[k]||0;
   const authored=states.size?stateAt(wx+dx,ny,wz+dz):undefined;
   return {id:data?.data?.[k]||B.AIR,style,form:data?.forms?.[k]||0,
    state:authored??(style&TURN_STYLE?{facing:style&7}:undefined)};
  };
  const joints=panelKind(id)?panelJoints(id,state,(dx,dy,dz)=>{
   const other=neighbor(dx,dy,dz);
   return panelNeighbor(other.id,other.state,other.form);
  }):null;
  if(BLOCKS[id].render==='part'){
   const simple=detailY!==undefined&&(detailY===null||y<detailY-4||y>=detailY+12);
   if(simple&&!(style&EXTERIOR_STYLE)&&!authored&&!(style&CITY_STAIR_STYLE))continue;
   const split=decodeSplitTread(style);
   const orientation=authored?.facing??split?.facing??state?.facing??0;
   let connected=null,stairRise;
   if(!simple&&partById(id)?.family==='staircase'){
    const neighbor=(dx,dz,dy=0)=>{
     const nx=x+dx,nz=z+dz,offX=nx<0?-1:nx>=SIZE?1:0,offZ=nz<0?-1:nz>=SIZE?1:0;
     const other=(offX||offZ)?adjacent.get(`${offX},${offZ}`):chunk;
     if(!other)return {id:B.AIR,facing:0};
     const a=((nx+SIZE)%SIZE),b=((nz+SIZE)%SIZE),k=((y+dy)*SIZE+b)*SIZE+a;
     const fx=wx+dx,fz=wz+dz;
     const generated=other.styles?.[k]||0;
     const nextSplit=decodeSplitTread(generated);
     return {id:other.data?.[k]||B.AIR,
      facing:stateAt(fx,y+dy,fz)?.facing??nextSplit?.facing??(generated&TURN_STYLE?generated&7:0),
      treadHeight:nextSplit?.low??(generated&CITY_STAIR_STYLE?(((generated&CITY_STAIR_LEVEL_MASK)>>3)+1)/4:undefined)};
    };
    connected=stairConnections(id,orientation,neighbor);
    if(split||style&TURN_STYLE)stairRise=stairRailRise(orientation,neighbor,split?.low??(style&CITY_STAIR_STYLE?(((style&CITY_STAIR_LEVEL_MASK)>>3)+1)/4:undefined));
   }
   if(partById(id)?.family==='sign')connected=signConnections(id,orientation,(dx,dz,dy=0)=>{
    const other=neighbor(dx,dy,dz);
    return {id:other.id,facing:other.state?.facing||0};
   });
   const cityGenerated=Boolean(style&CITY_STAIR_STYLE),family=partById(id)?.family;
   const cityStair=cityGenerated&&family==='staircase',cityBridge=cityGenerated&&family==='passage';
   const treadHeight=cityStair?(((style&CITY_STAIR_LEVEL_MASK)>>3)+1)/4:1;
   const [solid,glass]=partTemplate(id,orientation,connected,simple,stairRise,cityStair,treadHeight,cityStair&&Boolean(style&EXTERIOR_STYLE),cityBridge,cityBridge&&Boolean(style&8),split,joints);
   emitPart(opaque,solid,wx,y,wz);emitPart(transparent,glass,wx,y,wz);
   continue;
  }
  if(isStairs(id)||isSlab(id)||BLOCKS[id].render==='panel'||BLOCKS[id].render==='frame'||id===B.CHAIR||id===B.FLOWER_POT){shapeMesh(opaque,id,wx,y,wz,joints?{...state,panelJoints:joints}:state,transparent);continue}
  if(id===B.DOOR){doorMesh(opaque,wx,y,wz,state,transparent);continue}
  const start=opaque.length;
  if(id===B.FENCE){
   const metal=variant===6||variant===7;
   const joints=fenceJoints((dx,dy,dz)=>neighbor(dx,dy,dz).id);
   const color=rgb(metal?'#41484b':'#937755');
   for(const piece of fencePrisms(wx,y,wz,joints,metal))for(const face of prismFaces(piece)){
    for(let i=1;i<face.length-1;i++)for(const j of [0,i,i+1])opaque.push(...face[j],...color,.87);
   }
   continue;
  }
  if(id===B.PATH||id===B.GLOW_MUSHROOM||id===B.WORKBENCH)gardenMesh(opaque,id,wx,y,wz);
  else if(id!==B.FLOWER&&BLOCKS[id].render!=='cross')fixture(opaque,id,wx,y,wz);
  else flowerMesh(opaque,wx,y,wz,visualSeed,id);
  if(state?.facing){
   for(let i=start;i<opaque.length;i+=7){
    const [rx,rz]=rotateCellXZ(opaque[i]-wx,opaque[i+2]-wz,state.facing);
    opaque[i]=wx+rx;opaque[i+2]=wz+rz;
   }
  }

 }
 for(const mount of chunk.mounts?.values()||[]){
  if(mount.y<yMin||mount.y>=yMax)continue;
  for(const [u,v,d,w,h,t,color,lit] of MOUNT_PARTS[mount.id]){
   const paint=rgb(color);
   for(const face of FACES){
    const vertices=face.corners.map(([a,b,c])=>mountPoint(mount,u+a*w,v+b*h,d+c*t));
    quad(opaque,vertices,paint,lit?-1.5:face.shade);
   }
  }
 }
 return {opaque:new Float32Array(opaque),transparent:new Float32Array(transparent)};
}

// Existing callers may pass a loaded world; only already-loaded voxel data is read.
export function meshChunk(world,chunk){
 const neighbors=[];
 for(const [dx,dz] of MESH_NEIGHBORS){
  const neighbor=world.getChunk(chunk.cx+dx,chunk.cz+dz,false);
  if(neighbor)neighbors.push([dx,dz,neighbor.data,neighbor.forms,neighbor.styles]);
 }
 return meshChunkData(chunk,{neighbors,states:world.blockStates,visualSeed:world.seed});
}

const fixtureMeshes=new Map();
const ringPoints=Array.from({length:12},(_,i)=>[Math.cos(i*Math.PI/6),Math.sin(i*Math.PI/6)]);
function fixtureRing(dest,x,y,z,inner,outer,low,high,color,shade){
 for(let i=0;i<ringPoints.length;i++){
  const a=ringPoints[i],b=ringPoints[(i+1)%ringPoints.length];
  const at=([dx,dz],r,h)=>[x+.5+dx*r,y+h,z+.5+dz*r];
  if(inner)quad(dest,[at(a,outer,low),at(b,outer,low),at(b,inner,low),at(a,inner,low)],color,shade);
  else for(const v of [at(a,outer,low),at(b,outer,low),at(a,0,low)])dest.push(...v,...color,shade);
  quad(dest,[at(a,outer,low),at(a,outer,high),at(b,outer,high),at(b,outer,low)],color,shade);
  if(inner)quad(dest,[at(a,inner,low),at(b,inner,low),at(b,inner,high),at(a,inner,high)],color,shade);
 }
}

// Small low-poly practical lights. Negative vertex shade tags emissive surfaces
// without adding another vertex attribute or increasing the chunk buffer stride.
export function fixture(dest,id,x,y,z){
 if(id===B.FLUORESCENT||id===B.BROKEN_FLUORESCENT||id===B.ROUND_FLUORESCENT){
  let mesh=fixtureMeshes.get(id);
  if(!mesh){
   const vertices=[];
   fluorescentMesh(vertices,id);
   mesh=new Float32Array(vertices);
   fixtureMeshes.set(id,mesh);
  }
  emitPart(dest,mesh,x,y,z);
  return;
 }

 const shape=(dx,dy,dz,w,h,d,color,shade=1)=>cube(dest,x+dx,y+dy,z+dz,w,h,d,rgb(color),shade);
 if(id===B.CRATE){ // Weathered non-emissive cargo box with separated wood slats.
  shape(.085,.06,.085,.83,.75,.83,'#806b52');
  for(const y of [.10,.34,.58])for(const z of [.074,.86]){
   shape(.12,y,z,.76,.18,.032,'#a18b69');
   shape(.12,y+.17,z,.76,.013,.036,'#65523c');
  }
  for(const x of [.074,.864])for(const z of [.10,.84])shape(x,.08,z,.040,.71,.065,'#555453');
  for(const x of [.14,.79])shape(x,.81,.12,.06,.028,.77,'#62615c');
  shape(.13,.81,.13,.74,.035,.74,'#a28c6e');
  shape(.17,.849,.17,.66,.016,.66,'#8b775a');
 }else if(isBed(id)){
  const frame=itemId(id)===B.BED,foot=isBedFoot(id),base=frame?.26:.025;
  const start=foot?0:.055,end=foot?.945:1;
  if(frame){
   for(const leg of [.12,.78])shape(leg,.02,foot?.82:.065,.10,.25,.11,'#605044');
   shape(.08,.19,start,.84,.095,end-start,'#78604b');
   if(!foot)shape(.08,.16,.025,.84,.52,.075,'#6f5947');
  }
  shape(.105,base,start,.79,.15,end-start,'#a49c88');
  shape(.107,base+.13,foot?0:.59,.786,.045,foot?.91:.41,frame?'#687975':'#777568');
  shape(.12,base+.065,start,.76,.014,end-start,'#877e70');
  if(!foot)shape(.19,base+.15,.14,.62,.075,.32,'#c0b9a6');
 }else if(id===B.TORCH||id===B.LANTERN){
  shape(.31,.12,.31,.38,.09,.38,'#746858');
  shape(.36,.22,.36,.28,.38,.28,'#ffd19a',-1.5);
  for(const dx of [.3,.64])for(const dz of [.3,.64])shape(dx,.2,dz,.06,.44,.06,'#766b59');
  shape(.28,.63,.28,.44,.09,.44,'#766b59');
  shape(.45,.72,.45,.10,.11,.10,'#766b59');
 }else if(id===B.CAMPFIRE){
  shape(.13,.09,.28,.74,.18,.18,'#80624d');
  shape(.28,.06,.13,.18,.19,.74,'#7b5d4a');
  shape(.29,.22,.31,.42,.12,.39,'#e47b45',-1.15);
  shape(.37,.34,.37,.26,.32,.26,'#f8ae65',-1.5);
  shape(.45,.59,.45,.10,.13,.10,'#ffe0a3',-1.7);
 }
}

function fluorescentMesh(dest,id){
 if(id===B.ROUND_FLUORESCENT){
  fixtureRing(dest,0,0,0,0,.37,.86,1,rgb('#d2d5d5'),.86);
  fixtureRing(dest,0,0,0,.24,.32,.76,.84,rgb('#e4f3fb'),-1.12);
  cube(dest,.44,.78,.76,.12,.07,.11,rgb('#858d91'));
  return;
 }
 const lit=id===B.FLUORESCENT;
 const box=(x,y,z,w,h,d,color,shade)=>cube(dest,x,y,z,w,h,d,rgb(color),shade);
 box(.10,.87,.24,.80,.13,.52,'#747d82');
 // Lens bezel, rear mount and fasteners; the existing lit surface is unchanged.
 for(const x of [.16,.78])box(x,.955,.32,.055,.035,.38,'#5f666a');
 box(.145,.81,.26,.71,.025,.025,'#9a9e9a');
 box(.145,.81,.715,.71,.025,.025,'#9a9e9a');
 box(.14,.82,.27,.72,.06,.46,lit?'#b6c0c5':'#555b5e');
 for(const z of [.36,.57]){
  for(const x of [.12,.80])box(x,.775,z-.012,.08,.08,.09,'#8e9699');
  box(.20,.76,z,.60,.038,.065,lit?'#eff8ff':'#899094',lit?-1.20:1);
 }
 for(const x of [.18,.79])box(x,.758,.29,.035,.042,.40,'#8e9699');
 if(!lit)box(.59,.72,.49,.20,.045,.05,'#4e5355');
}

// The door's full two-block model is emitted once from the lower cell.
// Rendering it separately avoids breaking greedy face merging or chunk storage.
export function doorMesh(dest,x,y,z,state={facing:0,open:false},glassDest=dest){
 const b=doorBounds(x,z,state?.facing||0,Boolean(state?.open));
 const style=Math.max(0,Math.min(5,state?.variant||0)),acrossX=b.w>b.d;
 const colors=['#af9372','#957e66','#737b80','#a3b3b9','#6f655c','#80868b'];
 const color=rgb(colors[style]);
 const part=(target,along,start,height,thickness,c)=>{
  if(acrossX)cube(target,b.x+along*b.w,y+start,b.z+(b.d-thickness)/2,b.w*(1-along*2),height,thickness,c);
  else cube(target,b.x+(b.w-thickness)/2,y+start,b.z+along*b.d,thickness,height,b.d*(1-along*2),c);
 };
 if(style===3||style===4){
  // Actual clear infill: no opaque panel underneath the window.
  part(dest,0,.04,.38,b.w>b.d?b.d:b.w,color);
  part(dest,0,1.72,.26,b.w>b.d?b.d:b.w,color);
  const width=acrossX?b.w:b.d,side=.12/width;
  if(acrossX){
   cube(dest,b.x,y+.42,b.z,.12,1.30,b.d,color);
   cube(dest,b.x+b.w-.12,y+.42,b.z,.12,1.30,b.d,color);
   cube(glassDest,b.x+.12,y+.42,b.z+.035,b.w-.24,1.30,b.d-.07,rgb('#a8c2c9'));
  }else{
   cube(dest,b.x,y+.42,b.z,b.w,1.30,.12,color);
   cube(dest,b.x,y+.42,b.z+b.d-.12,b.w,1.30,.12,color);
   cube(glassDest,b.x+.035,y+.42,b.z+.12,b.w-.07,1.30,b.d-.24,rgb('#a8c2c9'));
  }
  if(style===4)part(dest,.15,.91,.075,acrossX?b.d+.025:b.w+.025,rgb('#9caaa8'));
 }else{
  for(let f=0;f<FACES.length;f++){
   const face=FACES[f],verts=face.corners.map(([a,c,d])=>[b.x+a*b.w,y+.04+c*DOOR_HEIGHT,b.z+d*b.d]);
   quad(dest,verts,color,face.shade+4*materialFor(18,f));
  }
  if(style===2||style===5){
   for(let i=0;i<4;i++)part(dest,.17,1.2+i*.09,.025,acrossX?b.d+.024:b.w+.024,rgb('#444e53'));
  }
  if(style===1)for(const h of [.37,1.57])part(dest,.09,h,.055,acrossX?b.d+.02:b.w+.02,rgb('#b49b7c'));
  if(style===5)part(dest,.12,.92,.055,acrossX?b.d+.07:b.w+.07,rgb('#c8c5b9'));
 }
 cube(dest,b.x+(acrossX?b.w*.78:-.025),y+.93,b.z+(acrossX?b.d+.008:b.d*.78),acrossX?.065:.06,.08,acrossX?.06:.065,rgb('#cdbd8f'));
}

// A stair flight sets style 7 on side posts; render connected rising handrails.
export function metalRailing(dest,x,y,z,hasNeighbor,axis='z'){
 const steel=rgb('#41484b');
 cube(dest,x+.43,y,z+.43,.14,1.03,.14,steel);
 cube(dest,x+.39,y+1.03,z+.39,.22,.07,.22,steel);
 for(const nextY of [y,y+1,y-1]){
  if(!hasNeighbor(nextY))continue;
  for(const h of [.52,.88]){
   const a=y+h,b=nextY+h,t=.065;
   // Four-sided sloped beam between adjacent upright posts.
   const p=axis==='z'?[[x+.47,a,z+.50],[x+.47,a+.09,z+.50],[x+.47,b+.09,z+1.5],[x+.47,b,z+1.5]]:
    [[x+.50,a,z+.47],[x+.50,a+.09,z+.47],[x+1.5,b+.09,z+.47],[x+1.5,b,z+.47]];
   quad(dest,p,steel,.8);
   quad(dest,[...p].reverse().map(q=>axis==='z'?[q[0]+t,q[1],q[2]]:[q[0],q[1],q[2]+t]),steel,.82);
   for(let i=0;i<4;i++){
    const j=(i+1)%4;
    quad(dest,[p[i],p[j],axis==='z'?[p[j][0]+t,p[j][1],p[j][2]]:[p[j][0],p[j][1],p[j][2]+t],axis==='z'?[p[i][0]+t,p[i][1],p[i][2]]:[p[i][0],p[i][1],p[i][2]+t]],steel,.86);
   }
  }
  break;
 }
}
// Visible rotor blades are thin angled trapezoids, not textured solid cubes.
// The blades are decorative non-colliding details inside the vent housing.
export function fanRotorMesh(dest,x,y,z,id,facing=0){
 const part=partById(id);
 if(part?.family!=='ventilation'||part.variant===1)return;
 const variant=part.variant,n=variant===4?6:variant===2?5:4;
 const color=COLORS[variant===4?109:107],frame=COLORS[variant===2?106:108];
 const angle=((facing%8)+8)%8*Math.PI/4,c=Math.cos(angle),sn=Math.sin(angle);
 const front=variant===2?.235:.345,centerZ=variant===3?.22:front;
 const transform=(a,b,d=centerZ)=>{
  const dx=a-.5,dz=d-.5;
  return [x+.5+dx*c-dz*sn,y+b,z+.5+dx*sn+dz*c];
 };
 const rot=(radius,a)=>[.5+radius*Math.cos(a),.5+radius*Math.sin(a)];
 const point=(r,a,d=centerZ)=>{const [xx,yy]=rot(r,a);return transform(xx,yy,d)};
 const shade=1+4*materialFor(109,0);
 for(let i=0;i<n;i++){
  const a=i*2*Math.PI/n+variant*.11;
  const outline=[
   point(.085,a-.42),point(.14,a+.22),
   point(variant===4?.31:.27,a+.47),point(variant===4?.34:.30,a-.24)
  ];
  quad(dest,outline,color,shade);
  quad(dest,[...outline].reverse(),color,shade);
  // A stamped ridge makes the metal appear pressed and tilted.
  const ridge=[point(.12,a-.14,centerZ-.015),point(.17,a+.04,centerZ-.015),
   point(.29,a+.28,centerZ-.015),point(.25,a+.13,centerZ-.015)];
  quad(dest,ridge,frame,shade+.06);
 }
 const segments=variant===4?16:12;
 const r1=variant===4?.355:.32,r2=variant===4?.383:.345;
 for(let i=0;i<segments;i++){
  const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments;
  const rim=[point(r1,a,front-.04),point(r1,b,front-.04),
   point(r2,b,front-.04),point(r2,a,front-.04)];
  quad(dest,rim,frame,shade);
  quad(dest,[...rim].reverse(),frame,shade);
 }
 // Segmented centre cap with a raised highlight ring.
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,b=(i+1)*Math.PI/4;
  const tri=[point(0,0,front-.065),point(.077,a,front-.065),point(.077,b,front-.065)];
  for(const indices of [[0,1,2],[2,1,0]])for(const k of indices)dest.push(...tri[k],...frame,shade+.10);
 }
}

export function gardenMesh(dest,id,x,y,z){
 const box=(dx,dy,dz,w,h,d,color,shade=1)=>cube(dest,x+dx,y+dy,z+dz,w,h,d,rgb(color),shade);
 if(id===B.WORKBENCH){
  // One reusable furniture model, separate from the chunk's greedy cube path.
  const part=(dx,dy,dz,w,h,d,color,mat=0)=>{
   const rgbColor=rgb(color);for(let fi=0;fi<FACES.length;fi++){
    const face=FACES[fi],verts=face.corners.map(([a,b,c])=>[x+dx+a*w,y+dy+b*h,z+dz+c*d]);
    quad(dest,verts,rgbColor,face.shade+4*mat);
   }
  };
  part(.045,.77,.045,.91,.22,.91,'#b29472',14);
  part(.07,.71,.07,.86,.07,.86,'#614d3a');
  for(const dx of [.11,.72])for(const dz of [.11,.72])part(dx,0,dz,.17,.76,.17,'#8d6b4b',10);
  for(let zRow=0;zRow<3;zRow++)part(.18,.990,.20+zRow*.24,.63,.005,.012,'#735944');
  return;
 }
 if(id===B.PATH){
  const color=rgb('#8b897d'),layer=materialFor(B.STONE,2);
  for(const f of FACES){const vertices=f.corners.map(([a,b,c])=>[x+.06+a*.88,y+.013+b*.035,z+.06+c*.88]);quad(dest,vertices,color,f.shade+4*layer)}
  for(const [dx,dz] of [[.17,.21],[.63,.28],[.39,.62]])box(dx,.053,dz,.13,.009,.1,'#a9a596');
 }else if(id===B.GLOW_MUSHROOM){
  box(.45,.025,.45,.10,.23,.10,'#c4b49a');
  box(.31,.235,.31,.38,.12,.38,'#dcac81',-1.13);
  box(.38,.36,.38,.24,.065,.24,'#f5d6ab',-1.22);
 }else if(id===B.FENCE){
  box(.405,0,.405,.19,1.04,.19,'#80694f');
  for(const height of [.35,.72]){
   box(.08,height,.442,.84,.13,.116,'#937755');
   box(.442,height,.08,.116,.13,.84,'#937755');
  }
  box(.375,1.04,.375,.25,.08,.25,'#a48a65');
 }
}

// Colored petals, leaves and a small centre. Slightly varied blooms, no flat X artifacts.
export function flowerMesh(dest,x,y,z,seed=0,id=B.FLOWER){
 if(id===B.REEDS){for(const dx of [.35,.52,.67])cube(dest,x+dx,y+.04,z+.44,.045,.58+hash(x,dx,z,seed)*.32,.045,rgb('#779677'));return;}
 if(id===B.FIREFLY_GRASS){for(const dx of [.33,.5,.66])cube(dest,x+dx,y+.03,z+.47,.04,.35+hash(x,dx,z,seed)*.18,.05,rgb('#6c9b69'));for(const dx of [.33,.68])cube(dest,x+dx,y+.51,z+.47,.07,.07,.07,rgb('#efc76f'),-1.08);return;}
 const n=hash(x,0,z,seed),h=.55+hash(x,1,z,seed)*.16;
 const petal=id===B.HEATHER?'#a78baa':id===B.BLUE_FLOWER?'#819dc8':n<.26?'#b97999':n<.52?'#d8a8b9':n<.78?'#e4c69b':'#ab99c5';
 cube(dest,x+.47,y+.045,z+.47,.06,h-.08,.06,rgb('#628764'));
 cube(dest,x+.33,y+.27,z+.46,.16,.045,.09,rgb('#72956e'));
 cube(dest,x+.51,y+.33,z+.44,.16,.045,.09,rgb('#668a63'));
 const cy=y+h;
 for(const [dx,dz] of [[-.13,0],[.13,0],[0,-.13],[0,.13]])cube(dest,x+.44+dx,cy-.02,z+.44+dz,.12,.105,.12,rgb(petal));
 cube(dest,x+.462,cy+.025,z+.462,.076,.08,.076,rgb('#d7b77e'));
}
// Partial voxel shapes keep the authored block material and physical AABBs aligned.
export function shapeMesh(dest,id,x,y,z,state,glassDest=dest){
 const diagonal=isPanel(id)?diagonalPanel(id,state):null;
 if(diagonal){
  for(let index=0;index<diagonal.length;index++){
   const glass=diagonal[index].glass;
   const paint=glass?rgb('#a9bdc5'):COLORS[id],out=glass?glassDest:dest;
   for(const face of diagonal[index].faces){
    const shade=FACES[face.material].shade+4*materialFor(glass?B.DIRTY_GLASS:id,face.material);
    const points=face.points.map(([a,b,c])=>[x+a,y+b,z+c]);
    for(let i=1;i<points.length-1;i++)for(const j of [0,i,i+1])out.push(...points[j],...paint,shade);
   }
  }
  return;
 }
 const boxes=shapeBoxes(id,x,y,z,state)||[];
 const c=rgb(BLOCKS[id].color);
 for(let index=0;index<boxes.length;index++){
  const b=boxes[index],dx=b.x-x,dy=b.y-y,dz=b.z-z;
  const glass=(id===B.WINDOW_NS||id===B.WINDOW_EW)&&index===0;
  const paint=glass?rgb('#a9bdc5'):c,mat=glass?materialFor(B.DIRTY_GLASS,0):materialFor(id,0),out=glass?glassDest:dest;
  for(let fi=0;fi<FACES.length;fi++){
   const face=FACES[fi],verts=face.corners.map(([a,v,t])=>[x+dx+a*b.w,y+dy+v*b.h,z+dz+t*b.d]);
   quad(out,verts,paint,face.shade+4*(glass?mat:materialFor(id,fi))+(fi===2||fi===3?512*((state?.facing||0)&3):0));
  }
 }
 if(id===B.FLOWER_POT){
  cube(dest,x+.43,y+.33,z+.43,.14,.33,.14,rgb('#608360'));
  cube(dest,x+.36,y+.55,z+.36,.28,.12,.28,rgb('#cf95a7'));
  cube(dest,x+.41,y+.65,z+.41,.18,.08,.18,rgb('#e3c6a4'));
 }
}
