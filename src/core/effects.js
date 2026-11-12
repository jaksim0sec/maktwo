import {hash} from '../util/math.js';
export class Effects{constructor(){this.particles=[]}burst(x,y,z,color,count=14){const seed=Math.floor((x+y+z)*137);for(let i=0;i<count;i++){const a=hash(i,seed,1)*Math.PI*2,s=1+hash(i,seed,2)*4;this.particles.push({x,y,z,vx:Math.cos(a)*s,vy:hash(i,seed,3)*5,vz:Math.sin(a)*s,life:.4+hash(i,seed,4)*.45,max:.85,color})}}
 tick(dt){for(const p of this.particles){p.life-=dt;p.vy-=14*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt}this.particles=this.particles.filter(p=>p.life>0);if(this.particles.length>500)this.particles.splice(0,this.particles.length-500)}
}
