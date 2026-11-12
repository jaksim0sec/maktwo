export const BUILDING_DEFAULTS = Object.freeze({unit:1, buildingDensity:.67});

export const stairModule = unit => ({rise:unit/4, run:unit*.35, width:unit*1.2, landing:unit*1.4});

const EPS = 1e-7;
export const containsRect = (r,x,z) => x>=r.x0 && x<r.x1 && z>=r.z0 && z<r.z1;

export function cutPolygonSpans(outline, axis, fixed) {
  const values = [];
  const k = axis==='x' ? 0 : 1, j = 1-k;
  for (let i=0; i<outline.length; i++) {
    const a=outline[i], b=outline[(i+1)%outline.length];
    if ((a[j]<=fixed && b[j]>fixed) || (b[j]<=fixed && a[j]>fixed)) {
      values.push(a[k]+(b[k]-a[k])*(fixed-a[j])/(b[j]-a[j]));
    }
  }
  values.sort((a,b)=>a-b);
  const spans=[];
  for(let i=0;i+1<values.length;i+=2)if(values[i+1]-values[i]>EPS)spans.push([values[i],values[i+1]]);
  return spans;
}

export function cutPolygon(outline,axis,fixed){return cutPolygonSpans(outline,axis,fixed)[0]??null;}
export const insidePolygon=(outline,x,z)=>cutPolygonSpans(outline,'x',z).some(([left,right])=>x>=left&&x<right);

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

/** Give a kiosk the same entry direction as its actual exterior/roof port.
 * The sales area and a separate back-of-house room share ONE doorway in a solid partition.
 */
export function orientShopModule(v,side=0) {
 const p=v.ports?.[side],floor=v.floors?.[0];
 if(!p||!floor)return false;
 const {x0,x1,z0,z1}=v,pad=.55,cx=(x0+x1)/2,cz=(z0+z1)/2;
 const alongZ=side===0||side===2,depth=alongZ?z1-z0:x1-x0;
 const divider=side===0?z0+depth*.68:side===2?z1-depth*.68:side===1?x1-depth*.68:x0+depth*.68;
 const sale=alongZ
  ?{x0:x0+pad,x1:x1-pad,z0:side===0?z0+pad:divider,z1:side===0?divider:z1-pad}
  :{x0:side===3?x0+pad:divider,x1:side===3?divider:x1-pad,z0:z0+pad,z1:z1-pad};
 const store=alongZ
  ?{x0:x0+pad,x1:x1-pad,z0:side===0?divider:z0+pad,z1:side===0?z1-pad:divider}
  :{x0:side===3?divider:x0+pad,x1:side===3?x1-pad:divider,z0:z0+pad,z1:z1-pad};
 const halfOpening=Math.min(.85,Math.max(.55,p.width/2-.3));
 const entry=alongZ?{a:[p.x-halfOpening,p.z],b:[p.x+halfOpening,p.z]}
  :{a:[p.x,p.z-halfOpening],b:[p.x,p.z+halfOpening]};
 const backDoor=alongZ?{a:[cx-.7,divider],b:[cx+.7,divider]}
  :{a:[divider,cz-.7],b:[divider,cz+.7]};
 floor.rooms=[
  {...sale,kind:v.program==='workshops'?'service':'shop',door:entry},
  {...store,kind:'service',door:backDoor}
 ];
 floor.partitions=alongZ?[
  {a:[x0+pad,divider],b:[cx-.7,divider],kind:'partition'},
  {a:[cx+.7,divider],b:[x1-pad,divider],kind:'partition'}
 ]:[
  {a:[divider,z0+pad],b:[divider,cz-.7],kind:'partition'},
  {a:[divider,cz+.7],b:[divider,z1-pad],kind:'partition'}
 ];
 v.frontSide=side;
 return true;
}

export function designShopModule(v,unit,random) {
  const {x0,x1,z0,z1,y0}=v;
  if(x1-x0<4||z1-z0<4)return false;
  const c=Math.min(.9,(x1-x0)/7,(z1-z0)/7),x=(x0+x1)/2,z=(z0+z1)/2;
  const outline=[[x0+c,z0],[x1-c,z0],[x1,z0+c],[x1,z1-c],[x1-c,z1],[x0+c,z1],[x0,z1-c],[x0,z0+c]];
  const doors=[],ports=[];
  for(const [px,pz,dx,dz,edge] of [[x,z0,0,-1,0],[x1,z,1,0,2],[x,z1,0,1,4],[x0,z,-1,0,6]]) {
    ports.push({x:px,z:pz,y:y0,dx,dz,edge,width:Math.min(unit*1.6,2.5),building:v.id,level:0,open:false});
  }
  if(v.support===null){const p=ports[v.frontSide??Math.floor(random(22)*4)];p.open=true;doors.push(p);}
  const top=y0+Math.max(4,Math.round((3+random(44)*.75)*unit));
  const floor={outline,holes:[],partitions:[],doors,rooms:[],corridors:[],band:0,key:'shop',program:v.program,level:0,y:y0,top};
  Object.assign(v,{y1:top,floors:[floor],ports,roof:{outline,y:top,holes:[]},storeyHeight:top-y0,stairs:[],entryLevel:0,typology:v.support===null?'골목 점포':'옥상 증축 점포'});
  orientShopModule(v,v.frontSide??0);
  return true;
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
  const highRise=volume.highRise;
  const skyLevels=new Set(highRise?[12,26,46,69,94,129,171,220,275,337,407,482,560,635].map(y=>Math.round((y+((volume.precinct??0)%5-2)*1.25)/storeyHeight)).filter(i=>i>0&&i<count):[]);
  const capX=Math.max(0,hw-Math.max(eu+unit,4*unit));
  const capZ=Math.max(0,Math.min(hd-near-2*unit,atrium?hd*.30:Infinity));
  const retreat=Math.min(capX*(highRise?.82:1),capZ*(highRise?.58:1),hw*(highRise?.17+.16*random(72):.09+.12*random(72)),(highRise?7:3)*unit);
  const chamfer=Math.min(hw*.22,hd*.20,unit*(.75+2.4*random(71)));

  function geometry(band,program,pattern=0) {
    // Rear and side wings step inward at different rates while the stair core stays fixed.
    const left=hw-band*retreat*(highRise?.17+.2*random(74):.3), right=hw-band*retreat*(highRise?.35+.35*random(75):.5);
    const frontDepth=hd-(highRise?band*retreat*.28:0), backDepth=hd-band*retreat;
    const c=Math.min(left*.36,right*.36,backDepth*.36,chamfer*(highRise?1+.38*band*random(76):1));
    const c2=chamfer*(.35+.55*random(73));
    const front=-frontDepth+c+unit*.4, back=backDepth-c-unit*.4;
    const frontCorners=[[-left+c,-frontDepth],[right-c2,-frontDepth],[right,-frontDepth+c2]];
    const side=[];
    if(highRise&&right>eu+unit*2&&backDepth>unit*5) {
      const start=backDepth*.42,end=backDepth*.70;
      const recess=Math.min(right-eu-unit,unit*(1.4+.65*pattern));
      if(end<backDepth-c)side.push([right,start],[right-recess,start],[right-recess,end],[right,end]);
    }
    const rearEdge=4+side.length,sideEdge=6+side.length;
    const outline=[...frontCorners,...side,[right,backDepth-c],[right-c,backDepth],[-left+c2,backDepth],
      [-left,backDepth-c2],[-left,-frontDepth+c]].map(([u,v])=>point(u,v));
    const corridors=[rect(-passage,-frontDepth,passage,backDepth,'corridor'),rect(-left,front,eu,front+unit*1.6,'cross-corridor')];
    const loop=highRise&&(program==='market'||program==='court'||program==='exchange');
    const rear=loop?back-unit*1.6:back;
    if(loop)corridors.push(rect(-left+c,rear,right-c,back,'cross-corridor'));
    const gallery=loop&&program!=='court'&&left-passage>unit*7;
    const galleryEdge=-left+c+unit*1.6;
    if(gallery)corridors.push(rect(-left+c,front,galleryEdge,back,'gallery-corridor'));
    if(highRise&&program==='exchange')corridors.push(rect(-passage,front+unit*1.6,passage,front+unit*3.4,'lobby-corridor'));
    const rooms=[], partitions=[];
    const shop=highRise?program==='market'||program==='shops'||program==='exchange':mall||volume.type===0||volume.type===3;
    const roomLength=(highRise?(shop?2.25:program==='workshops'?5.8:program==='court'?4.2:3.1):mall?4:volume.type===3?2.8:volume.type===4?6:3.6)*unit;
    for (const side of [-1,1]) {
      if (side<0 && atrium&&(!highRise||program==='court')) continue;
      const wallU=side*passage, outer=side<0?(gallery?galleryEdge:-left):right;
      // Every market bay must own its complete footprint; never leave an
      // enormous room-shaped void between the shop and the outside wall.
      const edgeU=outer;
      const storageSplit=highRise&&shop&&Math.abs(edgeU-wallU)>6*unit
        ?wallU+side*Math.min(4.1*unit,Math.abs(edgeU-wallU)*.62):edgeU;
      if (Math.abs(edgeU-wallU)<1.2*unit) continue;
      for (let start=front+unit*1.6, bay=0; start+1.8*unit<=rear; bay++) {
        const end=Math.min(rear,start+roomLength*(highRise?.85+.14*((bay+pattern)%4):1));
        const next=end;
        if (side>0 && start<near+stair.landing && end>far-stair.landing){start=next;continue;}
        const door0=(start+end)/2-unit*.55+(highRise&&program==='housing'?(bay%2===0?.26:-.26)*unit:0),door1=door0+unit*1.1;
        rooms.push({...rect(Math.min(wallU,storageSplit),start,Math.max(wallU,storageSplit),end,shop?'shop':program==='workshops'||volume.type===4?'service':'room'),
          door:wall(wallU,door0,wallU,door1,'door')});
        const frontage=shop?'shopfront':'partition';
        partitions.push(wall(wallU,start,wallU,door0,frontage),wall(wallU,door1,wallU,end,frontage),
          wall(wallU,end,edgeU,end,'partition'));
        if(shop&&storageSplit!==edgeU) {
          // Real rear store/workroom, divided from the customer-facing unit.
          // A centered aperture is deliberately left free for circulation.
          const backDoor0=(start+end)/2-unit*.49,backDoor1=(start+end)/2+unit*.49;
          rooms.push({...rect(Math.min(storageSplit,edgeU),start,Math.max(storageSplit,edgeU),end,'service'),
            door:wall(storageSplit,backDoor0,storageSplit,backDoor1,'door')});
          partitions.push(wall(storageSplit,start,storageSplit,backDoor0,'partition'),
            wall(storageSplit,backDoor1,storageSplit,end,'partition'));
        }
        if (start===front+unit*1.6 || (side>0 && start-roomLength<near+stair.landing)) {
          partitions.push(wall(wallU,start,edgeU,start,'partition'));
        }
        // The rear service partition is owned by the room pair above.
        if(gallery&&side<0&&shop) {
          const display=(start+end)/2;
          partitions.push(wall(edgeU,start,edgeU,display-unit*.65,'shopfront'),wall(edgeU,display+unit*.65,edgeU,end,'shopfront'));
        }
        if(highRise&&program==='housing'&&Math.abs(edgeU-wallU)>unit*3) {
          const internal=wallU+(edgeU-wallU)*.44;
          // Entry and living space share an opening into a separate back room.
          partitions.push(wall(internal,start,internal,door0,'partition'),wall(internal,door1,internal,end,'partition'));
        }
        if(highRise&&program==='workshops'&&Math.abs(edgeU-wallU)>unit*4) {
          const storage=edgeU-(edgeU-wallU)*.25;
          partitions.push(wall(storage,start,storage,door0,'partition'),wall(storage,door1,storage,end,'partition'));
        }
        start=next;
      }
    }
    return {outline,corridors,rooms,partitions,front,left,frontDepth,backDepth,rearEdge,sideEdge};
  }

  const setbacks=highRise?[0,1.05+.25*random(77),.4+.18*random(78),1.55+.35*random(79),2]:[0,1,2];
  const shapes=new Map();
  const cuts=[.10+.06*random(80),.30+.09*random(81),.56+.07*random(82),.80+.10*random(83)];
  for (let level=0; level<count; level++) {
    const band=level<=entryLevel?0:highRise?cuts.filter(c=>level/count>c).length:level/count>.76?2:level/count>.44?1:0;
    const hasAtrium=atrium&&level>0&&level<=Math.min(count-1,4);
    const order=volume.program==='workshops'?['workshops','market','housing','exchange','housing']:
      volume.program==='housing'?['shops','housing','workshops','exchange','housing']:['market','workshops','housing','exchange','housing'];
    let program=highRise?order[band]:undefined;
    if(highRise&&(level===entryLevel||skyLevels.has(level)))program=level/count>.8?'housing':'exchange';
    if(hasAtrium&&highRise)program='court';
    const pattern=highRise?(Math.floor((volume.phase??0)*7)+level)%4:0;
    const key=band+':'+program+':'+pattern;
    if(!shapes.has(key))shapes.set(key,geometry(setbacks[band],program,pattern));
    const shape=shapes.get(key),y=volume.y0+level*storeyHeight;
    const holes=[];
    if (level>0) holes.push(shaft);
    if(hasAtrium)holes.push(atrium);
    floors.push({...shape,band,key,program,level,y,top:y+storeyHeight,holes,doors:[]});
    if (level!==entryLevel && level!==0 && !skyLevels.has(level)) continue;
    for (const [u,v,du,dv,edge] of [[0,-shape.frontDepth,0,-1,0],[0,shape.backDepth,0,1,shape.rearEdge],[-shape.left,shape.front+unit*.8,-1,0,shape.sideEdge]]) {
      const [x,z]=point(u,v), [dx,dz]=turn?[dv,-du]:[du,dv];
      const port={x,y,z,dx,dz,edge,width:unit*(highRise?2.35:1.4),building:volume.id,level,open:false};
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
  Object.assign(volume,{floors,storeyHeight,stairs,ports,roof,entryLevel,typology,stairFacing:turn?2:4,roofAccess:[roofX,volume.y1,roofZ]});
  return true;
}

export function buildingAt(building,x,y,z) {
  const floor=storeyAt(building,y);
  if (!floor) return false;
  if (!insidePolygon(floor.outline,x,z)) return false;
  // A stairwell still belongs to this building; the atrium has no floor area on upper storeys.
  return !floor.holes.some(h=>h.kind==='atrium' && containsRect(h,x,z));
}
