import test from 'node:test';
import assert from 'node:assert/strict';
import {CORE_ZONE, createFloorLayout, sampleFloorRect, zoneAt} from '../src/worldgen/eternal-night-core-floor.js';
import {createDistrictPlan, districtSample, volumeLuxury} from '../src/worldgen/eternal-night-districts.js';

test('district slices resolve seeded stacks and bridges without overlapping reservations', () => {
  const layout = createFloorLayout({width:512, floorHeight:360, seed:9999});
  const plan = createDistrictPlan(layout);
  const again = createDistrictPlan(layout);
  assert.deepEqual(plan.labels, again.labels);
  assert.deepEqual(plan.volumes, again.volumes);
  assert.ok(plan.sections.length>4 && plan.links.length>0);
  assert.ok(plan.walkways.some(link=>link.kind==='roof'&&plan.volumes[link.ports[0].building].support!==null));
  for (let i=0; i<plan.columns.length; i++) {
    const column = plan.columns[i];
    if (column.length) assert.equal(plan.buildable[i], 1);
    for (let j=1; j<column.length; j++) assert.ok(column[j-1].y1<=column[j].y0);
  }
  for (const v of plan.volumes) {
    assert.ok(v.y0>=layout.floorY && v.y1<=layout.floorTop);
    if (v.type!==6 && v.support!==null) {
      const parent = plan.volumes[v.support];
      assert.equal(v.y0,parent.y1);
      assert.ok(v.x0>=parent.x0 && v.x1<=parent.x1 && v.z0>=parent.z0 && v.z1<=parent.z1);
    }
  }
  const tower = plan.volumes.find(v=>v.y1-v.y0>=30 && v.luxury<.65);
  assert.ok(tower);
  const x = (tower.x0+tower.x1)/2, z = (tower.z0+tower.z1)/2;
  const low = districtSample(plan,x,tower.y0,z);
  const high = districtSample(plan,x,tower.y0+24,z);
  assert.equal(low.volume.id,tower.id);
  assert.equal(high.luxury,volumeLuxury(plan,tower,tower.y0+24));
  assert.notEqual(low.luxury,high.luxury);
  assert.equal(districtSample(plan,x,layout.floorTop,z).luxury,null);
});

test('raw noise remains available to sections when the luxury noise amplitude is zero', () => {
  const layout = createFloorLayout({seed:42, luxuryNoiseAmplitude:0});
  const size=16, count=size*size, step=layout.width/size;
  const zones=new Uint8Array(count), luxury=new Float32Array(count), noise=new Float32Array(count);
  const start=-layout.halfWidth+step/2;
  sampleFloorRect(layout,start,start,size,size,zones,luxury,step,noise);
  assert.ok(noise.some((v,i)=>v>0&&zones[i]===CORE_ZONE.DISTRICT));
  assert.ok(noise.every(Number.isFinite));
  const base=new Float32Array(count);
  sampleFloorRect(layout,start,start,size,size,zones,base,step);
  assert.deepEqual(luxury,base);
});

test('density controls occupied plots without moving the city sections', () => {
  const layout = createFloorLayout({width:512, floorHeight:360, seed:9999});
  const roots = plan => plan.volumes.filter(v=>v.type!==6 && v.support===null).length;
  const empty = createDistrictPlan(layout, 96, {buildingDensity:0});
  const sparse = createDistrictPlan(layout, 96, {buildingDensity:.2});
  const dense = createDistrictPlan(layout, 96, {buildingDensity:.95});
  assert.equal(roots(empty),0);
  assert.ok(roots(sparse)>0 && roots(dense)>roots(sparse));
  assert.deepEqual(sparse.labels,dense.labels);
});

test('floor plans use the supplied construction unit and reserve stair and atrium voids', () => {
  const layout = createFloorLayout({width:512, floorHeight:360, seed:9999, centerX:32, centerZ:-40, floorY:12});
  const unit = .8;
  const plan = createDistrictPlan(layout, 96, {unit});
  const buildings = plan.volumes.filter(v=>v.floors);
  const mall = buildings.find(v=>v.floors.some(f=>f.holes.some(h=>h.kind==='atrium')));
  assert.ok(mall);
  assert.ok(buildings.some(v=>v.floors.some(f=>f.rooms.filter(r=>r.kind==='shop').length>=3)));
  for (const v of buildings) for (const flight of v.stairs) {
    assert.ok(flight.treads.length>=16);
    assert.ok(flight.treads.every(t=>Math.abs(t.rise-.25*unit)<1e-8 && Math.abs(t.run-.35*unit)<1e-8));
    const [first,second] = flight.flights;
    assert.equal(first.toY,second.fromY);
    assert.equal(second.toY,flight.toY);
  }
  assert.ok(buildings.some(v=>v.floors[0].outline.length>4));
  const upper = mall.floors.find(f=>f.holes.some(h=>h.kind==='atrium'));
  const hole = upper.holes.find(h=>h.kind==='atrium');
  assert.equal(districtSample(plan,(hole.x0+hole.x1)/2,upper.y+unit,(hole.z0+hole.z1)/2).volume,null);
});

test('central tower routes reach opened building doors and never deck across a light well', () => {
  const layout = createFloorLayout({width:512, floorHeight:360, seed:9999});
  const plan = createDistrictPlan(layout);
  const trunk = plan.walkways?.filter(link=>link.kind==='core') ?? [];
  assert.equal(trunk.length,4);
  const tower=plan.walkways.find(link=>link.kind==='tower');
  assert.equal(tower.ports.length,trunk.length);
  for (const link of trunk) {
    const port=link.ports[0];
    assert.equal(port.open,true);
    assert.deepEqual(link.points[0],[port.x,port.y,port.z]);
    const [x,y,z]=link.points.at(-1);
    assert.ok(tower.points.some(p=>Math.hypot(p[0]-x,p[1]-y,p[2]-z)<1e-8));
    assert.ok(Math.abs(Math.hypot(x-layout.centerX,z-layout.centerZ)-layout.mainShaftRadius)<1e-8);
    for (const segment of link.segments) {
      assert.ok([0,1,2,3,4,5,6,7].includes(segment.heading));
      const [a,b]=[segment.from,segment.to];
      const dx=Math.abs(a[0]-b[0]), dz=Math.abs(a[2]-b[2]);
      assert.ok(Math.min(dx,dz)<1e-8 || Math.abs(dx-dz)<1e-8);
      for (let i=1;i<20;i++) {
        const t=i/20;
        assert.notEqual(zoneAt(layout,a[0]+(b[0]-a[0])*t,a[2]+(b[2]-a[2])*t),CORE_ZONE.SKY_GARDEN);
      }
    }
  }
  assert.ok(plan.walkways.some(link=>link.kind==='bridge' && link.segments.some(s=>s.kind==='ramp' || s.kind==='stairs')));
  for(const link of plan.walkways)for(const part of link.segments) {
    if(part.kind==='ramp')assert.ok(Math.abs(part.from[1]-part.to[1])/part.length<=.25+1e-8);
    if(part.kind==='stairs')assert.ok(Math.abs(Math.abs(part.from[1]-part.to[1])-part.steps*part.rise)<1e-8);
  }
});
