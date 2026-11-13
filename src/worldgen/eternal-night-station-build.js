import {BLOCK as B} from '../core/blocks.js';
import {hash} from '../util/math.js';

const facing=(axis,side)=>axis==='x'?(side>0?0:4):(side>0?6:2);
const mod=(n,d)=>((n%d)+d)%d;

export function stampTrackColumn(axis,run,cross,y,put){
 put(y-3,B.STATION_TRACK_BALLAST);
 const direction=axis==='x'?0:2;
 if(Math.abs(cross)===1){
  put(y-2,mod(run,2)===0?B.PART_STATION_TRACK_3:B.PART_STATION_TRACK_4,direction);
 }else if(cross===0&&mod(run,2)===0)put(y-2,B.PART_STATION_TRACK_2,direction);
}

export function stampStationHall(site,x,z,put,seed){
 const along=Math.floor(site.axis==='x'?x-site.x:z-site.z);
 const cross=Math.floor(site.axis==='x'?z-site.z:x-site.x);
 const edge=Math.abs(cross),side=Math.sign(cross);
 const span=site.axis==='x'?site.bounds.x1-site.bounds.x0:site.bounds.z1-site.bounds.z0;
 const width=site.axis==='x'?site.bounds.z1-site.bounds.z0:site.bounds.x1-site.bounds.x0;
 const end=Math.floor(span/2),outer=Math.floor(width/2),y=site.y;
 if(along< -end||along>=end||edge>outer)return;
 const bay=along+end,rib=bay%8===2,portal=site.exits?.some(exit=>exit.side===side&&Math.abs(along+.5-exit.along)<exit.width/2);
 const turn=facing(site.axis,side),fixtureTurn=site.axis==='x'?0:2;
 const damp=hash(Math.floor(along/5),site.id,Math.floor(cross/2),seed);
 const fromHub=site.approach?.from[site.axis==='x'?0:2];
 const outward=fromHub===undefined?0:Math.sign((site.axis==='x'?site.x:site.z)-fromHub);
 const crossing=(outward<=0&&along< -end+3||outward>=0&&along>=end-3)&&edge<3;
 // Clear the hall once, so hidden terrain never fills the platform aisle or rail bore.
 for(let h=y-2;h<=y+10;h++)put(h,B.AIR);
 put(y-4,B.CONCRETE_BEAM);
 if(edge<=1&&!crossing)stampTrackColumn(site.axis,along,cross,y,put);
 if(edge===2&&!crossing){
  put(y-3,B.CONCRETE_BEAM);
  put(y-1,B.PART_STATION_PLATFORM_1,turn);
 }
 if(edge>=3||crossing){
  put(y-3,B.CONCRETE_BEAM);
  put(y-2,B.STATION_STATION_SOOT);
  put(y-1,edge===3?B.STATION_PLATFORM_TACTILE:edge===outer-2&&bay%8===0?B.STATION_STATION_GRILLE:
   edge===4?B.STATION_PLATFORM_ORANGE:damp>.88&&edge>=6?B.STATION_STATION_ALGAE:B.STATION_PLATFORM_STONE);
 }

 // Long tiled walls, windows, and bridge openings with no furniture in the entrances.
 if(edge===outer){
  for(let h=y;h<=y+6;h++){
   if(portal&&h<y+4)continue;
   const tile=h===y+1||h===y+5?B.STATION_STATION_BLUE:B.STATION_STATION_CREAM;
   const window=!rib&&!portal&&bay%8>=3&&bay%8<=6&&h>=y+2&&h<=y+4;
   put(h,window?B.PART_WINDOW_4:damp>.88&&h<y+2?B.STATION_STATION_ALGAE:tile,window?turn:undefined,true);
  }
  if(rib&&!portal)for(let h=y-8;h<y-4;h++)put(h,B.CONCRETE_BEAM);
 }
 if(edge===outer-2&&!portal){
  if(rib){
   for(let h=y;h<y+7;h++)put(h,h===y+1?B.STATION_STATION_BLUE:B.STATION_STATION_CREAM);
   put(y+2,B.PART_STATION_PLATFORM_3,turn);
  }else if(bay%16===6)put(y,B.PART_STATION_TRAININTERIOR_1,turn);
  else if(bay%23===11&&damp>.58)put(y,B.CRATE);
 }
 if(portal&&edge===outer-1&&bay%4===0)put(y+4,B.PART_STATION_STATIONLINK_4,turn);
 const roof=y+7+Math.round(3*Math.sqrt(Math.max(0,1-(edge/(outer+.5))**2)));
 const skylight=edge<=1&&!rib&&bay%12>=3&&bay%12<=8;
 put(roof,skylight?B.DIRTY_GLASS:rib?B.CONCRETE_BEAM:B.STATION_STATION_SOOT);
 if(rib)put(roof-1,B.CONCRETE_BEAM);
 if(edge===5){
  put(y+5,B.STATION_STATION_PIPE);
  if(bay%6===2)put(y+4,hash(bay,site.id,cross,seed)>.28?B.FLUORESCENT:B.BROKEN_FLUORESCENT,fixtureTurn);
 }
 if(edge===6&&bay%10===4)put(y+5,B.PART_STATION_STATIONLINK_3,fixtureTurn);
 if((along===-end||along===end-1)&&edge>=3&&edge<outer)
  put(y+1,B.PART_STATION_STATIONLINK_4,site.axis==='x'?2:0);
}

export function stampElevatedStationColumn(plan,x,z,put){
 const {layout,stationHub,stationLines,stations}=plan;
 if(!stationHub)return;
 for(const {line,y,end,hubY} of stationLines){
  const axis=line===0?'x':'z';
  const run=Math.floor((line===0?x-layout.centerX:z-layout.centerZ));
  const cross=Math.floor((line===0?z-layout.centerZ:x-layout.centerX));
  const edge=Math.abs(cross),radial=Math.abs(run+.5);
  if(!end||edge>5||radial<stationHub.radius||radial>end)continue;
  const level=hubY??y;
  if(edge<=2||radial<layout.centerRadius+5)
   for(let h=level-2;h<level+4;h++)put(h,B.AIR);
  if(edge<=1)stampTrackColumn(axis,run,cross,level,put);
  else{
   put(level-3,B.CONCRETE_BEAM);
   put(level-1,edge===2?B.PART_STATION_PLATFORM_1:edge===3?B.STATION_PLATFORM_TACTILE:B.STATION_PLATFORM_STONE,
    edge===2?facing(axis,Math.sign(cross)):undefined);
   if(edge===5)put(level,B.PART_STATION_STATIONLINK_1,facing(axis,Math.sign(cross)));
  }
  if(edge===3&&run%16===0&&radial>layout.centerRadius+4)
   for(let h=layout.floorY;h<level-3;h++)put(h,B.CONCRETE_BEAM);
 }
 for(const site of stations)stampStationHall(site,x,z,put,layout.seed);
}
