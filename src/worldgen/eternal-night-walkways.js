import {CORE_ZONE, zoneAt} from './eternal-night-core-floor.js';
import {containsRect, cutPolygon, stairModule} from './eternal-night-buildings.js';

const EPS=1e-7;
const DIR=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const portPoint=p=>[p.x,p.y,p.z];
const stub=(p,length)=>[p.x+p.dx*length,p.y,p.z+p.dz*length];
const dedup=points=>points.filter((p,i)=>!i||distance(p,points[i-1])>EPS);
const spanBox=(a,b)=>({x0:Math.min(a[0],b[0]),x1:Math.max(a[0],b[0]),z0:Math.min(a[2],b[2]),z1:Math.max(a[2],b[2])});

function octilinear(a,b) {
  const dx=b[0]-a[0], dz=b[2]-a[2], diagonal=Math.min(Math.abs(dx),Math.abs(dz));
  const x=Math.sign(dx)*diagonal, z=Math.sign(dz)*diagonal;
  return [[a,[a[0]+x,a[1],a[2]+z],b],[a,[b[0]-x,a[1],b[2]-z],b]].map(dedup);
}

function distanceToSegment(a,b,x,z) {
  const dx=b[0]-a[0],dz=b[2]-a[2];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(x-a[0]-t*dx,z-a[2]-t*dz);
}

function intersectsBox(a,b,box,pad) {
  let lo=0,hi=1;
  for (const [k,min,max] of [[0,box.x0-pad,box.x1+pad],[2,box.z0-pad,box.z1+pad]]) {
    const d=b[k]-a[k];
    if (Math.abs(d)<EPS) {
      if (a[k]<=min || a[k]>=max) return false;
      continue;
    }
    const t0=(min-a[k])/d,t1=(max-a[k])/d;
    lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));
    if (lo>=hi) return false;
  }
  return true;
}

function section(a,b,width) {
  const length=distance(a,b), dx=(b[0]-a[0])/length, dz=(b[2]-a[2])/length;
  const x=-dz*width/2,z=dx*width/2;
  return [[a[0]+x,a[2]+z],[a[0]-x,a[2]-z],[b[0]-x,b[2]-z],[b[0]+x,b[2]+z]];
}

function openPort(port,buildings) {
  if (port.building===null || port.open) return;
  port.open=true;
  buildings[port.building].floors[port.level].doors.push(port);
}

function makeWalkway(kind,ports,points,width,unit) {
  const segments=[];
  const stairs=stairModule(unit);
  for(let i=1;i<points.length;i++) {
    const from=points[i-1],to=points[i],length=distance(from,to);
    const rise=to[1]-from[1];
    const heading=(Math.round(Math.atan2(to[2]-from[2],to[0]-from[0])*4/Math.PI)+8)%8;
    const type=Math.abs(rise)<EPS?'deck':Math.abs(rise)/length<=.25+EPS?'ramp':'stairs';
    const shape={from,to,length,heading,kind:type,outline:section(from,to,width)};
    if(type==='stairs') {
      const steps=Math.round(Math.abs(rise)/stairs.rise);
      const lead=(length-steps*stairs.run)/2;
      if (lead < stairs.landing-EPS) return null;
      shape.rise=stairs.rise;
      shape.run=stairs.run;
      shape.steps=steps;
      shape.lead=lead;
    }
    segments.push(shape);
  }
  const joints=distance(points[0],points.at(-1))<EPS?points.slice(0,-1):points.slice(1,-1);
  const landings=joints.map(([x,y,z])=>({y,outline:DIR.map(([dx,dz])=>{
    const scale=width/(2*Math.hypot(dx,dz));
    return [x+dx*scale,z+dz*scale];
  })}));
  return {kind,ports,points,width,segments,landings};
}

export function segmentY(segment,x,z) {
  const {from,to,length,steps,lead,run,rise}=segment;
  const along=Math.max(0,Math.min(length,((x-from[0])*(to[0]-from[0])+(z-from[2])*(to[2]-from[2]))/length));
  if(!steps)return from[1]+(to[1]-from[1])*along/length;
  const count=Math.max(0,Math.min(steps,Math.floor((along-lead)/run)+1));
  return from[1]+Math.sign(to[1]-from[1])*count*rise;
}

export function designWalkways(layout,grid,buildings,occupied,unit,highRise=false) {
  const roots=buildings.filter(b=>b.support===null);
  const {left,top,step,size}=grid;
  const bridges=[],walkways=[];
  if(!roots.length)return {walkways,links:bridges};
  const width=unit*(highRise?2.35:1.4), margin=width/2;
  const holes=[...layout.gardenCenters.map(([x,z])=>[x,z,layout.gardenRadius]),
    ...layout.miniShaftCenters.map(([x,z])=>[x,z,layout.miniShaftRadius])];
  const clearHoles=(a,b,pad=margin)=>holes.every(([x,z,r])=>distanceToSegment(a,b,x,z)>=r+pad);
  const clearCore=(a,b,pad=margin)=>distanceToSegment(a,b,layout.centerX,layout.centerZ)>=layout.mainShaftRadius+pad-EPS;
  const insideCoreFloor=(a,pad=margin)=>{
    const x=Math.abs(a[0]-layout.centerX),z=Math.abs(a[2]-layout.centerZ);
    return Math.max(x,z)+pad<=layout.halfWidth && x+z+pad*Math.SQRT2<=layout.diagonalLimit;
  };
  const bucketSize=Math.max(4*step,4*unit), structureBuckets=new Map(), deckBuckets=new Map();
  function* keys(box,pad=0) {
    for(let z=Math.floor((box.z0-pad)/bucketSize);z<=Math.floor((box.z1+pad)/bucketSize);z++) {
      for(let x=Math.floor((box.x0-pad)/bucketSize);x<=Math.floor((box.x1+pad)/bucketSize);x++)yield `${x},${z}`;
    }
  }
  const insert=(buckets,box)=>{
    for(const key of keys(box)) {
      if(!buckets.has(key))buckets.set(key,[]);
      buckets.get(key).push(box);
    }
  };
  for(const volume of buildings)insert(structureBuckets,volume);
  const clearDeck=(a,b,except)=>{
    if(!clearHoles(a,b)||!clearCore(a,b)||!insideCoreFloor(a)||!insideCoreFloor(b))return false;
    for(const key of keys(spanBox(a,b),margin))for(const root of structureBuckets.get(key)??[]) {
      if(root.id!==except&&Math.min(a[1],b[1])<root.y1+unit&&Math.max(a[1],b[1])+unit*2.5>root.y0&&intersectsBox(a,b,root,margin))return false;
    }
    return true;
  };
  const clearExisting=(a,b)=>{
    for(const key of keys(spanBox(a,b),width))for(const box of deckBuckets.get(key)??[]) {
      if(Math.max(a[1],b[1])+unit*2.5>=box.low && Math.min(a[1],b[1])<=box.high+unit*2.5 && intersectsBox(a,b,box,width))return false;
    }
    return true;
  };
  const add=link=>{
    for(const p of link.ports)openPort(p,buildings);
    link.id=walkways.length;
    if(highRise) {
      const a=link.ports[0],b=link.ports[1];
      const mix=Math.imul(a?.building??0,31)^Math.imul(b?.building??0,131)^Math.round(a?.y??0)^layout.noiseSeed;
      link.architecture=link.kind==='core'?'arcade':link.kind==='tower'?'open':['enclosed','arcade','open','hung'][mix&3];
    }
    walkways.push(link);
    for(const {from,to} of link.segments)insert(deckBuckets,{...spanBox(from,to),low:Math.min(from[1],to[1]),high:Math.max(from[1],to[1])});
    if(link.kind==='bridge')bridges.push(link);
  };

  const index=(x,z)=>z*size+x;
  const cellPoint=(i,y=0)=>[left+(i%size+.5)*step,y,top+(Math.floor(i/size)+.5)*step];
  const cell=(p)=>[Math.floor((p[0]-left)/step),Math.floor((p[2]-top)/step)];
  const available=new Uint8Array(occupied.length);
  for(let i=0;i<available.length;i++) {
    if(occupied[i])continue;
    const a=cellPoint(i);
    const zone=zoneAt(layout,a[0],a[2]);
    if(zone!==CORE_ZONE.OUTSIDE && insideCoreFloor(a) && clearHoles(a,a) && clearCore(a,a))available[i]=1;
  }
  const candidates=(p,r)=>{
    const [x,z]=cell(p), found=[];
    for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++) {
      if(x+dx<0||x+dx>=size||z+dz<0||z+dz>=size)continue;
      const i=index(x+dx,z+dz);
      if(available[i])found.push(i);
    }
    return found;
  };
  const publicPorts=roots.flatMap(b=>b.ports.filter(p=>p.level===b.entryLevel));
  const used=new Set();
  const towerY=layout.floorY+4*unit;
  const towerPorts=[];
  for(let district=0;district<4;district++) {
    const sx=district===0||district===3?1:-1, sz=district<2?1:-1;
    const radial=radius=>[layout.centerX+sx*radius/Math.SQRT2,0,layout.centerZ+sz*radius/Math.SQRT2];
    const dock=radial(layout.mainShaftRadius), exit=radial(layout.mainShaftRadius+margin);
    const sameQuadrant=p=>(p[0]-layout.centerX)*sx>=margin&&(p[2]-layout.centerZ)*sz>=margin;
    const next=new Int32Array(available.length).fill(-2), hops=new Uint16Array(available.length);
    const seeds=new Map(),queue=[];
    for(const i of candidates(exit,2).sort((a,b)=>distance(exit,cellPoint(a))-distance(exit,cellPoint(b)))) {
      const p=cellPoint(i);
      if(!sameQuadrant(p))continue;
      const route=octilinear(p,exit).find(points=>points.every((a,n)=>sameQuadrant(a)&&(!n||clearDeck(points[n-1],a))));
      if(!route)continue;
      next[i]=-1;seeds.set(i,route);queue.push(i);
    }
    for(let n=0;n<queue.length;n++) {
      const i=queue[n],gx=i%size,gz=Math.floor(i/size),a=cellPoint(i);
      for(const [dx,dz] of DIR) {
        const x=gx+dx,z=gz+dz;
        if(x<0||x>=size||z<0||z>=size)continue;
        const j=index(x,z);
        if(next[j]!==-2||!available[j]||(dx&&dz&&(!available[index(x,gz)]||!available[index(gx,z)])))continue;
        const b=cellPoint(j);
        if(!sameQuadrant(b)||!clearHoles(a,b)||!clearCore(a,b))continue;
        next[j]=i;hops[j]=hops[i]+1;queue.push(j);
      }
    }
    const options=[];
    for(const p of publicPorts) {
      if(grid.sections[buildings[p.building].section].district!==district)continue;
      const start=portPoint(p), doorStep=stub(p,unit*1.5);
      if(!clearDeck(start,doorStep,p.building))continue;
      for(const i of candidates(doorStep,1)) {
        if(next[i]===-2)continue;
        const score=hops[i]*step+distance(doorStep,cellPoint(i))-(buildings[p.building].type===2 ? 3*unit : 0);
        const lead=octilinear(doorStep,cellPoint(i,p.y)).find(points=>points.every((b,k)=>!k||clearDeck(points[k-1],b)));
        if(lead)options.push({p,i,lead,score});
      }
    }
    for(const chosen of options.sort((a,b)=>a.score-b.score)) {
      const {p,lead}=chosen;
      const points=[portPoint(p),...lead];
      let i=chosen.i;
      while(next[i]>=0){i=next[i];points.push(cellPoint(i,p.y));}
      points.push(...seeds.get(i).slice(1).map(([x,,z])=>[x,p.y,z]),[dock[0],p.y,dock[2]]);
      const simplified=dedup(points).filter((b,i,all)=>{
        if(i===0||i>=all.length-2)return true;
        const a=all[i-1],c=all[i+1],dx=b[0]-a[0],dz=b[2]-a[2];
        return Math.abs(dx*(c[2]-b[2])-dz*(c[0]-b[0]))>EPS || dx*(c[0]-b[0])+dz*(c[2]-b[2])<=0;
      });
      const tower={x:dock[0],y:towerY,z:dock[2],building:null,open:true};
      const rise=Math.abs(p.y-towerY);
      let transition=-1;
      if(rise>EPS) {
        const stair=stairModule(unit);
        for(let j=1;j<simplified.length-2;j++) {
          const length=distance(simplified[j],simplified[j+1]);
          if(length>=rise*4 || length>=rise/stair.rise*stair.run+2*stair.landing){transition=j;break;}
        }
        if(transition<0)continue;
      }
      const graded=simplified.map(([x,y,z],j)=>[x,j>transition?towerY:y,z]);
      if(!graded.slice(1,-1).every((b,i)=>clearDeck(graded[i],b,i===0?p.building:undefined)))continue;
      const main=makeWalkway('core',[p,tower],graded,width,unit);
      if(main){add(main);used.add(p);towerPorts.push(tower);break;}
    }
  }

  if(towerPorts.length) {
    const r=layout.mainShaftRadius/Math.SQRT2;
    const corners=[[1,1],[-1,1],[-1,-1],[1,-1],[1,1]].map(([x,z])=>[layout.centerX+x*r,towerY,layout.centerZ+z*r]);
    add(makeWalkway('tower',towerPorts,corners,Math.min(width,r),unit));
  }

  // Only inspect ports in nearby buckets. Route an initial flat landing out of both doors.
  const limit=Math.max(step*(highRise?4.2:3),unit*12), buckets=new Map();
  const bucket=(x,z)=>`${Math.floor(x/limit)},${Math.floor(z/limit)}`;
  const bridgePorts=highRise?roots.flatMap(b=>b.ports.filter(p=>p.level>0&&p.y+4<layout.floorTop)):publicPorts;
  for(const p of bridgePorts) {
    const key=bucket(p.x,p.z);
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(p);
  }
  const pairs=[];
  for(const a of bridgePorts)for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++) {
    for(const b of buckets.get(bucket(a.x+dx*limit,a.z+dz*limit))??[]) {
      if(a.building>=b.building)continue;
      if(highRise&&Math.abs(a.y-b.y)>unit*6)continue;
      const length=distance(portPoint(a),portPoint(b));
      if(length>limit || length<3*unit)continue;
      const x=b.x-a.x,z=b.z-a.z;
      if(x*a.dx+z*a.dz<=0 || x*b.dx+z*b.dz>=0)continue;
      pairs.push([length+(highRise?Math.abs(a.y-b.y)*.7:0),a,b]);
    }
  }
  const connected=new Set(),degrees=new Map();
  for(const [,a,b] of pairs.sort((p,q)=>p[0]-q[0])) {
    const key=p=>`${p.building}:${highRise?p.level:0}`;
    const aKey=key(a),bKey=key(b),pair=`${aKey}/${bKey}`;
    if(used.has(a)||used.has(b)||connected.has(pair)||(degrees.get(aKey)||0)>=2||(degrees.get(bKey)||0)>=2)continue;
    const start=portPoint(a),end=portPoint(b),s=stub(a,Math.max(unit*1.1,margin+.1)),t=stub(b,Math.max(unit*1.1,margin+.1));
    if(!clearDeck(start,s,a.building)||!clearDeck(t,end,b.building))continue;
    for(const path of octilinear(s,t)) {
      if(path.length<2)continue;
      // Put the level change in the longest span. Bends stay level with a landing.
      let ramp=1;
      for(let i=2;i<path.length;i++)if(distance(path[i-1],path[i])>distance(path[ramp-1],path[ramp]))ramp=i;
      const points=[start,...path.map(([x,,z],i)=>[x,i<ramp?a.y:b.y,z]),end];
      if(points.slice(1).some((p,i)=>!clearExisting(points[i],p) ||
        (i>0&&i<points.length-2&&!clearDeck(points[i],p))))continue;
      const link=makeWalkway('bridge',[a,b],points,width,unit);
      if(!link)continue;
      add(link);connected.add(pair);used.add(a);used.add(b);
      degrees.set(aKey,(degrees.get(aKey)||0)+1);degrees.set(bKey,(degrees.get(bKey)||0)+1);
      break;
    }
  }

  return {walkways,links:bridges};
}

export function designRoofWalkway(b,parent,unit) {
  const {roof,roofAccess}=parent, width=unit*1.4, margin=width/2;
  const atop=(x,z)=>{
    const cut=cutPolygon(roof.outline,'x',z);
    return cut && x>=cut[0] && x<=cut[1] && !roof.holes.some(h=>containsRect(h,x,z));
  };
  if(![b.x0,b.x1].every(x=>[b.z0,b.z1].every(z=>atop(x,z))) ||
    roof.holes.some(h=>h.x0<b.x1 && h.x1>b.x0 && h.z0<b.z1 && h.z1>b.z0))return null;
  const supported=([x,,z])=>[-margin,margin].every(dx=>[-margin,margin].every(dz=>atop(x+dx,z+dz)));
  for(const port of b.ports) {
    const p=portPoint(port),s=stub(port,unit);
    if(!supported(p)||!supported(s))continue;
    const route=octilinear(s,roofAccess).find(points=>points.every((q,i)=>supported(q)&&(!i ||
      (!intersectsBox(points[i-1],q,b,margin)&&roof.holes.every(h=>!intersectsBox(points[i-1],q,h,margin))))));
    if(!route)continue;
    port.open=true;
    b.floors[port.level].doors.push(port);
    return makeWalkway('roof',[port],dedup([p,...route]),width,unit);
  }
  return null;
}
