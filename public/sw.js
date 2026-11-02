/* Generated at build time. Private APIs and auth are never cached here. */
const VERSION = "2.12.4";
const CACHE = `tripflow-shell-${VERSION}`;
const ASSETS = ["/_next/static/41i65gS7HQMtzjFua1gIV/_buildManifest.js","/_next/static/41i65gS7HQMtzjFua1gIV/_ssgManifest.js","/_next/static/chunks/185.966aa99e3eb6e3f0.js","/_next/static/chunks/193.81c7bc696be4e78f.js","/_next/static/chunks/300.925e1e41139bd450.js","/_next/static/chunks/352-16559d7d70a81eb6.js","/_next/static/chunks/367.aa0130ffff0b93b8.js","/_next/static/chunks/417.67c124db3a261683.js","/_next/static/chunks/55.06221e75dc945a8e.js","/_next/static/chunks/598.454325f7339586c5.js","/_next/static/chunks/794.64d498ed2d1fb38d.js","/_next/static/chunks/802-a24edf4cbf75c012.js","/_next/static/chunks/924.7e3164ae9db5337d.js","/_next/static/chunks/980.1a865df6bcaf879c.js","/_next/static/chunks/app/_global-error/page-dec521025aa02794.js","/_next/static/chunks/app/_not-found/page-c77d1d8c0f824595.js","/_next/static/chunks/app/api/admin/route-dec521025aa02794.js","/_next/static/chunks/app/api/bookings/route-dec521025aa02794.js","/_next/static/chunks/app/api/fund/route-dec521025aa02794.js","/_next/static/chunks/app/api/maps/resolve/route-dec521025aa02794.js","/_next/static/chunks/app/api/recovery/route-dec521025aa02794.js","/_next/static/chunks/app/api/release/route-dec521025aa02794.js","/_next/static/chunks/app/api/templates/route-dec521025aa02794.js","/_next/static/chunks/app/api/tripflow/route-dec521025aa02794.js","/_next/static/chunks/app/api/version/route-dec521025aa02794.js","/_next/static/chunks/app/auth/callback/route-dec521025aa02794.js","/_next/static/chunks/app/auth/confirm/route-dec521025aa02794.js","/_next/static/chunks/app/layout-a7c6afa8bd58d835.js","/_next/static/chunks/app/page-c0e942d7857f0745.js","/_next/static/chunks/bae33ecf-fc96777696c2782d.js","/_next/static/chunks/bc68732f-2fd02a002a630ece.js","/_next/static/chunks/framework-900f6e66d711c339.js","/_next/static/chunks/main-3dc1ffc2c66db01c.js","/_next/static/chunks/main-app-f73b18b1fa9daa37.js","/_next/static/chunks/next/dist/client/components/builtin/app-error-dec521025aa02794.js","/_next/static/chunks/next/dist/client/components/builtin/forbidden-dec521025aa02794.js","/_next/static/chunks/next/dist/client/components/builtin/global-error-8ec8df9888c4fdb5.js","/_next/static/chunks/next/dist/client/components/builtin/not-found-dec521025aa02794.js","/_next/static/chunks/next/dist/client/components/builtin/unauthorized-dec521025aa02794.js","/_next/static/chunks/polyfills-42372ed130431b0a.js","/_next/static/chunks/webpack-0010d37299965d4d.js","/_next/static/css/5f2f684fc6c6307f.css","/_next/static/css/74cbdbbba8748c89.css","/_next/static/css/7fb7598cd0e11261.css","/_next/static/css/8b238b12e7683f71.css","/_next/static/css/8b4d786fcda43170.css"];
const SHELL = ["/", "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png", ...ASSETS];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener("message", event => {
  if(event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if(event.data?.type === "GET_VERSION") event.ports[0]?.postMessage({version:VERSION});
});
self.addEventListener("activate", event => {
  // Keep the immediately previous shell for old tabs and their hashed lazy chunks.
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k.startsWith("tripflow-shell-") && k!==CACHE).slice(0,-1).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const req=event.request, url=new URL(req.url);
  if(req.method!=="GET"||url.origin!==self.location.origin||url.pathname.startsWith("/api/")||url.pathname.startsWith("/auth/"))return;
  if(req.mode==="navigate"){
    event.respondWith(fetch(new Request(req,{cache:"no-store"})).then(res=>{
      if(res.ok)event.waitUntil(caches.open(CACHE).then(cache=>cache.put("/",res.clone())));
      return res;
    }).catch(async()=> (await (await caches.open(CACHE)).match("/")) || Response.error()));return;
  }
  if(url.pathname.startsWith("/_next/static/")||url.pathname.startsWith("/icon")||url.pathname==="/manifest.webmanifest"){
    event.respondWith(caches.match(req).then(async cached=>{
      if(cached)return cached;
      const res=await fetch(req);if(res.ok)event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,res.clone())));return res;
    }));
  }
});
