import {STATION_MATERIALS,STATION_PART_START} from './station-materials.js';
// Standalone one-voxel 3D assemblies. A full train is composed from these units.
export const STATION_PART_FAMILIES=Object.freeze([
 {key:'trainWall',label:'전동차 차체',variants:['골강판 측벽','철제 차창','슬라이딩 좌문','슬라이딩 우문','차량 지붕 이음']},
 {key:'trainInterior',label:'전동차 실내',variants:['청록 연결 좌석','스테인리스 손잡이 봉','삼각 현수 손잡이','수하물 선반','운전실 계기반']},
 {key:'track',label:'철도 선로',variants:['자갈 도상','레일 침목','주행 레일','급전 레일','선로 배선 트레이']},
 {key:'platform',label:'역 승강장',variants:['승강장 단부','점자 유도 경계','노선 안내판','개찰구','환기 그릴']},
 {key:'stationLink',label:'도시 연결부',variants:['연결통로 난간','상부 배관','전선 덕트','방향 안내 표지','계단/경사 연결']},
]);
export const STATION_PARTS=Object.freeze(STATION_PART_FAMILIES.flatMap((family,section)=>
 family.variants.map((variantName,variant)=>Object.freeze({
 id:STATION_PART_START+section*5+variant,
 key:'PART_STATION_'+family.key.toUpperCase()+'_'+(variant+1),
 name:family.label+' · '+variantName,
 family:family.key,variant,section:14+section
 }))));
export const stationPartById=id=>id>=STATION_PART_START&&id<STATION_PART_START+STATION_PARTS.length
 ?STATION_PARTS[id-STATION_PART_START]:null;
const M=Object.fromEntries(STATION_MATERIALS.map(m=>[m.key.slice(8),m.id]));
// The same parts drive world mesh, collision, picking and item representations.
export function stationPartGeometry(id){
 const p=stationPartById(id);if(!p)return null;
 const a=[],add=(x,y,z,w,h,d,material,solid=false,alpha=false)=>{
  if(w<=0||h<=0||d<=0||x<0||y<0||z<0||x+w>1.000001||y+h>1.000001||z+d>1.000001)throw Error('Invalid station geometry '+p.key);
  a.push({x,y,z,w,h,d,material:typeof material==='number'?material:M[material],solid,alpha});
 };
 const dark='TRAIN_RUBBER',metal='TRAIN_DOOR_STEEL',skin='TRAIN_CORRUGATED',glass='TRAIN_SMOKED_GLASS',enamel='TRAIN_ENAMEL';
 switch(p.family){
 case 'trainWall':{
  if(p.variant===4){ // Roof ribs, ventilation cassette and shallow drainage.
   add(0,.83,0,1,.15,1,enamel,true);
   for(const z of [.09,.47,.85])add(0,.98,z,1,.02,.065,skin);
   for(const x of [.1,.82])add(x,.79,.13,.075,.05,.74,metal);
   break;
  }
  // 8 cm steel side sandwich. Door and window panels are never full cubes.
  for(const x of [.015,.952])add(x,0,.445,.033,1,.11,metal,true);
  add(.03,0,.465,.94,.11,.065,skin,true);
  add(.03,.92,.465,.94,.08,.065,skin,true);
  if(p.variant===0){
   add(.06,.13,.477,.88,.76,.045,skin,true);
   for(const y of [.26,.50,.74])add(.055,y,.452,.89,.025,.04,metal);
   add(.08,.15,.447,.06,.69,.025,enamel);
  }else if(p.variant===1){
   add(.05,.12,.48,.90,.20,.055,enamel,true);
   add(.105,.37,.48,.79,.45,.018,glass,false,true);
   for(const y of [.34,.82])add(.08,y,.446,.84,.038,.085,metal);
   for(const x of [.075,.885])add(x,.35,.446,.04,.51,.087,metal);
   add(.20,.87,.44,.59,.025,.09,enamel);
  }else{
   // Dedicated two-leaf sliding door: seam, track, recessed window and pull.
   const left=p.variant===2;
   add(.05,.12,.475,.90,.80,.055,metal,true);
   add(.13,.45,.445,.72,.33,.014,glass,false,true);
   for(const x of [.11,.86])add(x,.13,.434,.043,.76,.08,enamel);
   add(.12,.79,.434,.75,.036,.08,enamel);
   add(.12,.41,.434,.75,.032,.08,enamel);
   add(left?.86:.12,.22,.416,.035,.20,.044,dark);
   add(left?.82:.12,.29,.406,.045,.09,.04,enamel);
   add(.42,.08,.404,.16,.03,.10,metal);
  }
  break;
 }
 case 'trainInterior':{
  if(p.variant===0){ // Actual bench seat, feet and separate reclining back.
   for(const x of [.05,.68])add(x,.05,.22,.085,.32,.54,metal,true);
   add(.04,.37,.16,.88,.115,.69,'TRAIN_SEAT',true);
   add(.04,.48,.70,.88,.41,.115,'TRAIN_SEAT',true);
   add(.09,.47,.12,.77,.032,.09,metal);
   for(const x of [.43,.89])add(x,.48,.20,.025,.35,.55,metal);
   add(.07,.86,.70,.83,.045,.13,metal);
  }else if(p.variant===1){
   add(.47,0,.47,.062,1,.062,metal,true);
   add(.38,.92,.45,.24,.035,.10,metal);
   for(const y of [.23,.73])add(.425,y,.42,.15,.035,.14,metal);
  }else if(p.variant===2){ // Real hollow hanging straps, not painted rectangles.
   add(.06,.94,.43,.88,.045,.13,metal);
   for(const x of [.16,.47,.78]){
    add(x,.71,.48,.042,.22,.05,metal);
    add(x-.035,.62,.465,.112,.035,.08,metal);
    add(x-.035,.55,.465,.032,.12,.08,'TRAIN_RUBBER');
    add(x+.045,.55,.465,.032,.12,.08,'TRAIN_RUBBER');
    add(x-.035,.54,.465,.11,.028,.08,'TRAIN_RUBBER');
   }
  }else if(p.variant===3){
   for(const x of [.08,.88])add(x,.50,.80,.035,.39,.05,metal);
   for(const y of [.59,.77])add(.10,y,.76,.78,.035,.12,metal);
   for(const x of [.20,.38,.56,.74])add(x,.60,.75,.025,.18,.035,metal);
  }else{
   add(.11,.08,.13,.78,.58,.69,'TRAIN_ENAMEL',true);
   add(.16,.56,.10,.68,.33,.12,'TRAIN_RUBBER');
   for(const x of [.24,.45,.66])add(x,.63,.085,.11,.07,.04,'TRAIN_SMOKED_GLASS',false,true);
   add(.21,.15,.105,.52,.20,.055,metal);
   for(const x of [.31,.58])add(x,.23,.075,.08,.045,.08,'PLATFORM_ORANGE');
  }
  break;
 }
 case 'track':{
  if(p.variant===0){add(0,.00,0,1,.18,1,'TRACK_BALLAST',true);break}
  if(p.variant===1){
   add(.07,.06,.12,.86,.15,.76,'TRACK_SLEEPER',true);
   for(const z of [.18,.75])add(.13,.20,z,.74,.025,.075,'TRACK_RAIL');
   for(const x of [.18,.77])for(const z of [.18,.75])add(x,.215,z,.045,.035,.07,'TRACK_GREASE');
   break;
  }
  if(p.variant===2){
   add(.05,.01,.12,.90,.12,.77,'TRACK_BALLAST',true);
   for(const z of [.18,.76]){
    add(0,.22,z,1,.085,.10,'TRACK_RAIL',true);
    add(0,.16,z+.02,1,.06,.06,'TRACK_GREASE',true);
   }
   add(.05,.13,.10,.90,.07,.83,'TRACK_SLEEPER',true);break;
  }
  if(p.variant===3){
   add(0,.02,.19,1,.095,.23,'TRACK_GREASE',true);
   add(0,.13,.25,1,.07,.07,'TRACK_RAIL',true);
   for(const x of [.1,.78])add(x,.04,.12,.1,.12,.37,'STATION_CABLE');
   break;
  }
  add(0,.02,.27,1,.13,.44,'STATION_CABLE',true);
  for(const y of [.12,.19])add(0,y,.27,1,.018,.44,'STATION_GRILLE');
  for(const x of [.07,.89])add(x,.15,.28,.035,.04,.42,'STATION_PIPE');
  break;
 }
 case 'platform':{
  if(p.variant===0){
   add(0,0,0,1,.62,1,'PLATFORM_STONE',true);
   add(0,.62,.09,1,.055,.82,'PLATFORM_ORANGE',true);
   add(0,.62,0,1,.075,.10,'PLATFORM_TACTILE',true);
   add(0,.11,0,1,.09,.055,'STATION_SOOT');
  }else if(p.variant===1){
   add(0,0,0,1,.24,1,'PLATFORM_STONE',true);
   add(0,.24,0,1,.045,1,'PLATFORM_TACTILE',true);
   for(const x of [.08,.28,.48,.68,.88])for(const z of [.14,.54])add(x,.285,z,.06,.018,.06,'PLATFORM_TACTILE');
  }else if(p.variant===2){
   for(const x of [.06,.88])add(x,0,.46,.06,.95,.08,metal,true);
   add(.06,.65,.47,.88,.25,.07,'STATION_SOOT');
   add(.18,.76,.437,.24,.045,.03,'PLATFORM_TACTILE');
   add(.54,.76,.437,.23,.045,.03,'STATION_CREAM');
   add(.78,.74,.43,.075,.08,.04,'PLATFORM_STONE');
  }else if(p.variant===3){
   add(.13,0,.13,.74,.73,.70,'STATION_GRILLE',true);
   add(.2,.68,.18,.60,.09,.57,'STATION_CREAM');
   add(.43,.76,.19,.14,.11,.10,'TRAIN_SMOKED_GLASS',false,true);
   add(.83,.17,.44,.14,.61,.13,metal);
  }else{
   add(.06,.09,.08,.88,.10,.84,'STATION_GRILLE');
   for(const y of [.23,.36,.49,.62])add(.07,y,.09,.86,.035,.82,'STATION_PIPE');
   for(const x of [.08,.86])add(x,.07,.08,.055,.67,.84,'STATION_CABLE');
  }break;
 }
 case 'stationLink':{
  if(p.variant===0){
   add(0,0,.04,1,.12,.92,'PLATFORM_STONE',true);
   for(const x of [.045,.85])add(x,.12,.80,.085,.78,.10,metal,true);
   for(const y of [.47,.84])add(0,y,.81,1,.055,.075,'STATION_PIPE');
  }else if(p.variant===1){
   add(0,.83,.32,1,.13,.36,'STATION_PIPE');
   for(const x of [.07,.86])add(x,.67,.39,.06,.18,.23,metal);
   add(.04,.92,.35,.91,.03,.28,'STATION_CABLE');
  }else if(p.variant===2){
   add(.08,.65,.08,.84,.15,.22,'STATION_CABLE');
   add(.08,.81,.08,.84,.06,.22,'STATION_GRILLE');
   for(const x of [.14,.84])add(x,.62,.10,.035,.20,.18,metal);
  }else if(p.variant===3){
   for(const x of [.09,.87])add(x,.39,.42,.045,.48,.09,metal);
   add(.08,.52,.43,.85,.33,.065,'STATION_SOOT');
   add(.20,.62,.39,.29,.038,.04,'STATION_CREAM');
   add(.57,.62,.39,.25,.038,.04,'PLATFORM_TACTILE');
  }else{
   add(0,0,0,1,.25,.48,'PLATFORM_STONE',true);
   add(0,0,.49,1,.50,.51,'PLATFORM_STONE',true);
   for(const x of [.035,.91])add(x,.49,.48,.055,.22,.46,'STATION_PIPE');
  }break;
 }
 }
 return a;
}
