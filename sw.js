/* App-shell cache for offline play. This intentionally never caches remote resources. */
const CACHE_NAME='maktwo-shell-v1.3.1';
const APP_FILES=[
 './','./index.html','./style.css','./manifest.webmanifest',
 './icons/maktwo-192.png','./icons/maktwo-512.png',
 './src/client/game.js','./src/client/input.js','./src/client/gestures.js',
 './src/client/pwa.js','./src/client/picking.js','./src/client/textures.js','./src/client/camera.js','./src/client/hologram.js',
 './src/client/renderer.js','./src/client/mesher.js','./src/client/mesh.worker.js',
 './src/client/light.worker.js','./src/core/blocks.js','./src/core/chunk.js',
 './src/core/effects.js','./src/core/events.js','./src/core/lighting.js',
 './src/core/lightVolume.js','./src/core/mining.js','./src/core/physics.js',
 './src/core/scale.js','./src/core/door.js','./src/core/systems.js','./src/core/world.js',
 './src/entities/entities.js','./src/util/math.js','./src/worldgen/generators.js'
];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  await cache.addAll(APP_FILES.map(p=>new URL(p,self.registration.scope).href));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith('maktwo-shell-')&&name!==CACHE_NAME).map(name=>caches.delete(name)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_NAME);
  if(request.mode==='navigate'){
   try{const response=await fetch(request);if(response.ok)await cache.put(new URL('./index.html',self.registration.scope),response.clone());return response;}
   catch{return await cache.match(new URL('./index.html',self.registration.scope))||Response.error();}
  }
  // Network-first for source files prevents cached modules from different
  // versions from being combined into an invisible or frozen WebGL scene.
  // The app-shell cache remains the offline fallback.
  try{const response=await fetch(request);if(response.ok){await cache.put(request,response.clone());return response;}
      return await cache.match(request,{ignoreSearch:true})||response;}
  catch{return await cache.match(request,{ignoreSearch:true})||Response.error();}
 })());
});
