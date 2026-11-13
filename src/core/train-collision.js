import {TRAIN,trainCab,trainDoorMotion} from '../worldgen/station-train.js';
import {BLOCK as B} from './blocks.js';
import {SIZE} from './chunk.js';

const overlap=(a,b,c,d)=>a<d-1e-5&&b>c+1e-5;
const crossMin=TRAIN.center-TRAIN.halfWidth,crossMax=TRAIN.center+TRAIN.halfWidth;

export function localTrainPoint(e,x,y,z){
 return e.train.axis==='x'?[x-e.x,y-e.y,z-e.z]:[z-e.z,y-e.y,x-e.x];
}

// Proxies are aligned to the same shell dimensions as the render mesh.
export function* trainShell(e){
 const {start,end,doors}=e.train;
 yield [start,0,crossMin,end+1,TRAIN.deck,crossMax];
 yield [start,TRAIN.ceiling,crossMin,end+1,TRAIN.roof,crossMax];
 yield [start,TRAIN.deck,crossMin,start+.17,TRAIN.ceiling,crossMax];
 yield [end+.83,TRAIN.deck,crossMin,end+1,TRAIN.ceiling,crossMax];
 // Console fronts constrain movement in both driving cabs.
 for(const side of [-1,1]){
  const {end}=trainCab(e.train,side);
  const front=end-side*.58,back=end-side*1.48;
  const left=Math.min(front,back),right=Math.max(front,back);
  yield [left,TRAIN.deck,crossMin+.32,right,2.12,crossMax-.32];
  yield [Math.min(front,front-side*.38),2.12,crossMin+.32,Math.max(front,front-side*.38),2.46,crossMax-.32];
 }
 for(const [index,side] of [-1,1].entries()){
  const c=side<0?crossMin:crossMax-TRAIN.sideWall;
  let cursor=start;
  for(const [i,left] of doors.entries()){
   yield [cursor,TRAIN.deck,c,left,TRAIN.ceiling,c+TRAIN.sideWall];
   const right=left+TRAIN.doorWidth;
   yield [left,TRAIN.doorHeight+TRAIN.deck,c,right,TRAIN.ceiling,c+TRAIN.sideWall];
   const {slide:travel,recess}=trainDoorMotion(e.doorOpen[index*4+i]);
   const pocket=c-side*recess;
   const mid=(left+right)/2;
   if(left<mid-travel)yield [left,TRAIN.deck,pocket,mid-travel,TRAIN.deck+TRAIN.doorHeight,pocket+TRAIN.sideWall];
   if(mid+travel<right)yield [mid+travel,TRAIN.deck,pocket,right,TRAIN.deck+TRAIN.doorHeight,pocket+TRAIN.sideWall];
   cursor=right;
  }
  yield [cursor,TRAIN.deck,c,end+1,TRAIN.ceiling,c+TRAIN.sideWall];
 }
}

export function trainCollision(trains,x,y,z,width=.6,height=1.8){
 const radius=width*.5;
 for(const e of trains||[]){
  const [a,b,c]=localTrainPoint(e,x,y,z);
  if(a+radius<=e.train.start||a-radius>=e.train.end+1||c+radius<=crossMin||
     c-radius>=crossMax||b+height<=0||b>=TRAIN.roof)continue;
  for(const [a0,b0,c0,a1,b1,c1] of e.shell)
   if(overlap(a-radius,a+radius,a0,a1)&&overlap(b,b+height,b0,b1)&&overlap(c-radius,c+radius,c0,c1))return true;
 }
 return false;
}

export function carryTrainPassenger(e,player,step){
 if(!step||player.fly)return false;
 const [along,height,cross]=localTrainPoint(e,player.x,player.y,player.z);
 const supported=height>=TRAIN.deck-.07&&height<TRAIN.ceiling||
  player.grounded&&Math.abs(height-TRAIN.roof)<.07;
 if(!supported||along<=e.train.start||along>=e.train.end+1||cross<=crossMin||cross>=crossMax)return false;
 if(e.train.axis==='x')player.x+=step;else player.z+=step;
 return true;
}

const isTrack=id=>id===B.STATION_TRACK_BALLAST||
 id>=B.STATION_TRACK_SLEEPER&&id<=B.STATION_TRACK_GREASE||
 id>=B.PART_STATION_TRACK_1&&id<=B.PART_STATION_TRACK_5;

// The low edge tiles sit beside the rail pit, under the overhanging car sill.
const platformEdge=(id,c,axis,state)=>id===B.PART_STATION_PLATFORM_1&&
 state?.facing===(axis==='x'?(c>0?0:4):(c>0?6:2));
export function trainObstructed(world,e,next){
 const {train,offset,homeX,homeZ,y}=e;
 const xAxis=train.axis==='x',origin=xAxis?homeX:homeZ,crossOrigin=xAxis?homeZ:homeX;
 const first=Math.floor(origin+Math.min(next,offset)+train.start);
 const last=Math.ceil(origin+Math.max(next,offset)+train.end+1)-1;
 const crossStart=Math.floor(crossMin),crossEnd=Math.ceil(crossMax)-1;
 // Skip a stationary footprint until a block is edited or the swept range changes.
 const revision=world.trainObstacleRevision??0;
 const chunks=world.trainChunkRevision??0;
 const cache=e.obstruction;
 if(cache&&cache.first===first&&cache.last===last&&cache.revision===revision&&cache.chunks===chunks)return cache.blocked;
 let blocked=false;
 scan:for(let a=first;a<=last;a++)for(let c=crossStart;c<=crossEnd;c++){
  const x=xAxis?a:crossOrigin+c,z=xAxis?crossOrigin+c:a;
  if(world.getChunk&&!world.getChunk(Math.floor(x/SIZE),Math.floor(z/SIZE),false)){blocked=true;break scan}
  for(let h=y-(Math.abs(c)<=1?1:0);h<y+Math.ceil(TRAIN.roof+.18);h++){
   const id=world.get(x,h,z,false);
   if(id===B.AIR||isTrack(id)||h===y&&Math.abs(c)===2&&platformEdge(id,c,train.axis,world.getShapeState?.(x,h,z)))continue;
   blocked=true;break scan;
  }
 }
 e.obstruction={first,last,revision,chunks,blocked};
 return blocked;
}
