import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAnchor,followAnchor,cardGeometry,spatialHit,PANEL_DISTANCE,PANEL_SCALE} from '../src/client/hologram.js';
import {World} from '../src/core/world.js';
import {Player} from '../src/entities/entities.js';
import {BLOCK as B} from '../src/core/blocks.js';
import {collides} from '../src/core/physics.js';
import {buildLightVolume,makeOccluderSnapshot} from '../src/core/lightVolume.js';
import {makeTextureLayers} from '../src/client/textures.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const unit=v=>{const n=Math.hypot(...v);return v.map(a=>a/n)};
const towards=(a,b)=>unit(b.map((n,i)=>n-a[i]));
test('inventory follows walking player and camera orientation; same visible card remains selectable',()=>{
 const player={x:0,y:22,z:0,eye:1.35,yaw:0,pitch:0,visualStepOffset:0};
 const a=createAnchor(player),cards=cardGeometry('blocks',Array.from({length:8},(_,i)=>({name:`아이템${i}`,id:i}))),card=cards.find(c=>c.id==='item:2');
 for(const pose of [{x:0,yaw:0,pitch:0},{x:8,yaw:.5,pitch:.35},{x:-11,yaw:-1,pitch:-.6}]){
  Object.assign(player,pose);followAnchor(a,player);
  const eye=[player.x,player.y+player.eye,player.z];
  const cardCenter=a.center.map((value,i)=>value+(a.right[i]*card.x+a.up[i]*card.y+a.forward[i]*card.depth)*PANEL_SCALE);
  assert.equal(spatialHit(a,cards,player,towards(eye,cardCenter))?.id,'item:2');
  assert.ok(Math.abs(Math.hypot(...a.center.map((n,i)=>n-eye[i]))-PANEL_DISTANCE)<.2);
 }
});
test('solid blocks above the head prevent standing; crouch lowers physical collision and eye height',()=>{
 const w=new World({mode:'flat'}),p=new Player(.5,24,.5);
 for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++){w.set(x,23,z,B.STONE,{simulate:false});w.set(x,25,z,B.STONE,{simulate:false})}
 const stationary={forward:false,backward:false,left:false,right:false,moveX:0,moveY:0,jump:false,crouch:true,sprint:false};
 p.update(w,1/60,stationary);
 assert.ok(p.crouching);assert.equal(p.height,p.crouchedHeight);assert.ok(!collides(w,p.x,p.y,p.z,p.width,p.height));
 for(let n=0;n<8;n++)p.update(w,1/60,{...stationary,crouch:false});
 assert.equal(p.crouching,true,'a low ceiling keeps crouch active until the player exits');
 p.x=6.5;p.z=6.5;p.y=24;
 p.update(w,1/60,{...stationary,crouch:false});
 assert.equal(p.crouching,false);assert.equal(p.height,p.standingHeight);
});
test('overlapping lamps do not amplify brightness even when their emitters differ',()=>{
 const w=17,h=9,d=17,occ=new Uint8Array(w*h*d);
 const lampA={x:4.5,y:4.5,z:8.5,radius:8,intensity:1.1,rgb:[1,.55,.20]},lampB={x:12.5,y:4.5,z:8.5,radius:8,intensity:.9,rgb:[1,.72,.37]};
 const opts={width:w,height:h,depth:d};
 const a=buildLightVolume(occ,[lampA],opts),b=buildLightVolume(occ,[lampB],opts),both=buildLightVolume(occ,[lampA,lampB],opts);
 for(let i=0;i<both.length;i+=4){for(let ch=0;ch<3;ch++)assert.ok(Math.abs(both[i+ch]-Math.max(a[i+ch],b[i+ch]))<=1);}
});
test('door occlusion depends on open state, not unconditional darkness',()=>{
 const world=new World({mode:'flat'});
 for(let x=0;x<13;x++)for(let y=22;y<33;y++)world.set(x,y,6,B.STONE,{simulate:false});
 world.set(6,26,6,B.AIR);world.set(6,27,6,B.AIR);
 assert.ok(world.placeDoor(6,26,6,0));
 const origin=[0,20,0],width=13,height=14,depth=13;
 const sourceLamp={x:6.5,y:26.5,z:5.5,radius:9,intensity:1,rgb:[1,.5,.25]};
 const get=()=>{const occ=makeOccluderSnapshot(world,origin,width,height,depth),vol=buildLightVolume(occ,[sourceLamp],{width,height,depth,origin});return vol[((7*height+6)*width+6)*4]};
 const shut=get();world.toggleDoor(6,26,6);const open=get();assert.ok(open>shut+20);
 assert.equal(makeOccluderSnapshot(world,origin,width,height,depth)[((6*height+6)*width)+6],0);
});
test('glass has seamless identical material texels at tile borders and center',()=>{
 const{data,size}=makeTextureLayers(),offset=10*size*size*4;
 const pixel=(x,y)=>[...data.slice(offset+(y*size+x)*4,offset+(y*size+x)*4+4)];
 assert.deepEqual(pixel(0,0),pixel(31,0));assert.deepEqual(pixel(31,31),pixel(16,16));
 const mesher=source('src/client/mesher.js');assert.match(mesher,/id===B\.GLASS\?1/);
});
test('HUD hides crosshair, has a visible inventory exit, and mobile has simple crouch/jump actions',()=>{
 const html=source('index.html'),css=source('style.css'),game=source('src/client/game.js');
 assert.match(css,/#crosshair\{display:none!important/);
 assert.match(html,/id="inventory-close"/);assert.match(game,/bindClick\('inventory-close'/);
 assert.match(html,/data-action="crouch" aria-label="웅크리기"/);
 assert.match(css,/body\.holo-open #inventory-close\{display:block\}/);
 assert.match(game,/this\.hologram\.followPlayer\(this\.player\)/);
});
