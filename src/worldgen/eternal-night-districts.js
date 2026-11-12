import {CORE_ZONE, districtIdAt, sampleFloorRect} from './eternal-night-core-floor.js';

export const BUILDING_TYPES = [
  {label:'상가·주택', color:[196,140,96], width:4, floors:9},
  {label:'공동주택', color:[123,167,162], width:5, floors:13},
  {label:'업무·상업', color:[149,155,216], width:8, floors:26},
  {label:'아케이드', color:[212,170,109], width:7, floors:9},
  {label:'설비·물류', color:[163,147,127], width:7, floors:8},
  {label:'상층 증축', color:[155,185,143], width:4, floors:7},
  {label:'연결교', color:[191,179,235]},
];
const BRIDGE = 6;
const STOREY = 6;
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

function populate(layout, grid, partitioned) {
  const {size, step, left, top, luxury, noise, buildable} = grid;
  const {labels, sections, tangentX, tangentZ} = partitioned;
  const occupied = new Uint8Array(labels.length);
  const volumes = [];
  const add = (x,z,w,d,y0,y1,type,section,support,weight) => {
    const volume = {id:volumes.length, x0:left+x*step, x1:left+(x+w)*step,
      z0:top+z*step, z1:top+(z+d)*step, y0,y1,type,section,support,luxury:weight, gx:x,gz:z,gw:w,gd:d};
    volumes.push(volume);
    return volume;
  };
  const maxFloors = Math.floor(layout.floorHeight / STOREY) - 1;
  if(maxFloors<1)return {volumes, links:[]};
  const random = (i,salt) => fract(layout.noiseSeed, i, salt);
  for (const section of sections) {
    if (section.cells.length < 4) continue;
    const ranked = section.cells.slice().sort((a,b) => {
      const score = i => .52 * luxury[i] + .22 * noise[i] + .26 * random(i, 4);
      return score(b) - score(a) || a - b;
    });
    let coverage = 0;
    for (const i of ranked) {
      if (coverage >= .56 * ranked.length) break;
      const x = i % size, z = Math.floor(i / size);
      if (occupied[i] || !buildable[i]) continue;
      const l = .62 * luxury[i] + .38 * section.luxury;
      const roll = random(i, 2);
      const type = roll < .14 + .25*l ? 2 : roll < .32 + .26*l ? 3 :
        roll < .46 + .23*l ? 4 : roll < .70 + .16*l ? 0 : 1;
      const preset = BUILDING_TYPES[type];
      let w = 2 + Math.floor(random(i, 7) * (preset.width - 1));
      let d = 2 + Math.floor(random(i, 8) * (preset.width - 1));
      if ((w > d) !== (Math.abs(tangentX[i]) >= Math.abs(tangentZ[i]))) [w,d] = [d,w];
      let bounds;
      while (w >= 2 && d >= 2) {
        const bx = x - Math.floor(w / 2), bz = z - Math.floor(d / 2);
        if (bx >= 0 && bz >= 0 && bx+w <= size && bz+d <= size) {
          let valid = true;
          for (let dz = -1; dz <= d && valid; dz++) for (let dx = -1; dx <= w; dx++) {
            const tx = bx+dx, tz = bz+dz;
            if (tx < 0 || tz < 0 || tx >= size || tz >= size) continue;
            const j = tz*size + tx;
            if (occupied[j] || (dx >= 0 && dx < w && dz >= 0 && dz < d && (labels[j] !== section.id || !buildable[j]))) {
              valid = false;
              break;
            }
          }
          if (valid) {bounds = [bx,bz,w,d]; break;}
        }
        if (w >= d) w--; else d--;
      }
      if (!bounds) continue;
      const [bx,bz,bw,bd] = bounds;
      for (let dz=0; dz<bd; dz++) for (let dx=0; dx<bw; dx++) occupied[(bz+dz)*size+bx+dx] = 1;
      coverage += bw*bd;
      const heightScale = .55 + 1.15*l + .5*noise[i];
      const floors = clamp(2 + Math.floor(preset.floors * heightScale * random(i, 9)**1.4), 1, maxFloors);
      const root = add(bx,bz,bw,bd,layout.floorY,layout.floorY+floors*STOREY,type,section.id,null,l);

      // A supported addition shares only part of its parent's footprint. Independent
      // widths, setbacks and heights create an upper city with its own entrances.
      let parent = root;
      for (let level=0; level<3 && random(i, 20+level) < .42 + .30*noise[i]; level++) {
        if (parent.y1 + 2*STOREY > layout.floorTop) break;
        const cw = Math.max(1, parent.gw - Math.floor(random(i, 24+level)*parent.gw*.6));
        const cd = Math.max(1, parent.gd - Math.floor(random(i, 28+level)*parent.gd*.6));
        const cx = parent.gx + Math.floor(random(i, 32+level)*(parent.gw-cw+1));
        const cz = parent.gz + Math.floor(random(i, 36+level)*(parent.gd-cd+1));
        const layers = 2 + Math.floor(random(i, 40+level)*(6+12*l));
        const cap = layout.floorY + maxFloors*STOREY;
        if (parent.y1 >= cap) break;
        parent = add(cx,cz,cw,cd,parent.y1,Math.min(cap,parent.y1+layers*STOREY),5,section.id,parent.id,l);
      }
    }
  }

  const candidates = [];
  for (let i=0; i<volumes.length; i++) for (let j=i+1; j<volumes.length; j++) {
    const a=volumes[i], b=volumes[j];
    if (a.support===b.id || b.support===a.id) continue;
    const bottom=Math.max(a.y0,b.y0);
    const floors=Math.floor((Math.min(a.y1,b.y1)-bottom)/STOREY);
    if (floors<1) continue;
    let x,z,w,d;
    const lowX = a.gx < b.gx ? a : b, highX = lowX === a ? b : a;
    const lowZ = a.gz < b.gz ? a : b, highZ = lowZ === a ? b : a;
    const gapX = highX.gx - lowX.gx - lowX.gw, gapZ = highZ.gz - lowZ.gz - lowZ.gd;
    const overlapX = Math.min(a.gx+a.gw,b.gx+b.gw) - Math.max(a.gx,b.gx);
    const overlapZ = Math.min(a.gz+a.gd,b.gz+b.gd) - Math.max(a.gz,b.gz);
    if (gapX > 0 && gapX <= 4 && overlapZ > 0) {
      x=lowX.gx+lowX.gw; z=Math.max(a.gz,b.gz)+Math.floor((overlapZ-1)/2); w=gapX; d=1;
    } else if (gapZ > 0 && gapZ <= 4 && overlapX > 0) {
      x=Math.max(a.gx,b.gx)+Math.floor((overlapX-1)/2); z=lowZ.gz+lowZ.gd; w=1; d=gapZ;
    } else continue;
    let clear = true;
    for (let dz=0; dz<d && clear; dz++) for (let dx=0; dx<w; dx++) {
      const index = (z+dz)*size+x+dx;
      if (occupied[index] || !buildable[index]) {clear=false; break;}
    }
    if (!clear || bottom===layout.floorY&&floors<2) continue;
    const pair=i*131071+j;
    const level=clamp(Math.floor(floors*(.24+.55*random(pair,50))),bottom===layout.floorY?1:0,floors-1);
    const height=bottom+level*STOREY;
    candidates.push({a,b,x,z,w,d,height,score:w+d-.75*random(pair,53)-.4*(height-layout.floorY)/layout.floorHeight});
  }
  const degree = new Uint8Array(volumes.length);
  const links = [];
  const overlaps = (p,q) => p.x0<q.x1&&p.x1>q.x0&&p.y0<q.y1&&p.y1>q.y0&&p.z0<q.z1&&p.z1>q.z0;
  candidates.sort((a,b)=>a.score-b.score||a.a.id-b.a.id||a.b.id-b.b.id);
  for (const {a,b,x,z,w,d,height} of candidates) {
    if (degree[a.id]>=2 || degree[b.id]>=2) continue;
    const span = {x0:left+x*step,x1:left+(x+w)*step,z0:top+z*step,z1:top+(z+d)*step,y0:height,y1:height+3};
    if (links.some(link=>overlaps(link,span))) continue;
    const link = add(x,z,w,d,height,height+3,BRIDGE,a.section,a.id,(a.luxury+b.luxury)/2);
    link.ends = [a.id,b.id];
    links.push(link);
    degree[a.id]++;
    degree[b.id]++;
  }
  return {volumes, links};
}

export function createDistrictPlan(layout, resolution = 128) {
  if (!Number.isInteger(resolution) || resolution<16 || resolution>192) throw new RangeError('Invalid district resolution');
  const size = resolution, cells = size*size, step = layout.width/size;
  const left=layout.centerX-layout.halfWidth, top=layout.centerZ-layout.halfWidth;
  const zones=new Uint8Array(cells), luxury=new Float32Array(cells), noise=new Float32Array(cells), ids=new Int8Array(cells).fill(-1);
  sampleFloorRect(layout,left+step/2,top+step/2,size,size,zones,luxury,step,noise);
  for (let i=0; i<cells; i++) if (zones[i]===CORE_ZONE.DISTRICT) {
    ids[i]=districtIdAt(layout,left+(i%size+.5)*step,top+(Math.floor(i/size)+.5)*step);
  }
  const buildable=new Uint8Array(cells);
  const reserved=[[layout.centerX,layout.centerZ,layout.centerRadiusSq],
    ...layout.miniShaftCenters.map(([x,z])=>[x,z,layout.miniShaftRadiusSq])];
  for(let i=0;i<cells;i++){
    if(ids[i]<0)continue;
    const x=left+(i%size)*step,z=top+Math.floor(i/size)*step;
    buildable[i]=[[0,0],[1,0],[0,1],[1,1]].every(([dx,dz])=>
      districtIdAt(layout,x+dx*step,z+dz*step)===ids[i]) &&
      reserved.every(([cx,cz,r2])=>
        (clamp(cx,x,x+step)-cx)**2 + (clamp(cz,z,z+step)-cz)**2>r2) ? 1 : 0;
  }
  const grid={size,step,left,top,zones,luxury,noise,ids,buildable};
  const partitioned=partition(layout,grid);
  const {volumes,links}=populate(layout,grid,partitioned);
  const columns=Array.from({length:cells},()=>[]);
  for (const v of volumes) for (let z=v.gz; z<v.gz+v.gd; z++) for (let x=v.gx; x<v.gx+v.gw; x++) columns[z*size+x].push(v);
  for (const column of columns) column.sort((a,b)=>a.y0-b.y0);
  return {...grid,...partitioned,volumes,links,columns,layout};
}

export function districtColumn(plan,x,z) {
  const gx=Math.floor((x-plan.left)/plan.step), gz=Math.floor((z-plan.top)/plan.step);
  if (gx<0||gx>=plan.size||gz<0||gz>=plan.size) return null;
  const index=gz*plan.size+gx;
  return {zone:plan.zones[index], section:plan.labels[index], luxury:plan.luxury[index], noise:plan.noise[index], volumes:plan.columns[index]};
}

export function volumeLuxury(plan,volume,y) {
  const level=Math.floor(Math.max(0,y-volume.y0)/STOREY);
  const centerY=volume.y0+(level+.5)*STOREY;
  const relative=clamp((centerY-plan.layout.floorY)/plan.layout.floorHeight,0,1);
  const typeBias=[.01,-.055,.09,.065,-.07,-.025,0][volume.type];
  // Middle and upper levels gain access premium, while the last upper additions
  // can be cheaper. The same block of storeys retains its section's base value.
  return clamp(volume.luxury+typeBias+.15*Math.sin(Math.PI*relative)-.17*relative**3,0,plan.layout.districtLuxuryMax);
}

export function districtSample(plan,x,y,z) {
  const column=districtColumn(plan,x,z);
  const volume=column?.volumes.find(v=>v.y0<=y&&y<v.y1)??null;
  return {column,volume,luxury:volume?volumeLuxury(plan,volume,y):null};
}
