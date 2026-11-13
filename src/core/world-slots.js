// Local city save slots are an index, never a replacement for legacy world keys.
export const WORLD_SLOT_KEY='maktwo:city-worlds:v1';
export const ACTIVE_WORLD_KEY='maktwo:active-world:v1';
export const playerKey=name=>`maktwo:player:${name}`;
const valid=p=>p&&/^CitySave-[0-9]+-[a-z0-9]+$/.test(p.name)&&p.mode==='eternal-city-lab'
 &&Number.isInteger(p.seed)&&p.seed>=-2147483648&&p.seed<=2147483647
 &&typeof p.label==='string'&&p.label.length<=50;
export function loadWorldSlots(storage){
 try{const list=JSON.parse(storage?.getItem(WORLD_SLOT_KEY)||'[]');return Array.isArray(list)?list.filter(valid).slice(0,100):[]}
 catch{return []}
}
export function addWorldSlot(storage,seed,nonce=Date.now()){
 if(!Number.isInteger(seed)||seed< -2147483648||seed>2147483647)throw Error('Invalid world seed');
 const slots=loadWorldSlots(storage),name=`CitySave-${nonce}-${(seed>>>0).toString(36)}`;
 if(slots.some(slot=>slot.name===name))throw Error('World already exists');
 const value={name,seed,mode:'eternal-city-lab',label:`내 게임 ${slots.length+1}`};
 storage.setItem(WORLD_SLOT_KEY,JSON.stringify([...slots,value]));return value;
}
export function savePlayerState(storage,name,player){
 const data={version:1,x:player.x,y:player.y,z:player.z,yaw:player.yaw,pitch:player.pitch,
  creative:player.creative,fly:player.fly,hp:player.hp,stamina:player.stamina};
 storage.setItem(playerKey(name),JSON.stringify(data));
}
export function loadPlayerState(storage,name,height){
 try{
  const p=JSON.parse(storage?.getItem(playerKey(name))||'null');
  if(p?.version!==1||![p.x,p.y,p.z,p.yaw,p.pitch,p.hp,p.stamina].every(Number.isFinite))return null;
  if(Math.abs(p.x)>100000||Math.abs(p.z)>100000||p.y<1||p.y>=height-2)return null;
  return {x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:Math.max(-1.55,Math.min(1.55,p.pitch)),
   hp:Math.max(1,Math.min(20,p.hp)),stamina:Math.max(0,Math.min(100,p.stamina)),
   creative:Boolean(p.creative),fly:Boolean(p.creative&&p.fly)};
 }catch{return null}
}
