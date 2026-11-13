// Local floor plans, read front to rear. Letters name rooms. + is circulation,
// g is an open access gallery, b a balcony, o a void, and . an open setback.
export const BLUEPRINTS = {
  gallery: {
    name:'복도식 아파트', program:'housing', room:'room',
    rows:['g+++','gA++','gB++','gC++','g+++']
  },
  balcony: {
    name:'베란다형 공동주택', program:'housing', room:'room',
    rows:['.+++','bA++','.B++','bC++','.+++']
  },
  school: {
    name:'ㄷ자 교사동', program:'court', room:'classroom',
    rows:['++++','AA+B','..+B','..+C','DD+C']
  },
  corner: {
    name:'ㄱ자 상가동', program:'market', room:'shop',
    rows:['++++','AA+B','..+B','..+C','..+C']
  },
  arcade: {
    name:'긴 복도형 대형상가', program:'market', room:'shop',
    rows:['++++','AA+B','CC+D','++++','EE+F','GG+H','++++']
  },
  department: {
    name:'아트리움 백화점', program:'exchange', room:'shop',
    rows:['++++','+o+A','+o++','+o+C','++++']
  },
  ring: {
    name:'ㅇ자 중정동', program:'court', room:'classroom',
    rows:['++++','+o+A','+o+B','+o+C','++++']
  }
};

const directions=[[0,-1],[1,0],[0,1],[-1,0]];
const circulation=cell=>cell==='+'||cell==='g'||cell==='b';
const openEdge=cell=>cell==='g'||cell==='b';
const isRoom=cell=>cell>='A'&&cell<='Z';

/** Fit the same circulation plan to a lot and a continuous stair core. */
export function fitBlueprint(key,{left,right,frontDepth,backDepth,passage,coreRight,unit,point,rect,wall}) {
  const {rows,room}=BLUEPRINTS[key];
  const depth=frontDepth+backDepth;
  const u=[-left,-left+Math.min(1.7*unit,(left-passage)*.48),-passage,coreRight,right];
  const v=Array.from({length:rows.length+1},(_,i)=>i===rows.length?backDepth:-frontDepth+depth*i/rows.length);
  if(u[1]-u[0]<1.45||u[2]-u[1]<2.05||u[4]-u[3]<(rows.some(row=>isRoom(row[3]))?2.1:.1)||depth<11)return null;
  const corridors=[],rooms=[],partitions=[],plateRuns=[],edges=[],voidCells=[],roomCells=new Map();
  const cell=(x,z)=>rows[z]?.[x]??'.';
  const filled=(x,z)=>cell(x,z)!=='.';
  const corners=(x,z)=>[[u[x],v[z]],[u[x+1],v[z]],[u[x+1],v[z+1]],[u[x],v[z+1]]];
  const segment=(x,z,side)=>{
    const points=corners(x,z);
    return [points[side],points[(side+1)%4]];
  };
  const drawWall=(a,b,kind)=>wall(...a,...b,kind);
  // Merge floor plates by contiguous runs so distant roofs keep their open
  // courtyards without submitting a triangle for each room.
  for(let z=0;z<rows.length;z++)for(let x=0;x<rows[z].length;){
    if(!filled(x,z)||cell(x,z)==='o'){x++;continue;}
    const start=x++;
    while(x<rows[z].length&&filled(x,z)&&cell(x,z)!=='o')x++;
    const previous=plateRuns.find(p=>p.start===start&&p.end===x&&p.last===z);
    if(previous)previous.last++;
    else plateRuns.push({start,end:x,first:z,last:z+1});
  }
  const plates=plateRuns.map(p=>rect(u[p.start],v[p.first],u[p.end],v[p.last]));
  for(let z=0;z<rows.length;z++)for(let x=0;x<rows[z].length;x++){
    const type=cell(x,z);
    if(type==='.')continue;
    if(type==='o')voidCells.push([x,z]);
    if(circulation(type)){
      const kind=type==='g'?'open-corridor':type==='b'?'balcony':'corridor';
      corridors.push(rect(u[x],v[z],u[x+1],v[z+1],kind));
    }
    if(isRoom(type)){
      if(!roomCells.has(type))roomCells.set(type,[]);
      roomCells.get(type).push([x,z]);
    }
    directions.forEach(([dx,dz],side)=>{
      if(filled(x+dx,z+dz))return;
      const [a,b]=segment(x,z,side);
      edges.push({a,b,side,rail:openEdge(type),access:type==='+',shop:isRoom(type)&&room==='shop'});
    });
  }

  for(const [type,cells] of roomCells){
    const xs=cells.map(([x])=>x),zs=cells.map(([,z])=>z);
    const bounds=rect(u[Math.min(...xs)],v[Math.min(...zs)],u[Math.max(...xs)+1],v[Math.max(...zs)+1],room);
    const boundary=cells.flatMap(([x,z])=>directions.flatMap(([dx,dz],side)=>{
      const neighbor=cell(x+dx,z+dz);
      if(neighbor===type||neighbor==='.')return [];
      const [a,b]=segment(x,z,side);
      return [{a,b,neighbor,length:Math.hypot(b[0]-a[0],b[1]-a[1])}];
    }));
    const choices=boundary.filter(e=>circulation(e.neighbor)&&e.neighbor!=='b'&&e.length>=1.65);
    choices.sort((a,b)=>Number(b.neighbor==='g')-Number(a.neighbor==='g')||b.length-a.length);
    if(!choices.length)return null;
    const entry=choices[0],balcony=boundary.find(e=>e.neighbor==='b'&&e.length>=1.65);
    const doors=[];
    for(const e of boundary){
      const {a,b,neighbor,length}=e;
      // Shared unit walls are owned by one room. Void faces use the atrium railing.
      if(neighbor==='o'||isRoom(neighbor)&&neighbor<type)continue;
      const kind=room==='shop'&&circulation(neighbor)?'shopfront':room==='classroom'&&circulation(neighbor)?'classroom-wall':'partition';
      if(e!==entry&&e!==balcony){
        partitions.push(drawWall(a,b,kind));
        continue;
      }
      const opening=Math.min(.72,length*.27)/length;
      const p=[a[0]+(b[0]-a[0])*(.5-opening),a[1]+(b[1]-a[1])*(.5-opening)];
      const q=[a[0]+(b[0]-a[0])*(.5+opening),a[1]+(b[1]-a[1])*(.5+opening)];
      partitions.push(drawWall(a,p,kind),drawWall(q,b,kind));
      doors.push({edge:e,door:drawWall(p,q,'door')});
    }
    rooms.push({...bounds,door:doors.find(d=>d.edge===entry).door,openings:doors.map(d=>d.door)});
  }

  const samePoint=(a,b)=>a[0]===b[0]&&a[1]===b[1];
  const ordered=[edges.shift()];
  while(edges.length){
    const i=edges.findIndex(e=>samePoint(e.a,ordered.at(-1).b));
    if(i<0)return null;
    ordered.push(edges.splice(i,1)[0]);
  }
  const merged=[];
  for(const edge of ordered){
    const prev=merged.at(-1);
    if(prev&&prev.side===edge.side&&prev.rail===edge.rail&&prev.access===edge.access&&prev.shop===edge.shop)prev.b=edge.b;
    else merged.push(edge);
  }
  const outline=merged.map(({a})=>point(...a));
  const ports=directions.flatMap(([dx,dz],side)=>{
    const candidates=merged.map((edge,i)=>({...edge,i,length:Math.hypot(edge.b[0]-edge.a[0],edge.b[1]-edge.a[1])}))
      .filter(e=>e.side===side&&e.access&&((side!==1&&side!==3)||e.a[0]===(side===1?right:-left))&&e.length>=Math.max(2,unit*1.5));
    candidates.sort((a,b)=>b.length-a.length);
    const best=candidates[0];
    if(!best)return [];
    const [a,b]=[best.a,best.b];
    return [{u:(a[0]+b[0])/2,v:(a[1]+b[1])/2,dx,dz,edge:best.i,width:Math.min(unit*2.35,best.length-1)}];
  });
  const voidRect=voidCells.length?rect(u[voidCells[0][0]],v[voidCells[0][1]],
    u[voidCells.at(-1)[0]+1],v[voidCells.at(-1)[1]+1],'atrium'):null;
  if(!ports.some(p=>p.dz===-1))return null;
  return {outline,corridors,rooms,partitions,plates,ports,voidRect,
    railEdges:merged.map(e=>e.rail),shopEdges:merged.map(e=>e.shop),blueprint:key};
}
