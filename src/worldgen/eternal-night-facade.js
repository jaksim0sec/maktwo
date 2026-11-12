/** Decide facade functions from the room programme rather than distributing
 * windows and props randomly over every face of a high-rise.
 */
export function facadeBay({program,level,entryLevel,edge,bay,frontEdge=0,stride=5}){
 const front=edge===frontEdge,retail=program==='shops'||program==='market';
 const street=retail&&level<=entryLevel+1&&front;
 const service=program==='workshops';
 const perimeter=front||edge===4;
 let opening='wall';
 if(street&&(bay===1||bay===2))opening='shopfront';
 else if(program==='housing'&&front&&bay===2)opening='window';
 else if(service&&perimeter&&bay===2&&level%2===0)opening='window';
 else if((program==='court'||program==='exchange')&&perimeter&&bay===2&&level%3===0)opening='window';
 else if(retail&&!street&&front&&bay===2&&level%2===0)opening='window';
 return {opening,vent:service&&!front&&bay===3&&level%4===2,sign:street&&bay===3,front,street};
}

/** A connecting corridor is a passage, not a row of glass-front offices. */
export function enclosedPassageBay(bay){
 const window=bay===2||bay===3;
 return {window,wall:!window,vent:bay===5,sign:false};
}
