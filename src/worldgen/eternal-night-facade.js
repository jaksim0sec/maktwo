/** Assign external openings by actual building use and face span.
 * Long residential/shop/facility wings get measured window modules while
 * chamfers, narrow recesses and structural piers remain opaque.
 * Windows are NOT selected by random material swaps.
 */
const USE={shops:1,market:1,housing:2,workshops:4,court:8,exchange:8};
export function facadeBay({program,level,entryLevel,edge,bay,frontEdge=0,span=Infinity,stride=5}){
 const front=edge===frontEdge,kind=USE[program]??0,retail=kind===1;
 const longFace=span>=4.5,street=retail&&level<=entryLevel+1&&front&&longFace;
 const service=kind===4,wideFront=front&&span>=12;
 const shopfront=street&&((1<<bay)&0b110)!==0;
 const window=longFace&&(
  kind===2&&(bay===2||wideFront&&bay===3&&(level&3)===0)||
  service&&bay===2&&((level&1)===0||front)||
  kind===8&&level%3===0&&(bay===2||wideFront&&bay===3)||
  retail&&level>entryLevel+1&&bay===2&&(level&1)===0);
 const opening=shopfront?'shopfront':window?'window':'wall';
 const vent=longFace&&service&&!front&&bay===3&&(level&3)===2;
 return {opening,vent,sign:street&&bay===3,front,street};
}

/** A connecting corridor is a passage, not a row of glass-front offices. */
export function enclosedPassageBay(bay){
 const window=bay===2||bay===3;
 return {window,wall:!window,vent:bay===5,sign:false};
}
