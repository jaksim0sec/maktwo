/** Assign external openings by actual building use and face span.
 * Long residential/shop/facility wings get measured window modules while
 * chamfers, narrow recesses and structural piers remain opaque.
 * Windows are NOT selected by random material swaps.
 */
export function facadeBay({program,level,entryLevel,edge,bay,frontEdge=0,span=Infinity,stride=5}){
 const front=edge===frontEdge,retail=program==='shops'||program==='market';
 const longFace=span>=4.5,street=retail&&level<=entryLevel+1&&front&&longFace;
 const service=program==='workshops',publicUse=program==='court'||program==='exchange';
 let opening='wall';
 if(street&&(bay===1||bay===2))opening='shopfront';
 else if(longFace&&program==='housing'){
  // Broad residential frontages gain a second staggered opening every four
  // storeys. All long side/rear wings still get one window bay per module.
  if(bay===2||(front&&span>=12&&bay===3&&level%4===0))opening='window';
 }else if(longFace&&service){
  if(bay===2&&(level%2===0||front))opening='window';
 }else if(longFace&&publicUse){
  if(level%3===0&&(bay===2||(front&&span>=12&&bay===3)))opening='window';
 }else if(longFace&&retail){
  // Upper shops need windows along their sides too; the street-level side
  // remains a service wall, never a fake extra storefront.
  if(level>entryLevel+1&&bay===2&&level%2===0)opening='window';
 }
 const vent=longFace&&service&&!front&&bay===3&&level%4===2;
 return {opening,vent,sign:street&&bay===3,front,street};
}

/** A connecting corridor is a passage, not a row of glass-front offices. */
export function enclosedPassageBay(bay){
 const window=bay===2||bay===3;
 return {window,wall:!window,vent:bay===5,sign:false};
}
