import {chromium} from 'playwright-core';
import {PNG} from 'pngjs';
import fs from 'node:fs';
const args=['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-dev-shm-usage','--disable-software-rasterizer=false'];
const executablePath=process.env.CHROME_BIN||'/usr/bin/google-chrome';
const browser=await chromium.launch({executablePath,headless:true,args});
const page=await browser.newPage({viewport:{width:780,height:360},deviceScaleFactor:1,serviceWorkers:'block'});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
 await page.goto('http://127.0.0.1:8080/?world=EternalNightCanyonV2',{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>window.__auditGame?.entities?.observers,{timeout:45000});
 const info=await page.evaluate(async()=>{
  const g=window.__auditGame,world=g.world,p=g.player;
  g.scheduleFrame=()=>{};
  p.x=124;p.y=410;p.z=49;p.yaw=-Math.PI/2;p.pitch=0;
  world.stream(p.x,p.z,3,50);
  const {ObserverPack}=await import('/src/entities/observers.js');
  const pack=new ObserverPack(world);g.entities.observers=pack;
  const viewport={aspect:780/360,tan:Math.tan(65*Math.PI/360)};
  let target=null;
  for(let f=0;f<1250;f++){
   p.yaw+=.18*(Math.PI*2/42);
   pack.tick(.18,p,48,viewport);
   for(const v of pack.views){
    const point=pack.screenPoint(p,v);
    if(!point||!pack.onScreen(p,v))continue;
    const pixelHeight=2.36*360/(2*viewport.tan*point.depth);
    if(pixelHeight>=60&&pack.faceVisible(p,v)){
      target={time:f*.18,x:point.x,y:point.y,depth:point.depth,pixelHeight,actorId:v.id};
      break;
    }
   }
   if(target)break;
  }
  if(!target)return {error:'no frontal observer >= 60px in 225 seconds'};
  pack.tick=()=>{};
  g.effects.particles=[];
  return {target,mode:world.mode,actorCount:pack.views.length,devicePixelRatio,
    actorShaderLoaded:g.renderer.observerRenderer.ready,sceneChunks:world.chunks.size};
 });
 console.log('BROWSER_SETUP '+JSON.stringify(info));
 if(info.error)throw Error(info.error);
 await page.waitForTimeout(3000);
 // Draw the exact same stationary world twice with and without the observer.
 const draw=()=>page.evaluate(()=>{
  const g=window.__auditGame;
  g.renderer.sync(g.world,g.player);
  g.renderer.frame(g.world,g.player,g.entities.entities,g.effects,1/60,null,g.entities.observers);
  return {ready:g.renderer.observerRenderer.ready,drawCalls:g.renderer.lastDrawCalls};
 });
 let loaded=false;for(let n=0;n<20;n++){const state=await draw();if(state.ready){loaded=true;break}await page.waitForTimeout(350)}
 if(!loaded)throw Error('actual observer mesh failed to load');
 const withActor=await draw();
 const present=await page.screenshot({path:'/tmp/observer-standing.png',animations:'disabled'});
 const afterDeath=await page.evaluate((id)=>{
  const g=window.__auditGame,pack=g.entities.observers;
  for(let n=0;n<3;n++)pack.damage(id,'body',g.player);
  pack.clock+=1.8;pack.publish(g.player,48);
  const member=pack.active.members.get(id);
  return {dead:member?.dead,age:pack.clock-member?.hitAt,drawCount:pack.views.length};
 },info.target.actorId);
 if(!afterDeath.dead)throw Error('hit did not kill target for visual audit');
 await draw();
 const fallen=await page.screenshot({path:'/tmp/observer-fallen.png',animations:'disabled'});
 console.log('OBSERVER_DEATH_SETUP '+JSON.stringify(afterDeath));
 const gState=await page.evaluate(()=>{
  const g=window.__auditGame,pack=g.entities.observers;
  window.__savedObserverViews=pack.views;pack.views=[];
  g.renderer.frame(g.world,g.player,g.entities.entities,g.effects,1/60,null,pack);
  return {rendered:g.renderer.lastDrawCalls};
 });
 const absent=await page.screenshot({path:'/tmp/observer-absent.png',animations:'disabled'});
 const A=PNG.sync.read(present),B=PNG.sync.read(absent),C=PNG.sync.read(fallen);
 let changed=0,sumDiff=0,maxDiff=0,largeDiff=0;
 let deadChanged=0,deadLarge=0;const deadBox={minX:10000,minY:10000,maxX:0,maxY:0},standingBox={minX:10000,minY:10000,maxX:0,maxY:0};
 const px=(info.target.x+1)*A.width/2,py=(1-info.target.y)*A.height/2;
 const half=Math.max(110,info.target.pixelHeight*1.8);
 const x0=Math.max(0,Math.floor(px-half)),x1=Math.min(A.width,Math.ceil(px+half));
 const y0=Math.max(0,Math.floor(py-half)),y1=Math.min(A.height,Math.ceil(py+half));
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
  const k=(y*A.width+x)*4;
  const delta=Math.max(...[0,1,2].map(c=>Math.abs(A.data[k+c]-B.data[k+c])));
  const corpseDelta=Math.max(...[0,1,2].map(c=>Math.abs(C.data[k+c]-B.data[k+c])));
  sumDiff+=delta;if(delta>12){changed++;standingBox.minX=Math.min(standingBox.minX,x);standingBox.minY=Math.min(standingBox.minY,y);standingBox.maxX=Math.max(standingBox.maxX,x);standingBox.maxY=Math.max(standingBox.maxY,y)}
  if(delta>40)largeDiff++;maxDiff=Math.max(maxDiff,delta);
  if(corpseDelta>12){deadChanged++;deadBox.minX=Math.min(deadBox.minX,x);deadBox.minY=Math.min(deadBox.minY,y);deadBox.maxX=Math.max(deadBox.maxX,x);deadBox.maxY=Math.max(deadBox.maxY,y)}
  if(corpseDelta>40)deadLarge++;
 }
 console.log('OBSERVER_RENDER_VISIBILITY '+JSON.stringify({info,withActor,gState,errors,
  rect:{x0,y0,x1,y1},changedPixelsOver12:changed,changedPixelsOver40:largeDiff,
  maxChannelDelta:maxDiff,averageChannelDelta:+(sumDiff/((x1-x0)*(y1-y0))).toFixed(2),
  screenshots:['observer-standing.png','observer-fallen.png','observer-absent.png'],corpse:{changedPixels:deadChanged,largePixels:deadLarge,box:deadBox},standingBox}));
 if(changed<15)throw Error('Standing observer not visible');
 if(deadChanged<15)throw Error('Fallen observer disappeared from world-space renderer');
 if(deadBox.minY>deadBox.maxY||standingBox.minY>standingBox.maxY)throw Error('Missing silhouette bounds');
 const standingHeight=standingBox.maxY-standingBox.minY,corpseHeight=deadBox.maxY-deadBox.minY;
 console.log('OBSERVER_DEATH_VISUAL '+JSON.stringify({standingHeightPx:standingHeight,corpseHeightPx:corpseHeight,
  standingPixels:changed,corpsePixels:deadChanged,corpseLongerLivedAtSeconds:120}));
 if(corpseHeight>standingHeight*.57)throw Error('Collapse did not lower apparent silhouette height by at least 43%');
}finally{await browser.close()}
