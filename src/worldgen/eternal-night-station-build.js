import {BLOCK as B} from '../core/blocks.js';
import {hash} from '../util/math.js';

const alongAndAcross=(site,x,z)=>site.axis==='x'?[x-site.x,z-site.z]:[z-site.z,x-site.x];
const facing=(site,side)=>site.axis==='x'?(side>0?4:0):(side>0?6:2);

/** Stamp only fixed infrastructure. Rolling stock is a persistent entity. */
export function stampElevatedStationColumn(plan,x,z,put){
 const {layout,stations}=plan;
 const dx=x-layout.centerX,dz=z-layout.centerZ;
 for(const {line,y,end} of plan.stationLines){
  const axis=line===0?'x':'z',along=axis==='x'?dx:dz,cross=axis==='x'?dz:dx;
  if(!end||Math.abs(cross)>4.45||Math.abs(along)<plan.stationHub.radius||Math.abs(along)>end)continue;
  const radial=Math.abs(along);
  // Cut a real pedestrian/rail portal through the circular library wall.
  if(radial>=layout.centerRadius-2&&radial<=layout.centerRadius+3)
   for(let h=y;h<y+4;h++)put(h,B.AIR);
  put(y-4,B.STATION_STATION_PIPE);
  put(y-3,B.STATION_TRACK_BALLAST);
  if(Math.abs(cross)<1.45)put(y-2,Math.floor(Math.abs(along))%3===0?B.PART_STATION_TRACK_2:B.STATION_TRACK_BALLAST);
  else if(Math.abs(cross)<2.45)put(y-2,B.PART_STATION_TRACK_3,axis==='x'?0:2);
  else{
   put(y-2,B.STATION_STATION_PIPE);
   put(y-1,B.STATION_PLATFORM_STONE);
   if(Math.abs(cross)>3.5&&Math.floor(radial)%4===0)put(y,B.PART_STATION_STATIONLINK_1,axis==='x'?(cross>0?4:0):(cross>0?6:2));
  }
  if(radial>layout.centerRadius+4&&Math.floor(radial)%10===0&&Math.abs(cross)<.5){
   for(let h=layout.floorY;h<y-4;h++)put(h,B.STATION_STATION_SOOT);
  }
 }
 for(const site of stations){
  const [along,cross]=alongAndAcross(site,x,z);
  const halfLength=(site.axis==='x'?site.bounds.x1-site.bounds.x0:site.bounds.z1-site.bounds.z0)/2;
  const halfWidth=(site.axis==='x'?site.bounds.z1-site.bounds.z0:site.bounds.x1-site.bounds.x0)/2;
  if(Math.abs(along)>halfLength||Math.abs(cross)>halfWidth)continue;
  const y=site.y,edge=Math.abs(cross),run=Math.floor(along+halfLength);
  // Paired elevated side platforms: track centered, passengers on both flanks.
  if(edge>2.45){
   put(y-3,B.STATION_STATION_SOOT);
   put(y-2,B.CONCRETE);
   put(y-1,edge<3.55?B.STATION_PLATFORM_TACTILE:edge<4.55?B.STATION_PLATFORM_ORANGE:B.STATION_PLATFORM_STONE);
   const side=Math.sign(cross);
   if(edge>halfWidth-1.3&&run%8===0){
    for(let h=y;h<y+7;h++)put(h,h===y+3?B.STATION_STATION_BLUE:B.STATION_STATION_CREAM);
   }
   if(edge>4.8&&edge<5.8&&run%12===0)put(y,B.PART_STATION_PLATFORM_3,facing(site,side));
   if(edge>4.8&&edge<5.8&&run%15===0)put(y+6,B.FLUORESCENT);
   if(edge>halfWidth-2.5&&edge<halfWidth-1.5&&run%13===0)put(y,B.PART_STATION_STATIONLINK_4,facing(site,side));
   if(edge>halfWidth-1&&run%6===0)put(y+4,B.PART_STATION_STATIONLINK_2,facing(site,side));
  }
  // No roof over the open approach. Each station has a continuous canopy.
  if(Math.abs(along)<halfLength-1&&edge<halfWidth-.5){
   put(y+7,Math.floor(along+halfLength)%9===0?B.STATION_STATION_BLUE:B.STATION_STATION_CREAM);
   if(run%10===0&&edge>3&&edge<4)put(y+6,hash(run,site.id,0,layout.seed)>.28?B.FLUORESCENT:B.BROKEN_FLUORESCENT);
  }
 }
}
