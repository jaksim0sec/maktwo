// Landscape is declared in the manifest for installed PWAs. The Screen
// Orientation API can only lock in allowed contexts (typically installed or
// fullscreen), so unsupported browsers get a portrait-blocking CSS prompt.
let registeredOrientation=false;
export function configureLandscape(){
 if(registeredOrientation||typeof window==='undefined')return;
 registeredOrientation=true;
 let lastAttempt=0;
 const attempt=()=>{
  const standalone=window.matchMedia?.('(display-mode: standalone)').matches||Boolean(navigator.standalone);
  const full=Boolean(document.fullscreenElement);
  if(!standalone&&!full)return;
  if(!screen.orientation?.lock)return;
  if(Date.now()-lastAttempt<2000)return;
  lastAttempt=Date.now();
  try{Promise.resolve(screen.orientation.lock('landscape')).catch(()=>{});}catch{}
 };
 window.addEventListener('pageshow',attempt);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)attempt()});
 document.addEventListener('fullscreenchange',attempt);
 window.addEventListener('pointerdown',attempt,{passive:true});
 attempt();
}
export function registerPWA(){
 configureLandscape();
 if(!('serviceWorker' in navigator))return;
 const url=new URL('../../sw.js',import.meta.url);
 const wasControlled=Boolean(navigator.serviceWorker.controller);let reloaded=false;
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(wasControlled&&!reloaded&&!window.__maktwoReloading){reloaded=true;window.__maktwoReloading=true;window.location.reload()}
 });
 navigator.serviceWorker.register(url.href,{scope:new URL('../../',import.meta.url).pathname,updateViaCache:'none'})
  .then(registration=>registration.update().catch(error=>console.warn('[MakTwo] SW update check failed:',error)))
  .catch(error=>console.warn('[MakTwo] Offline service worker unavailable:',error));
}
