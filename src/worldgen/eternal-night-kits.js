import {BLOCK as B} from '../core/blocks.js';
import {PARTS} from '../core/part-library.js';
import {hash} from '../util/math.js';

const groups={};
for(const part of PARTS)(groups[part.family]??=[]).push(part);
export const cityPart=(family,variant)=>groups[family][variant].id;

// Each row is a coordinated construction kit. A tower keeps one kit for a group of floors.
const palettes=[
  {floor:B.WET_TILE,body:B.CRACKED_CONCRETE,wall:3,column:3,window:1,partition:2,entrance:3,stairEntrance:3,staircase:2,door:4,balcony:2,sign:1,ventilation:3,interior:[4,0]},
  {floor:B.FLOOR_TILE,body:B.SHOP_BRICK,wall:2,column:0,window:0,partition:4,entrance:2,stairEntrance:2,staircase:0,door:0,balcony:0,sign:0,ventilation:0,interior:[0,1,3]},
  {floor:B.FLOOR_TILE,body:B.STAINED_PLASTER,wall:0,column:0,window:2,partition:1,entrance:0,stairEntrance:0,staircase:3,door:1,balcony:1,sign:4,ventilation:2,interior:[0,1,3]},
  {floor:B.WALL_TILE,body:B.LIMESTONE,wall:1,column:1,window:3,partition:3,entrance:1,stairEntrance:1,staircase:1,door:2,balcony:4,sign:3,ventilation:1,interior:[1,3,0]},
  {floor:B.MARBLE,body:B.MARBLE,wall:4,column:4,window:4,partition:3,entrance:4,stairEntrance:4,staircase:4,door:2,balcony:3,sign:2,ventilation:4,interior:[3,1,0]},
];

export function cityKits(building,seed,maxLuxury) {
  const tier=Math.min(4,Math.floor(building.luxury/maxLuxury*4.2));
  const origin=hash(Math.floor(building.x0),building.type,Math.floor(building.z0),seed);
  const choices=palettes.map((kit,index)=>({kit,score:Math.abs(index-tier)*.75+hash(building.id,index,building.type,seed)*1.8}));
  choices.sort((a,b)=>a.score-b.score);
  const main=choices[0].kit;
  return [origin<.33?choices[1].kit:main,main,choices[1].kit,choices[2].kit,origin>.5?main:choices[3].kit];
}

export function cityFloorKit(base,floor,limit) {
  const n=floor.luxury/limit;
  const index=floor.program==='workshops'?0:floor.program==='housing'?(n<.36?1:2):
    floor.program==='exchange'||floor.program==='court'?(n>.64?4:3):n>.51?3:1;
  const interior=palettes[index];
  return {...base,floor:interior.floor,partition:interior.partition,door:interior.door,
    staircase:interior.staircase,sign:interior.sign,interior:interior.interior};
}
