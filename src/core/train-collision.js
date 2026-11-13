// Lightweight physical proxies for entity trains. World voxels remain untouched.
// Fixed-size AABB ranges are checked only for a nearby carriage, with no mesh walks.
const overlaps=(a,b,c,d)=>a<d-1e-5&&b>c+1e-5;
export function trainCollision(trains,x,y,z,width=.6,height=1.8){
 if(!trains?.length)return false;
 const radius=width*.5,top=y+height;
 for(const e of trains){
  if(e.type!=='train')continue;
  const t=e.train,along=t.axis==='x'?x-e.x:z-e.z;
  const cross=t.axis==='x'?z-e.z:x-e.x;
  const a0=along-radius,a1=along+radius,c0=cross-radius,c1=cross+radius;
  if(a1<=t.start||a0>=t.end+1||c1<=-2.7||c0>=2.8||top<=e.y||y>=e.y+3.24)continue;
  // Underfoot rubber deck and the single joined overhead roof cassette.
  if(overlaps(a0,a1,t.start,t.end+1)){
   if(overlaps(c0,c1,-1.5,2.5)&&overlaps(y,top,e.y,e.y+1))return true;
   if(overlaps(c0,c1,-2,3)&&overlaps(y,top,e.y+3,e.y+3.23))return true;
  }
  if(!overlaps(y,top,e.y+1,e.y+3))continue;
  // Cab end bulkheads. The inter-car rubber connection remains walkable.
  if(overlaps(c0,c1,-1.55,2.55)&&
    (overlaps(a0,a1,t.start,t.start+.15)||overlaps(a0,a1,t.end+.85,t.end+1)))return true;
  for(const side of [-1,1]){
   const lo=side<0?-1.62:2.38,hi=side<0?-1.39:2.61;
   if(!overlaps(c0,c1,lo,hi))continue;
   for(const car of t.carriages){
    if(!overlaps(a0,a1,car.from,car.to+1))continue;
    let doorway=false;
    if(e.doorOpen>.95)for(const [left]of car.doors)
     if(a0>=left+.10&&a1<=left+1.90){doorway=true;break}
    if(!doorway)return true;
   }
  }
 }
 return false;
}
// A standing passenger shares the carriage's small translation for free.
export function carryTrainPassenger(trains,player,deltaByTrain){
 if(!player?.grounded)return false;
 const radius=player.width*.5;
 for(const e of trains||[]){
  const step=deltaByTrain.get(e.id)||0;
  if(!step||Math.abs(player.y-(e.y+1))>.07&&Math.abs(player.y-(e.y+3.23))>.07)continue;
  const along=e.train.axis==='x'?player.x-e.x:player.z-e.z;
  const cross=e.train.axis==='x'?player.z-e.z:player.x-e.x;
  if(along<e.train.start+radius||along>e.train.end+1-radius||cross<-1.5+radius||cross>2.5-radius)continue;
  if(e.train.axis==='x')player.x+=step;else player.z+=step;
  return true;
 }
 return false;
}
