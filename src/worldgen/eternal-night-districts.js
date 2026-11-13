import {CORE_ZONE, districtIdAt, sampleFloorRect} from './eternal-night-core-floor.js';
import {BUILDING_DEFAULTS, buildingAt, cutPolygon, designBuilding, stairRisers} from './eternal-night-buildings.js';
import {designRoofWalkway, designWalkways, segmentY} from './eternal-night-walkways.js';
import {populatePrecincts} from './eternal-night-precincts.js';
import {planCoreStations,stationIntersectsCell} from './eternal-night-stations.js';
function populate(layout, grid, partitioned, {unit,buildingDensity,highRise}) {
  const {size, step, left, top, luxury, noise, buildable} = grid;
  const {labels, sections, tangentX, tangentZ} = partitioned;
  const occupied = new Uint8Array(labels.length), volumes=[], roofLinks=[];
  const landmarks=new Set();
  const make = (x,z,w,d,y0,type,section,support,weight) => ({
    id:volumes.length, x0:left+x*step, x1:left+(x+w)*step, z0:top+z*step, z1:top+(z+d)*step,
    y0,type,section,support,luxury:weight,gx:x,gz:z,gw:w,gd:d,highRise,
  });
  // Maintain original floor pitch and stair clearance while slightly reducing skyline.
 const HEIGHT_FACTOR=.92;
 const height = (v,desired) => {
   desired=Math.max(1,Math.round(desired*HEIGHT_FACTOR));
    const risers=stairRisers(v,unit);
    if (!risers) return false;
    const pitch=risers*unit/4;
    const floors=Math.min(desired,Math.floor((layout.floorTop-v.y0)/pitch)-1);
    if(floors<1)return false;
    v.y1=v.y0+floors*pitch;
    return true;
  };
  const cap=buildingDensity*.84;
  const minCells=Math.max(2,Math.ceil(6.4*unit/step));
  const minLength=Math.ceil(7.2*unit/step);
  for (const section of sections) {
    if (!cap || section.cells.length < minCells**2) continue;
    const score = i => .52 * luxury[i] + .22 * noise[i] + .26 * fract(layout.noiseSeed,i,4);
    const ranked = section.cells.slice().sort((a,b)=>score(b)-score(a)||a-b);
    let coverage = 0;
    for (const i of ranked) {
      if (coverage >= cap*ranked.length) break;
      const x=i%size,z=Math.floor(i/size);
      if (occupied[i] || !buildable[i]) continue;
      const l=.62*luxury[i]+.38*section.luxury;
      const tier=clamp(l/layout.districtLuxuryMax,0,1);
      const coordinate=Math.imul(Math.floor(left+(x+.5)*step),0x27d4eb2d)^Math.imul(Math.floor(top+(z+.5)*step),0x165667b1);
      const random = salt => fract(layout.noiseSeed,coordinate,salt);
      const roll=random(2), commercial=.05+.28*tier+.11*noise[i], arcade=commercial+.18;
      const type=roll<commercial?2:roll<arcade?3:roll<arcade+.12?4:roll<arcade+.35?0:1;
      const preset=BUILDING_TYPES[type];
      const range=Math.max(1,preset.width-1);
      let w=minCells+Math.floor(random(7)*range);
      let d=minCells+Math.floor(random(8)*range);
      if ((w>d)!==(Math.abs(tangentX[i])>=Math.abs(tangentZ[i]))) [w,d]=[d,w];
      let root=null;
      while(w>=minCells && d>=minCells && Math.max(w,d)>=minLength) {
        const bx=x-Math.floor(w/2),bz=z-Math.floor(d/2);
        if (bx>=0 && bz>=0 && bx+w<=size && bz+d<=size) {
          let valid=true;
          for(let dz=-1;dz<=d&&valid;dz++)for(let dx=-1;dx<=w;dx++) {
            const tx=bx+dx,tz=bz+dz;
            if(tx<0||tz<0||tx>=size||tz>=size)continue;
            const j=tz*size+tx;
            if(occupied[j] || (dx>=0&&dx<w&&dz>=0&&dz<d&&(labels[j]!==section.id||!buildable[j]))) {
              valid=false;
              break;
            }
          }
          if(valid) {
            const candidate=make(bx,bz,w,d,layout.floorY,type,section.id,null,l);
            const landmark=highRise&&!landmarks.has(section.district)&&Math.min(w,d)>=3;
            const base=2+Math.floor(preset.floors*(.55+1.15*tier+.5*noise[i])*random(9)**1.4);
            const floors=landmark?70+Math.floor(random(17)*11):highRise?Math.min(69,base+Math.floor((7+44*tier)*random(16)**2)):base;
            if(height(candidate,floors) && designBuilding(candidate,unit,random)){
              root=candidate;
              if(landmark&&root.floors.length>=Math.round(70*HEIGHT_FACTOR))landmarks.add(section.district);
            }
            break;
          }
        }
        if(w>=d)w--;else d--;
      }
      if(!root)continue;
      volumes.push(root);
      for(let dz=0;dz<root.gd;dz++)for(let dx=0;dx<root.gw;dx++)occupied[(root.gz+dz)*size+root.gx+dx]=1;
      coverage+=root.gw*root.gd;

      // Roof additions are accepted only if the occupied slab and the stairs can support and serve them.
      if(random(20)>=.38+.30*noise[i])continue;
      const roofX=root.roof.outline.map(p=>p[0]),roofZ=root.roof.outline.map(p=>p[1]);
      const x0=Math.min(...roofX)+2*unit,x1=Math.max(...roofX)-2*unit;
      const z0=Math.min(...roofZ)+2*unit,z1=Math.max(...roofZ)-2*unit;
      const shaft=root.roof.holes[0],clear=2*unit;
      const strips=[[x0,z0,shaft.x0-clear,z1],[shaft.x1+clear,z0,x1,z1],
        [x0,z0,x1,shaft.z0-clear],[x0,shaft.z1+clear,x1,z1]];
      const start=Math.floor(random(32)*strips.length);
      for(let n=0;n<strips.length;n++) {
        const [a,b,c,d]=strips[(start+n)%strips.length];
        const w=Math.min(c-a,unit*(8+14*random(24+n))),h=Math.min(d-b,unit*(8+14*random(28+n)));
        if(Math.min(w,h)<6.4*unit || Math.max(w,h)<7.2*unit)continue;
        const x=a+(c-a-w)*random(33+n),z=b+(d-b-h)*random(37+n);
        const child=make((x-left)/step,(z-top)/step,w/step,h/step,root.y1,5,section.id,root.id,l);
        const variant=salt=>fract(layout.noiseSeed,coordinate^Math.imul(n+1,0x9e3779b1),salt);
        if(!height(child,2+Math.floor(variant(40)*(5+5*tier)))||!designBuilding(child,unit,variant))continue;
        const link=designRoofWalkway(child,root,unit);
        if(!link)continue;
        roofLinks.push(link);volumes.push(child);
        break;
      }
    }
  }
  return {volumes,occupied,roofLinks};
}
export const BUILDING_TYPES = [
  {label:'상가·주택', color:[196,140,96], width:4, floors:9},
  {label:'공동주택', color:[123,167,162], width:5, floors:13},
  {label:'대형 상업동', color:[149,155,216], width:8, floors:26},
  {label:'아케이드', color:[212,170,109], width:7, floors:9},
  {label:'설비·물류', color:[163,147,127], width:7, floors:8},
  {label:'상층 증축', color:[155,185,143], width:4, floors:7},
  {label:'연결교', color:[191,179,235]},
];
const NEIGHBORS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fract = (seed, index, salt = 0) => {
  let n = Math.imul(seed ^ index, 0x45d9f3b) ^ Math.imul(salt + 1, 0x9e3779b1);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000;
};

class Queue {
  entries = [];
  push(node) {
    const a = this.entries;
    let i = a.length;
    a.push(node);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= node[0]) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = node;
  }
  pop() {
    const a = this.entries, first = a[0], last = a.pop();
    if (!a.length) return first;
    let i = 0;
    while (i * 2 + 1 < a.length) {
      let child = i * 2 + 1;
      if (child + 1 < a.length && a[child + 1][0] < a[child][0]) child++;
      if (a[child][0] >= last[0]) break;
      a[i] = a[child];
      i = child;
    }
    a[i] = last;
    return first;
  }
}

function partition(layout, grid) {
  const {size, ids, luxury, noise} = grid;
  const labels = new Int32Array(ids.length).fill(-1);
  const distance = new Float64Array(ids.length).fill(Infinity);
  const tangentX = new Float32Array(ids.length), tangentZ = new Float32Array(ids.length);
  const strength = new Float32Array(ids.length);
  const centers = [], queue = new Queue();
  const neighborhood = (i, dx, dz) => {
    const x = i % size + dx, z = Math.floor(i / size) + dz;
    return x >= 0 && x < size && z >= 0 && z < size ? z * size + x : -1;
  };
  const localNoise = (i, dx, dz) => {
    const n = neighborhood(i, dx, dz);
    return ids[n] === ids[i] ? noise[n] : noise[i];
  };
  const addCenter = i => {
    labels[i] = centers.length;
    distance[i] = 0;
    centers.push({id:labels[i], district:ids[i], index:i, cells:[], luxury:0, noise:0});
    queue.push([0, i]);
  };

  for (let i = 0; i < ids.length; i++) {
    if (ids[i] < 0) continue;
    // The minor axis of the local structure tensor follows the noise band.
    let xx = 0, zz = 0, xz = 0;
    for (const [dx,dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) {
      const j = neighborhood(i, dx, dz);
      if (ids[j] !== ids[i]) continue;
      const gx = localNoise(j, 1, 0) - localNoise(j, -1, 0);
      const gz = localNoise(j, 0, 1) - localNoise(j, 0, -1);
      xx += gx * gx;
      zz += gz * gz;
      xz += gx * gz;
    }
    const angle = .5 * Math.atan2(2 * xz, xx - zz);
    tangentX[i] = -Math.sin(angle);
    tangentZ[i] = Math.cos(angle);
    strength[i] = Math.hypot(xx - zz, 2 * xz) / (xx + zz + .015);
  }

  for (let district = 0; district < 4; district++) {
    const ranked = [];
    for (let i = 0; i < ids.length; i++) {
      if (ids[i] !== district) continue;
      const l = luxury[i] / layout.districtLuxuryMax;
      const score = .57 * l + .29 * noise[i] + .10 * noise[i] * (1 - strength[i]) + .04 * fract(layout.noiseSeed, i, 1);
      ranked.push([score, i, l]);
    }
    ranked.sort((a,b) => b[0] - a[0] || a[1] - b[1]);
    const target = Math.max(1, Math.round(ranked.length / 265));
    const chosen = [];
    for (const [,i,l] of ranked) {
      const spacing = 11 + 8 * l;
      if (chosen.some(j => Math.hypot(i % size - j % size, Math.floor(i / size) - Math.floor(j / size)) < spacing)) continue;
      addCenter(i);
      chosen.push(i);
      if (chosen.length >= target) break;
    }
  }

  const expand = () => {
    while (queue.entries.length) {
      const [cost, i] = queue.pop();
      if (cost !== distance[i]) continue;
      for (const [dx,dz] of NEIGHBORS) {
        const j = neighborhood(i, dx, dz);
        if (ids[j] !== ids[i]) continue;
        if (dx && dz && (ids[neighborhood(i, dx, 0)] !== ids[i] || ids[neighborhood(i, 0, dz)] !== ids[i])) continue;
        const length = Math.hypot(dx, dz);
        const alignment = Math.abs((dx * tangentX[i] + dz * tangentZ[i]) / length);
        const next = cost + length * (1 + .8 * (1 - (noise[i] + noise[j]) / 2) +
          1.2 * strength[i] * (1 - alignment) + .6 * Math.abs(luxury[i] - luxury[j]) / layout.districtLuxuryMax);
        if (next >= distance[j]) continue;
        distance[j] = next;
        labels[j] = labels[i];
        queue.push([next, j]);
      }
    }
  };
  expand();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i] >= 0 && labels[i] < 0) {
      addCenter(i);
      expand();
    }
    if (labels[i] >= 0) {
      const section = centers[labels[i]];
      section.cells.push(i);
      section.luxury += luxury[i];
      section.noise += noise[i];
    }
  }
  for (const section of centers) {
    section.luxury /= section.cells.length;
    section.noise /= section.cells.length;
  }
  return {labels, sections:centers, tangentX, tangentZ};
}


function assignPrecinctLuxury(layout,volumes,walkways) {
  const stops=Array.from({length:volumes.length},()=>new Map());
  const adjacency=Array.from({length:volumes.length},()=>[]);
  const distance=new Float64Array(volumes.length).fill(Infinity),queue=new Queue();
  const addStop=(port,value)=>{
    const levels=stops[port.building];
    levels.set(port.level,Math.max(value,levels.get(port.level)??0));
  };
  for(const link of walkways) {
    const [a,b]=link.ports;
    if(!a||a.building===null)continue;
    if(link.kind==='core') {
      distance[a.building]=0;queue.push([0,a.building]);addStop(a,1);
    } else if(b&&b.building!==null) {
      const length=link.segments.reduce((s,part)=>s+part.length,0);
      const cost=length+Math.abs(a.y-b.y)*2+volumes[a.building].storeyHeight+volumes[b.building].storeyHeight;
      adjacency[a.building].push([b.building,cost]);adjacency[b.building].push([a.building,cost]);
      addStop(a,link.typology==='through'?.93:.74);addStop(b,link.typology==='through'?.93:.74);
    } else if(link.kind==='roof') {
      const parent=volumes[a.building].support;
      if(parent!==null) {
        adjacency[a.building].push([parent,32]);adjacency[parent].push([a.building,32]);addStop(a,.51);
      }
    }
  }
  while(queue.entries.length) {
    const [cost,id]=queue.pop();
    if(cost!==distance[id])continue;
    for(const [next,length] of adjacency[id])if(cost+length<distance[next]) {
      distance[next]=cost+length;queue.push([cost+length,next]);
    }
  }
  for(const v of volumes)for(const f of v.floors) {
    const relative=(f.y+v.storeyHeight*.5-layout.floorY)/layout.floorHeight;
    const local=f.level/Math.max(1,v.floors.length-1);
    const service=Math.exp(-distance[v.id]/(layout.width*.55));
    let door=0;
    for(const [level,weight] of stops[v.id])door=Math.max(door,weight*Math.exp(-Math.abs(level-f.level)*.29));
    f.access=clamp(.34*service+.66*door,0,1);
    const floorValue={market:.045,exchange:.105,court:.065,shops:.01,workshops:-.05,housing:-.015}[f.program]??0;
    const scarcity=.16*Math.exp(-((relative-.42)**2)/.058)-.26*Math.max(0,(relative-.60)/.40)**1.3;
    const cheapRoof=(v.support!==null?.10:0)+Math.max(0,local-.78)*.34;
    const variation=(fract(layout.noiseSeed,v.id,30+Math.floor(f.level/5))-.5)*.055;
    f.luxury=clamp(v.luxury*.62+f.access*.21+floorValue+scarcity-cheapRoof+variation,0,layout.districtLuxuryMax);
  }
}

export function createDistrictPlan(layout, resolution = 128, options = {}) {
  if (!Number.isInteger(resolution) || resolution<16 || resolution>192) throw new RangeError('Invalid district resolution');
  const {unit=BUILDING_DEFAULTS.unit,buildingDensity=BUILDING_DEFAULTS.buildingDensity,highRise=false}=options;
  if (!Number.isFinite(unit)||unit<=0)throw new RangeError('Invalid building unit');
  if (!(buildingDensity>=0&&buildingDensity<=1))throw new RangeError('Invalid building density');
  const size = resolution, cells = size*size, step = layout.width/size;
  const left=layout.centerX-layout.halfWidth, top=layout.centerZ-layout.halfWidth;
  const zones=new Uint8Array(cells), luxury=new Float32Array(cells), noise=new Float32Array(cells), ids=new Int8Array(cells).fill(-1);
  sampleFloorRect(layout,left+step/2,top+step/2,size,size,zones,luxury,step,noise);
  for (let i=0; i<cells; i++) if (zones[i]===CORE_ZONE.DISTRICT) {
    ids[i]=districtIdAt(layout,left+(i%size+.5)*step,top+(Math.floor(i/size)+.5)*step);
  }
  const buildable=new Uint8Array(cells);
  const stations=highRise&&options.cityBlueprints!==false&&options.stationSites!==false
    ?planCoreStations(layout,unit,Boolean(options.raisedStation)):{hub:null,stations:[]};
  const reserved=[[layout.centerX,layout.centerZ,layout.centerRadiusSq],
    ...layout.miniShaftCenters.map(([x,z])=>[x,z,layout.miniShaftRadiusSq])];
  for(let i=0;i<cells;i++){
    if(ids[i]<0)continue;
    const x=left+(i%size)*step,z=top+Math.floor(i/size)*step;
    buildable[i]=[[0,0],[1,0],[0,1],[1,1]].every(([dx,dz])=>
      districtIdAt(layout,x+dx*step,z+dz*step)===ids[i]) &&
      !stationIntersectsCell(stations.stations,x,z,step) &&
      reserved.every(([cx,cz,r2])=>
        (clamp(cx,x,x+step)-cx)**2 + (clamp(cz,z,z+step)-cz)**2>r2) ? 1 : 0;
  }
  const grid={size,step,left,top,zones,luxury,noise,ids,buildable,stations:stations.stations,stationHub:stations.hub};
  const partitioned=partition(layout,grid);
  const {volumes,occupied,roofLinks,precincts,lanes}=highRise?
    populatePrecincts(layout,grid,partitioned,{unit,buildingDensity,cityBlueprints:options.cityBlueprints},fract):populate(layout,grid,partitioned,{unit,buildingDensity,highRise});
  const {walkways,links}=designWalkways(layout,{...grid,sections:partitioned.sections},volumes,occupied,unit,highRise,highRise&&options.cityBlueprints!==false);
  for(const link of roofLinks){link.id=walkways.length;walkways.push(link);}
  if(highRise)assignPrecinctLuxury(layout,volumes,walkways);
  const columns=Array.from({length:cells},()=>[]);
  const pathColumns=Array.from({length:cells},()=>[]);
  for (const v of volumes) for (let z=Math.floor(v.gz); z<Math.ceil(v.gz+v.gd); z++) {
    for (let x=Math.floor(v.gx); x<Math.ceil(v.gx+v.gw); x++)columns[z*size+x].push(v);
  }
  const indexPart=(link,part)=>{
    const xs=part.outline.map(p=>p[0]),zs=part.outline.map(p=>p[1]);
    const x0=Math.max(0,Math.floor((Math.min(...xs)-left)/step));
    const x1=Math.min(size-1,Math.floor((Math.max(...xs)-left)/step));
    const z0=Math.max(0,Math.floor((Math.min(...zs)-top)/step));
    const z1=Math.min(size-1,Math.floor((Math.max(...zs)-top)/step));
    const item={link,part};
    for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)pathColumns[z*size+x].push(item);
  };
  for(const link of walkways) {
    for(const part of link.segments)indexPart(link,part);
    for(const part of link.landings)indexPart(link,part);
  }
  return {...grid,...partitioned,volumes,links,walkways,columns,pathColumns,layout,unit,buildingDensity,precincts,lanes};
}

export function districtColumn(plan,x,z) {
  const gx=Math.floor((x-plan.left)/plan.step), gz=Math.floor((z-plan.top)/plan.step);
  if (gx<0||gx>=plan.size||gz<0||gz>=plan.size) return null;
  const index=gz*plan.size+gx;
  return {zone:plan.zones[index], section:plan.labels[index], luxury:plan.luxury[index], noise:plan.noise[index], volumes:plan.columns[index],paths:plan.pathColumns[index]};
}

export function volumeLuxury(plan,volume,y) {
  const level=Math.floor(Math.max(0,y-volume.y0)/volume.storeyHeight);
  if(volume.highRise)return volume.floors[Math.min(level,volume.floors.length-1)].luxury;
  const centerY=volume.y0+(level+.5)*volume.storeyHeight;
  const relative=clamp((centerY-plan.layout.floorY)/plan.layout.floorHeight,0,1);
  const typeBias=[.01,-.055,.09,.065,-.07,-.025,0][volume.type];
  // Middle and upper levels gain access premium, while the last upper additions
  // can be cheaper. The same block of storeys retains its section's base value.
  return clamp(volume.luxury+typeBias+.15*Math.sin(Math.PI*relative)-.17*relative**3,0,plan.layout.districtLuxuryMax);
}

export function districtSample(plan,x,y,z) {
  const column=districtColumn(plan,x,z);
  const volume=column?.volumes.find(v=>buildingAt(v,x,y,z))??null;
  const path=column?.paths.find(({part})=>{
    const cut=cutPolygon(part.outline,'x',z);
    if(!cut||x<cut[0]||x>=cut[1])return false;
    const height=part.y??segmentY(part,x,z);
    return y>=height-plan.unit*.25&&y<height+plan.unit*2.25;
  })?.link??null;
  return {column,volume,path,luxury:volume?volumeLuxury(plan,volume,y):null};
}
