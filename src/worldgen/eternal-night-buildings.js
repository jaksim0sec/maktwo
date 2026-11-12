export const BUILDING_DEFAULTS = Object.freeze({unit:1, buildingDensity:.67});

export const stairModule = unit => ({rise:unit/4, run:unit*.35, width:unit*1.2, landing:unit*1.4});

const EPS = 1e-7;
export const containsRect = (r,x,z) => x>=r.x0 && x<r.x1 && z>=r.z0 && z<r.z1;

export function cutPolygon(outline, axis, fixed) {
  const values = [];
  const k = axis==='x' ? 0 : 1, j = 1-k;
  for (let i=0; i<outline.length; i++) {
    const a=outline[i], b=outline[(i+1)%outline.length];
    if ((a[j]<=fixed && b[j]>fixed) || (b[j]<=fixed && a[j]>fixed)) {
      values.push(a[k]+(b[k]-a[k])*(fixed-a[j])/(b[j]-a[j]));
    }
  }
  return values.length===2 ? [Math.min(...values),Math.max(...values)] : null;
}

export function storeyAt(building,y) {
  const index=Math.floor((y-building.y0)/building.storeyHeight+EPS);
  return building.floors[index] ?? null;
}

export function stairRisers(volume,unit) {
  const u=Math.min(volume.x1-volume.x0,volume.z1-volume.z0)/unit;
  const v=Math.max(volume.x1-volume.x0,volume.z1-volume.z0)/unit;
  if (u<6.4 || v<7.2) return 0;
  if ((volume.type===2 || volume.type===4) && v>=10) return 24;
  return volume.type===3 && v>=8 ? 20 : 16;
}

export function designBuilding(volume, unit, random) {
  const risers=stairRisers(volume,unit);
  if (!risers) return false;
  const stair=stairModule(unit), half=risers/2;
  const turn=volume.x1-volume.x0>volume.z1-volume.z0;
  const cx=(volume.x0+volume.x1)/2, cz=(volume.z0+volume.z1)/2;
  const hw=(turn?volume.z1-volume.z0:volume.x1-volume.x0)/2;
  const hd=(turn?volume.x1-volume.x0:volume.z1-volume.z0)/2;
  const point=(u,v)=>turn ? [cx+v,cz-u] : [cx+u,cz+v];
  const rect=(u0,v0,u1,v1,kind)=>{
    const a=point(u0,v0),b=point(u1,v1);
    return {x0:Math.min(a[0],b[0]),z0:Math.min(a[1],b[1]),x1:Math.max(a[0],b[0]),z1:Math.max(a[1],b[1]),kind};
  };
  const wall=(u0,v0,u1,v1,kind)=>({a:point(u0,v0),b:point(u1,v1),kind});
  const mall=volume.type===2 && hw>=7*unit && hd>=7*unit;
  const passage=unit*(hw<4*unit ? .5 : mall ? 1.5 : .9);
  const stairStart=passage;
  // Keep the stair core beside the spine on wider sites; let the spine share a landing on narrow sites.
  const su=Math.min(stairStart,hw-2*stair.width-unit*.15), eu=su+2*stair.width;
  const near=(half*stair.run+stair.landing)/2;
  const far=near-half*stair.run;
  const shaft=rect(su,far-stair.landing,eu,near,'stair');
  const atrium=mall ? rect(-hw*.68,-hd*.62,-passage-unit,hd*.62,'atrium') : null;
  const storeyHeight=risers*stair.rise;
  const count=Math.round((volume.y1-volume.y0)/storeyHeight);
  const entryLevel=volume.support===null && count>=2 ? 1 : 0;
  const floors=[], stairs=[], ports=[];
  const capX=Math.max(0,hw-Math.max(eu+unit,4*unit));
  const capZ=Math.max(0,Math.min(hd-near-2*unit,atrium?hd*.30:Infinity));
  const retreat=Math.min(capX,capZ,hw*(.09+.12*random(72)),3*unit);
  const chamfer=Math.min(hw*.22,hd*.20,unit*(.75+2.4*random(71)));

  function geometry(band) {
    // Rear and side wings step inward at different rates while the stair core stays fixed.
    const left=hw-band*retreat*.3, right=hw-band*retreat*.5, frontDepth=hd, backDepth=hd-band*retreat;
    const c=chamfer, c2=chamfer*(.35+.55*random(73));
    const outline=[[-left+c,-frontDepth],[right-c2,-frontDepth],[right,-frontDepth+c2],[right,backDepth-c],
      [right-c,backDepth],[-left+c2,backDepth],[-left,backDepth-c2],[-left,-frontDepth+c]].map(([u,v])=>point(u,v));
    const front=-frontDepth+c+unit*.4, back=backDepth-c-unit*.4;
    const corridors=[rect(-passage,-frontDepth,passage,backDepth,'corridor'),rect(-left,front,eu,front+unit*1.6,'cross-corridor')];
    const rooms=[], partitions=[];
    const shop=mall || volume.type===0 || volume.type===3;
    const roomLength=(mall ? 4 : volume.type===3 ? 2.8 : volume.type===4 ? 6 : 3.6)*unit;
    for (const side of [-1,1]) {
      if (side<0 && atrium) continue;
      const wallU=side*passage, edgeU=side<0?-left:right;
      if (Math.abs(edgeU-wallU)<1.2*unit) continue;
      for (let start=front+unit*1.6; start+1.8*unit<=back; start+=roomLength) {
        const end=Math.min(back,start+roomLength);
        if (side>0 && start<near+stair.landing && end>far-stair.landing) continue;
        const door0=(start+end)/2-unit*.55, door1=door0+unit*1.1;
        rooms.push({...rect(Math.min(wallU,edgeU),start,Math.max(wallU,edgeU),end,shop?'shop':volume.type===4?'service':'room'),
          door:wall(wallU,door0,wallU,door1,'door')});
        partitions.push(wall(wallU,start,wallU,door0,'partition'),wall(wallU,door1,wallU,end,'partition'),
          wall(wallU,end,edgeU,end,'partition'));
        if (start===front+unit*1.6 || (side>0 && start-roomLength<near+stair.landing)) {
          partitions.push(wall(wallU,start,edgeU,start,'partition'));
        }
      }
    }
    return {outline,corridors,rooms,partitions,front,left,frontDepth,backDepth};
  }

  const shapes=[geometry(0),geometry(1),geometry(2)];
  for (let level=0; level<count; level++) {
    const band=level<=entryLevel ? 0 : level/count>.76 ? 2 : level/count>.44 ? 1 : 0;
    const shape=shapes[band], y=volume.y0+level*storeyHeight;
    const holes=[];
    if (level>0) holes.push(shaft);
    if (level>0 && atrium && level<=Math.min(count-1,4)) holes.push(atrium);
    floors.push({...shape,level,y,top:y+storeyHeight,holes,doors:[]});
    if (level!==entryLevel && level!==0) continue;
    for (const [u,v,du,dv,edge] of [[0,-shape.frontDepth,0,-1,0],[0,shape.backDepth,0,1,4],[-shape.left,shape.front+unit*.8,-1,0,6]]) {
      const [x,z]=point(u,v), [dx,dz]=turn?[dv,-du]:[du,dv];
      const port={x,y,z,dx,dz,edge,width:unit*1.4,building:volume.id,level,open:false};
      // Additions expose only the roof-facing doorway selected when they are joined.
      if (level===0 && volume.support===null && edge===0) {
        port.open=true;
        floors[level].doors.push(port);
      }
      ports.push(port);
    }
  }

  const roof={outline:floors.at(-1).outline,y:volume.y1,holes:[shaft]};
  const landing=rect(su,far-stair.landing,eu,far,'landing');
  const upperLanding=rect(su,near,eu,near+stair.landing,'landing');
  const rail=(u,a,b,y0,y1)=>{
    const [x0,z0]=point(u,a),[x1,z1]=point(u,b);
    return {from:[x0,y0+unit*1.1,z0],to:[x1,y1+unit*1.1,z1]};
  };
  for (const floor of floors) {
    const y=floor.y, midY=y+half*stair.rise;
    const flights=[{fromY:y,toY:midY},{fromY:midY,toY:floor.top}];
    stairs.push({fromY:y,toY:floor.top,flights,landing:{...landing,y:midY},upperLanding:{...upperLanding,y:floor.top},
      rails:[rail(su+stair.width,near,far,y,midY),rail(eu,far,near,midY,floor.top)],
      get treads() {
        return Array.from({length:risers},(_,i)=>{
          const second=i>=half, n=i%half, offset=second?far+n*stair.run:near-(n+1)*stair.run;
          const u=su+(second?stair.width:0);
          return {...rect(u,offset,u+stair.width,offset+stair.run,'tread'),
            y:y+(i+1)*stair.rise,rise:stair.rise,run:stair.run};
        });
      }});
  }
  const [roofX,roofZ]=point(su+stair.width*1.5,near+stair.landing*.6);
  const typology=mall?'백화점형 상업동':['상가·주택','공동주택','중층 상업동','상가 묶음','설비·물류','상층 증축'][volume.type];
  Object.assign(volume,{floors,storeyHeight,stairs,ports,roof,entryLevel,typology,roofAccess:[roofX,volume.y1,roofZ]});
  return true;
}

export function buildingAt(building,x,y,z) {
  const floor=storeyAt(building,y);
  if (!floor) return false;
  const cut=cutPolygon(floor.outline,'x',z);
  if (!cut || x<cut[0] || x>=cut[1]) return false;
  // A stairwell still belongs to this building; the atrium has no floor area on upper storeys.
  return !floor.holes.some(h=>h.kind==='atrium' && containsRect(h,x,z));
}
