/* Riwaaz-e-Kashmir push service worker (Phase 11). Copied unchanged into /food/, /rider/ and /control/; each copy only controls its own folder.
   It shows every push it receives (browsers and iOS require that) and opens/focuses the app when a notification is tapped. It caches nothing and never touches the network. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',e=>{
  let d={};try{d=e.data?e.data.json():{}}catch(_){try{d={b:e.data.text()}}catch(__){d={}}}
  const title=String(d.t||'Riwaaz-e-Kashmir').slice(0,80),opt={body:String(d.b||'').slice(0,240),data:{u:String(d.u||'/'),id:String(d.id||'')},icon:'icon-192.png',badge:'icon-192.png'};
  if(d.tag){opt.tag=String(d.tag).slice(0,60);opt.renotify=true}
  e.waitUntil(self.registration.showNotification(title,opt));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  let u=(e.notification.data&&e.notification.data.u)||'/';if(!/^\/[^\/]/.test(u)&&u!=='/')u='/';
  e.waitUntil((async()=>{
    const all=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const c of all){if(new URL(c.url).origin===self.location.origin){try{await c.focus();c.postMessage({type:'rkn-open',u});return}catch(_){}}}
    await self.clients.openWindow(u);
  })());
});
