// Station sites only: architecture, track and service state belong to later passes.
// The two lines cross inside the library at separate elevations.
export function planCoreStations(layout, unit) {
  const inner=layout.centerRadius+unit*8;
  const outer=layout.miniShaftOffset-layout.miniShaftRadius-unit*7;
  if(outer<=inner+unit*12)return {hub:null,stations:[]};
  const radius=inner+(outer-inner)*.52;
  const length=Math.min(unit*48,(outer-inner)*.42);
  const width=Math.max(19,unit*13);
  const levels=[Math.round(layout.floorY+4*unit),Math.round(layout.floorY+26)];
  const hubRadius=layout.mainShaftRadius+unit*6;
  const hub={x:layout.centerX,z:layout.centerZ,radius:hubRadius,levels,kind:'library-interchange'};
  const stations=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz],id)=>{
    const axis=dx?'x':'z',line=dx?0:1;
    const x=Math.round(layout.centerX+dx*radius),z=Math.round(layout.centerZ+dz*radius);
    const y=levels[line];
    const bounds=axis==='x'?{x0:x-length/2,x1:x+length/2,z0:z-width/2,z1:z+width/2}:
      {x0:x-width/2,x1:x+width/2,z0:z-length/2,z1:z+length/2};
    return {id,axis,line,x,z,y,bounds,hubLevel:levels[line],
      approach:{from:[layout.centerX+dx*hubRadius,levels[line],layout.centerZ+dz*hubRadius],to:[x,y,z]},
      kind:'closed-elevated-station'};
  });
  return {hub,stations};
}

export function stationIntersectsCell(stations,x0,z0,step){
  return stations.some(({bounds:b})=>x0<b.x1&&x0+step>b.x0&&z0<b.z1&&z0+step>b.z0);
}
