/* Generated at build time. Private APIs and auth are never cached here. */
const VERSION = "2.12.5";
const CACHE = `tripflow-shell-${VERSION}`;
const ASSETS = ["/_next/static/cZbeVdLb8y1J4EfV_ANBJ/_buildManifest.js","/_next/static/cZbeVdLb8y1J4EfV_ANBJ/_ssgManifest.js","/_next/static/chunks/205.ad3d12ef6af63bd0.js","/_next/static/chunks/210.98504cad7fddd0b8.js","/_next/static/chunks/221.eb32d33966c2bdff.js","/_next/static/chunks/236.7dd183028f17c8e7.js","/_next/static/chunks/247.2a460e1cd386f72a.js","/_next/static/chunks/272-0f4fc07882c35f51.js","/_next/static/chunks/3.3b08823713b1ba1b.js","/_next/static/chunks/418.e148416b7a49bac6.js","/_next/static/chunks/44530001-9e645d832c7c3cc5.js","/_next/static/chunks/4bd1b696-92152b0f5947070d.js","/_next/static/chunks/548.72c7243ec668ade7.js","/_next/static/chunks/791.04c4e62ee90a7f88.js","/_next/static/chunks/794-a3c6349e754e6fcd.js","/_next/static/chunks/948.f91d92b3f6c1a0a5.js","/_next/static/chunks/app/_global-error/page-14941ac9310f9590.js","/_next/static/chunks/app/_not-found/page-c6d9fe14de99bebf.js","/_next/static/chunks/app/api/admin/route-14941ac9310f9590.js","/_next/static/chunks/app/api/bookings/route-14941ac9310f9590.js","/_next/static/chunks/app/api/fund/route-14941ac9310f9590.js","/_next/static/chunks/app/api/maps/resolve/route-14941ac9310f9590.js","/_next/static/chunks/app/api/recovery/route-14941ac9310f9590.js","/_next/static/chunks/app/api/release/route-14941ac9310f9590.js","/_next/static/chunks/app/api/templates/route-14941ac9310f9590.js","/_next/static/chunks/app/api/tripflow/route-14941ac9310f9590.js","/_next/static/chunks/app/api/version/route-14941ac9310f9590.js","/_next/static/chunks/app/auth/callback/route-14941ac9310f9590.js","/_next/static/chunks/app/auth/confirm/route-14941ac9310f9590.js","/_next/static/chunks/app/layout-893e60c4ad109dee.js","/_next/static/chunks/app/page-74caaab06944c477.js","/_next/static/chunks/framework-0f597d6e68ffafed.js","/_next/static/chunks/main-3b98c594b659c3da.js","/_next/static/chunks/main-app-f9435d1175b16050.js","/_next/static/chunks/next/dist/client/components/builtin/app-error-14941ac9310f9590.js","/_next/static/chunks/next/dist/client/components/builtin/forbidden-14941ac9310f9590.js","/_next/static/chunks/next/dist/client/components/builtin/global-error-4992d629ed554926.js","/_next/static/chunks/next/dist/client/components/builtin/not-found-14941ac9310f9590.js","/_next/static/chunks/next/dist/client/components/builtin/unauthorized-14941ac9310f9590.js","/_next/static/chunks/polyfills-42372ed130431b0a.js","/_next/static/chunks/webpack-4ef986d6a2e9d5a0.js","/_next/static/css/5f2f684fc6c6307f.css","/_next/static/css/74cbdbbba8748c89.css","/_next/static/css/b0417b6efb839c78.css","/_next/static/css/be5e053814584d5f.css","/_next/static/css/d8d3155c16e06dcb.css"];
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
