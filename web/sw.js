const CACHE='billet-form-v1'; const ASSETS=['.','./index.html','./form.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); self.skipWaiting();});
self.addEventListener('activate',e=>{self.clients.claim();});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(url.origin===location.origin){
    e.respondWith(
      caches.match(e.request).then(r=>r||fetch(e.request).then(x=>{
        const c=x.clone(); caches.open(CACHE).then(cc=>cc.put(e.request,c)); return x;
      }).catch(()=>caches.match('./index.html')))
    );
  }
});
