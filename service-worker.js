const CACHE='peak-performance-v43';
const STATIC_ASSETS=['./manifest.webmanifest','./icon-192.png','./icon-512.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC_ASSETS)));
});
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'||url.pathname.endsWith('/index.html')){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
      const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));return response;
    }).catch(()=>caches.match('./index.html').then(r=>r||caches.match('./'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>{
    const network=fetch(event.request).then(response=>{
      if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}
      return response;
    }).catch(()=>cached);
    return cached||network;
  }));
});
self.addEventListener('push',event=>{
  let data={};try{data=event.data?event.data.json():{}}catch(_){data={title:'Peak Performance Gym Co.',body:event.data?.text()||'You have a new notification.'}}
  event.waitUntil(self.registration.showNotification(data.title||'Peak Performance Gym Co.',{
    body:data.body||'You have a new notification.',icon:data.icon||'./icon-192.png',badge:data.badge||'./icon-192.png',
    data:{url:data.url||'./',type:data.type||'general'},tag:data.type?('peak-'+data.type):undefined,renotify:true
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();const target=new URL(event.notification.data?.url||'./',self.location.origin).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const client of list){if('focus' in client){client.navigate(target);return client.focus()}}
    return clients.openWindow?clients.openWindow(target):undefined;
  }));
});
