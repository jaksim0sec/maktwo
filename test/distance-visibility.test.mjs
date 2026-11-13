import test from 'node:test';
import assert from 'node:assert/strict';
import {BLOCK as B} from '../src/core/blocks.js';
import {distantCityMesh,distanceSectorVisible,DISTANCE_SECTORS} from '../src/client/city-distance.js';

// Use tiny deterministic stand-ins so this test does not generate the 960-block city.
const plan=()=>{
 const volumes=[],details=[];
 for(let id=0;id<64;id++){
  const angle=id/64*Math.PI*2,x=Math.sin(angle)*96,z=Math.cos(angle)*96;
  volumes.push({id,x0:x-5,x1:x+5,z0:z-5,z1:z+5,
   floors:[{band:0,y:8,top:152,program:'housing',
    outline:[[x-5,z-5],[x+5,z-5],[x+5,z+5],[x-5,z+5]]}]});
  details.push({kits:[{body:B.CONCRETE}]});
 }
 return {volumes,details,layout:{seed:9999},tower:null,library:null};
};
test('sector partition keeps all distant geometry and valid draw ranges',()=>{
 const city=plan(),old=distantCityMesh(city,0,0,{enhanced:false});
 const options={enhanced:false,partitionForView:true};
 const grouped=distantCityMesh(city,0,0,options);
 assert.equal(grouped.length,old.length);
 assert.equal(options.sectors.length,DISTANCE_SECTORS);
 assert.equal(options.landmarkVertices+options.sectors.reduce((n,s)=>n+s.count,0),grouped.length/7);
 assert.ok(options.sectors.every(s=>s.start>=0&&s.count>=0&&s.start+s.count<=grouped.length/7));
 assert.ok(grouped.every(Number.isFinite));
});
test('camera direction suppresses unseen sectors without touching nearby voxels',()=>{
 const options={enhanced:false,partitionForView:true},mesh=distantCityMesh(plan(),0,0,options);
 const count=yaw=>options.landmarkVertices+options.sectors.reduce((n,s,i)=>
  n+(distanceSectorVisible(i,yaw,16/9)?s.count:0),0);
 assert.ok(count(0)<mesh.length/7*.85);
 assert.ok(count(Math.PI)<mesh.length/7*.85);
 assert.ok(count(0)>0&&count(Math.PI)>0);
});
