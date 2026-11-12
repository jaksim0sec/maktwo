import test from 'node:test';
import assert from 'node:assert/strict';
import {CORE_ZONE, createFloorLayout, sampleFloorRect} from '../src/worldgen/eternal-night-core-floor.js';
import {createDistrictPlan, districtSample, volumeLuxury} from '../src/worldgen/eternal-night-districts.js';

test('district slices resolve seeded stacks and bridges without overlapping reservations', () => {
  const layout = createFloorLayout({width:512, floorHeight:360, seed:9999});
  const plan = createDistrictPlan(layout);
  const again = createDistrictPlan(layout);
  assert.deepEqual(plan.labels, again.labels);
  assert.deepEqual(plan.volumes, again.volumes);
  assert.ok(plan.sections.length>4 && plan.links.length>0);
  assert.ok(plan.links.some(bridge=>bridge.ends.some(id=>plan.volumes[id].support!==null)));
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
