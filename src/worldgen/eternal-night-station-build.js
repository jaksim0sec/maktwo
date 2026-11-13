import {BLOCK as B} from '../core/blocks.js';
import {hash} from '../util/math.js';

const alongAndAcross=(site,x,z)=>site.axis==='x'?[x-site.x,z-site.z]:[z-site.z,x-site.x];
const facing=(site,side)=>site.axis==='x'?(side>0?4:0):(side>0?6:2);

/** Stamp only fixed infrastructure. Rolling stock is a persistent entity. */
export function stampElevatedStationColumn(plan,x,z,put){
 if(plan.cityBlueprints===true||plan.cityBlueprints>=8)
  return stampRaisedStationColumn(plan,x,z,put);
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

// v8: abandoned station suspended on a braced deck, with ramped approaches.
// Structural units stay part of deterministic worldgen, never entity meshes.
function stampRaisedStationColumn(plan,x,z,put){
 const {layout,stations}=plan,dx=x-layout.centerX,dz=z-layout.centerZ;
 const hub=plan.stationHub;
 if(!hub)return;
 for(const {line,y,end,hubY,stopRadius}of plan.stationLines){
  const axis=line===0?'x':'z',along=axis==='x'?dx:dz,cross=axis==='x'?dz:dx,radial=Math.abs(along);
  if(!end||Math.abs(cross)>5.7||radial<hub.radius||radial>end)continue;
  const base=hubY??hub.levels[line]??y;
  const grade=Math.max(0,Math.min(1,(radial-hub.radius)/Math.max(1,stopRadius-hub.radius-6)));
  const deckY=Math.round(base+(y-base)*grade),edge=Math.abs(cross),run=Math.floor(radial);
  // Elevated bracket every 11 cells, thin deck between them.
  put(deckY-4,B.STATION_STATION_PIPE);
  put(deckY-3,B.STATION_TRACK_BALLAST);
  if(edge<1.45)put(deckY-2,run%3===0?B.PART_STATION_TRACK_2:B.STATION_TRACK_BALLAST);
  else if(edge<2.45)put(deckY-2,B.PART_STATION_TRACK_3,axis==='x'?0:2);
  else{
   put(deckY-2,B.STATION_STATION_PIPE);
   put(deckY-1,edge<3.55?B.STATION_PLATFORM_TACTILE:
    edge<4.55?B.STATION_PLATFORM_ORANGE:B.STATION_PLATFORM_STONE);
   if(edge>4.3&&run%9===0)put(deckY,B.PART_STATION_STATIONLINK_1,
    axis==='x'?(cross>0?4:0):(cross>0?6:2));
  }
  if(run%13===0&&edge<.6){
   for(let h=layout.floorY;h<deckY-4;h++)put(h,h>deckY-7?B.STATION_STATION_PIPE:B.STATION_STATION_SOOT);
  }
  // The portal follows the grade and stays open at the library threshold.
  if(radial>=layout.centerRadius-2&&radial<=layout.centerRadius+3)
   for(let h=deckY;h<deckY+5;h++)put(h,B.AIR);
 }
 for(const site of stations){
  const [along,cross]=alongAndAcross(site,x,z),edge=Math.abs(cross);
  const halfLength=(site.axis==='x'?site.bounds.x1-site.bounds.x0:site.bounds.z1-site.bounds.z0)*.5;
  const halfWidth=(site.axis==='x'?site.bounds.z1-site.bounds.z0:site.bounds.x1-site.bounds.x0)*.5;
  if(Math.abs(along)>halfLength||edge>halfWidth)continue;
  const y=site.y,run=Math.floor(along+halfLength);
  const grime=hash(Math.floor(along/3),Math.floor(cross/2),site.id,layout.seed);
  const colored=grime>.80?B.STATION_STATION_ALGAE:grime<.20?B.STATION_STATION_SOOT:B.STATION_PLATFORM_STONE;
  if(edge>2.45){
   // Platform edge is a straight tactile strip. Keep boarding doors clear.
   put(y-4,B.STATION_STATION_PIPE);
   put(y-3,B.STATION_STATION_SOOT);
   put(y-2,B.CONCRETE);
   put(y-1,edge<3.55?B.STATION_PLATFORM_TACTILE:
    edge<4.55?B.STATION_PLATFORM_ORANGE:colored);
   // Drainage grilles sit behind the circulation lane.
   if(edge>5.5&&edge<6.5&&run%7===0)put(y-1,B.STATION_STATION_GRILLE);
   // Old station furniture and occasional long-abandoned crates off the aisle.
   if(edge>5.6&&edge<6.6&&run%19===7)
    put(y,B.PART_STATION_TRAININTERIOR_1,facing(site,Math.sign(cross)));
   if(edge>6.9&&run%23===12&&grime>.60)put(y,B.CRATE);
  }
  // The deck is visibly elevated on sparse pillars, rather than a full wall.
  if(edge>halfWidth-1.2&&run%12===0){
   for(let h=layout.floorY+2;h<y-4;h++)
    put(h,h>y-7?B.STATION_STATION_PIPE:B.STATION_STATION_SOOT);
   for(let h=y;h<y+8;h++)
    put(h,h%4===0?B.STATION_STATION_BLUE:B.STATION_STATION_CREAM);
  }
  // Retired ceramic cladding and service panels on the outer wall.
  if(edge>halfWidth-.85&&Math.abs(along)<halfLength-1){
   for(let h=y;h<y+8;h++){
    const stained=hash(Math.floor(run/5),h>>2,site.id,layout.seed);
    put(h,stained>.72?B.STATION_STATION_ALGAE:
      h<y+3?B.STATION_STATION_BLUE:stained<.14?B.STATION_STATION_SOOT:B.STATION_STATION_CREAM);
   }
   if(run%11===0)put(y+4,B.PART_STATION_PLATFORM_5,facing(site,Math.sign(cross)));
  }
  if(Math.abs(along)>=halfLength-1)continue;
  // Tall arched canopy: high over rails, low at outer walls, shallow skylight tears.
  const crown=Math.round(3*Math.sqrt(Math.max(0,1-(edge/halfWidth)**2)));
  const roofY=y+9+crown,opening=edge<2.0&&run%17<2;
  if(!opening)put(roofY,run%9===0?B.STATION_STATION_BLUE:
    grime>.75?B.STATION_STATION_ALGAE:B.STATION_STATION_SOOT);
  if(run%9===0&&edge>2.5)put(roofY-1,B.STATION_STATION_PIPE);
  // Along-the-aisle duct trunks and disused cable trays.
  if(edge>5.4&&edge<6.5){
   put(y+7,B.STATION_STATION_PIPE);
   if(run%4===0)put(y+6,B.PART_STATION_STATIONLINK_2,facing(site,Math.sign(cross)));
  }
  if(edge>4.6&&edge<5.5&&run%11===3)put(y+5,B.PART_STATION_PLATFORM_3,facing(site,Math.sign(cross)));
  if(edge>4.6&&edge<5.5&&run%13===8)put(y+6,B.PART_STATION_STATIONLINK_4,facing(site,Math.sign(cross)));
  // Retain the existing light types. Some old fittings still work, others do not.
  if(edge>4.6&&edge<5.5&&run%12===0)
   put(y+8,hash(run,site.id,0,layout.seed)>.30?B.FLUORESCENT:B.BROKEN_FLUORESCENT);
 }
}
