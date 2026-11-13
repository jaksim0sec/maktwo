// One double-ended metro car, in 0.8 m voxels. The same measurements
// drive the visual shell, picking, boarding, and obstruction checks.
export const TRAIN = Object.freeze({
 length:25, halfWidth:1.8, center:.5, deck:1, ceiling:3.82, roof:4.05,
 sideWall:.12, doorWidth:1.85, doorHeight:2.55, doorTravel:.89, cabDepth:2.55
});

export function createStationTrain({x=0,z=0,floorY=22,axis='x'}={}){
 const start=-Math.floor(TRAIN.length/2),end=start+TRAIN.length-1;
 const doors=[3.35,8.85,14.35,19.85].map(distance=>start+distance);
 return {x,z,floorY,axis,start,end,doors,bogies:[start+4.9,end-3.9]};
}

export const trainDoorMotion=progress=>{
 const slide=Math.max(0,(progress-.18)/.82);
 return {slide:TRAIN.doorTravel*slide*slide*(3-2*slide),recess:.22*Math.min(1,progress/.18)};
};

export function trainCab(train,side){
 const end=side===-1?train.start:train.end+1;
 const right=side*(train.axis==='x'?1:-1);
 return {end,right,lever:[end-side*1.36,2.12,TRAIN.center+right*1.07]};
}

export function trainControls(train){
 const handles=[];
 for(const side of [-1,1])for(const [index,left] of train.doors.entries()){
  const cross=TRAIN.center+side*(TRAIN.halfWidth-.02);
  handles.push({kind:'door',index:index+(side===1?4:0),side,
   at:[left-.27,1.78,cross]});
 }
 for(const side of [-1,1]){
  const {lever}=trainCab(train,side);
  handles.push({kind:'lever',index:side===-1?8:9,side,
   at:lever});
 }
 return handles;
}
