import test from 'node:test';
import assert from 'node:assert/strict';
import {VERTICAL_FOV,FOV_TAN} from '../src/client/camera.js';
import {perspective,view} from '../src/client/renderer.js';
import {screenRay} from '../src/client/picking.js';
import {distanceSectorVisible,DISTANCE_SECTORS} from '../src/client/city-distance.js';

for(const [width,height] of [[1920,1080],[915,412],[390,844]]){
 test(`65° renders and picks the same viewport coordinates at ${width}×${height}`,()=>{
  assert.ok(Math.abs(VERTICAL_FOV*180/Math.PI-65)<1e-9);
  assert.ok(FOV_TAN<Math.tan(75*Math.PI/360));
  const camera={yaw:.64,pitch:.52};
  const p=perspective(VERTICAL_FOV,width/height,.05,260);
  const m=view(camera.yaw,camera.pitch,0,0,0);
  for(const [u,v] of [[.5,.5],[.01,.01],[.98,.09],[.05,.93],[.94,.95]]){
   const {x,y,z}=screenRay(camera,u*width,v*height,width,height);
   const depth=-(m[2]*x+m[6]*y+m[10]*z);
   const projectedX=p[0]*(m[0]*x+m[4]*y+m[8]*z)/depth;
   const projectedY=p[5]*(m[1]*x+m[5]*y+m[9]*z)/depth;
   assert.ok(Math.abs(projectedX-(2*u-1))<1e-6);
   assert.ok(Math.abs(projectedY-(1-2*v))<1e-6);
   const angle=(Math.atan2(z,x)+2*Math.PI)%(2*Math.PI);
   const sector=Math.floor(angle*DISTANCE_SECTORS/(2*Math.PI));
   assert.ok(distanceSectorVisible(sector,camera.yaw,width/height,camera.pitch));
  }
 });
}
