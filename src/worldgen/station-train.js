import {BLOCK as B} from '../core/blocks.js';

const WALL=[B.PART_STATION_TRAINWALL_1,B.PART_STATION_TRAINWALL_2,
  B.PART_STATION_TRAINWALL_3,B.PART_STATION_TRAINWALL_4,B.PART_STATION_TRAINWALL_5];
const INTERIOR=[B.PART_STATION_TRAININTERIOR_1,B.PART_STATION_TRAININTERIOR_2,
  B.PART_STATION_TRAININTERIOR_3,B.PART_STATION_TRAININTERIOR_4,
  B.PART_STATION_TRAININTERIOR_5];
const RUNNING=[B.PART_STATION_TRAINRUNNING_1,B.PART_STATION_TRAINRUNNING_2,
  B.PART_STATION_TRAINRUNNING_3,B.PART_STATION_TRAINRUNNING_4,
  B.PART_STATION_TRAINRUNNING_5];

/** A reusable, deterministic assembly plan. Vehicle coordinates are independent of chunks. */
export function createStationTrain({x=0,z=0,floorY=22,cars=2,carLength=17,gap=3,width=5,axis='x'}={}){
  if(!Number.isInteger(cars)||cars<1||!Number.isInteger(carLength)||carLength<13||
    !Number.isInteger(gap)||gap<2||!Number.isInteger(width)||width<5||width%2!==1||
    !['x','z'].includes(axis))throw new RangeError('Invalid train assembly');
  const total=cars*carLength+(cars-1)*gap;
  const start=-Math.floor(total/2);
  const carriages=Array.from({length:cars},(_,index)=>{
    const from=start+index*(carLength+gap),to=from+carLength-1;
    // Two 2-cell sliding doorways per side; each car has two visible bogies.
    const doors=[Math.floor(carLength*.30),Math.floor(carLength*.65)].map(offset=>{
      const a=index===cars-1&&index>0?carLength-2-offset:offset;
      return [from+a,from+a+1];
    });
    const bogies=[from+(index===0?3:2),to-(index===cars-1?3:2)];
    return {index,from,to,doors,bogies,front:index===0?from:index===cars-1?to:null};
  });
  return {x,z,floorY,axis,width,carLength,gap,start,end:start+total-1,carriages};
}

/** Place a single world column. `put(y,id,turn)` writes into the owning chunk. */
export function stampStationTrainColumn(train,x,z,put){
  const along=(train.axis==='x'?x-train.x:z-train.z);
  const cross=(train.axis==='x'?z-train.z:x-train.x);
  const half=(train.width-1)/2,side=Math.abs(cross)===half;
  if(along<train.start||along>train.end||Math.abs(cross)>half)return;
  const car=train.carriages.find(v=>along>=v.from&&along<=v.to);
  const {floorY:y}=train;
  const turn=cross>0?(train.axis==='x'?4:6):(train.axis==='x'?0:2);
  if(!car){
    // A three-cell flexible connection has a walkable center and thin rubber sides.
    if(cross===0&&(along-train.start-train.carLength)%(train.carLength+train.gap)===Math.floor(train.gap/2))
      put(y-1,RUNNING[3]);
    if(Math.abs(cross)<half)put(y,B.STATION_TRAIN_RUBBER);
    if(side){put(y+1,RUNNING[4],turn);put(y+2,RUNNING[4],turn)}
    if(Math.abs(cross)<=half)put(y+3,WALL[4]);
    return;
  }
  const local=along-car.from,front=car.front===along;
  const cabSide=car.front!==null&&(car.index===0?local<=2:local>=train.carLength-3);
  const intercar=car.index===0?along===car.to:car.index===train.carriages.length-1?along===car.from:
    along===car.from||along===car.to;
  const doorway=car.doors.find(([left,right])=>along===left||along===right);
  // Two wheel assemblies sit under each car on both flanks, with open rail gaps.
  if(side){
    put(y,RUNNING[1],turn);
    if(intercar){put(y+1,RUNNING[4],turn);put(y+2,RUNNING[4],turn)}
    else if(front){
      const nose=car.index===0?(train.axis==='x'?2:0):(train.axis==='x'?6:4);
      put(y+1,WALL[0],nose);put(y+2,RUNNING[2],nose);
    }else if(doorway&&!cabSide){
      const leaf=along===doorway[0]?WALL[2]:WALL[3];
      put(y+1,leaf,turn);put(y+2,leaf,turn);
    }else{
      put(y+1,WALL[0],turn);
      put(y+2,cabSide?WALL[0]:WALL[1],turn);
    }
  }else{
    if(Math.abs(cross)===half-1&&car.bogies.includes(along))put(y-1,RUNNING[0],turn);
    put(y,B.STATION_TRAIN_RUBBER);
    if(front){
      const nose=car.index===0?(train.axis==='x'?2:0):(train.axis==='x'?6:4);
      put(y+1,WALL[0],nose);put(y+2,RUNNING[2],nose);
    }else if(car.front!==null&&Math.abs(along-car.front)===1&&cross===0){
      put(y+1,INTERIOR[4],car.index===0?2:6);
    }else if(Math.abs(cross)===half-1&&!doorway&&!cabSide&&local%3===0){
      put(y+1,INTERIOR[0],turn);
      if(local%6===0)put(y+2,INTERIOR[3],turn);
    }else if(cross===0&&!doorway&&!cabSide&&local%5===2){
      put(y+1,INTERIOR[1]);
    }
    if(cross===0&&!cabSide&&local%3===1)put(y+2,INTERIOR[2]);
  }
  // The fitted cassette spans the whole car; no detached checkerboard roof ribs.
  put(y+3,WALL[4]);
}

export function stampTrainCoupler(train,x,z,put){
  const along=train.axis==='x'?x-train.x:z-train.z;
  const cross=train.axis==='x'?z-train.z:x-train.x;
  if(cross!==0||along!==train.start-1&&along!==train.end+1)return;
  const left=along<train.start;
  put(train.floorY,B.PART_STATION_TRAINRUNNING_4,
    train.axis==='x'?(left?2:6):(left?0:4));
}
