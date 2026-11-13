"use strict";

const root = new URL("./", self.location.href);
const cachePrefix = `arda:${root.pathname}:`;
const cacheName = `${cachePrefix}8`;
const files = [
  "index.html",
  "style.css",
  "opentibia/runtime.js",
  "opentibia/assets/sprites.js",
  "world.js",
  "shire.js",
  "art.js",
  "vocations.js",
  "equipment.js",
  "magic.js",
  "saves.js",
  "game.js",
  "layout.js",
  "opentibia/ui/back.png",
  "opentibia/ui/battle.png",
  "opentibia/ui/body.png",
  "opentibia/ui/chasemode.png",
  "opentibia/ui/cross.png",
  "opentibia/ui/feet.png",
  "opentibia/ui/fightbalanced.png",
  "opentibia/ui/fightdefensive.png",
  "opentibia/ui/fightoffensive.png",
  "opentibia/ui/finger.png",
  "opentibia/ui/floor_down.png",
  "opentibia/ui/floor_up.png",
  "opentibia/ui/head.png",
  "opentibia/ui/healthinfo.png",
  "opentibia/ui/inventory.png",
  "opentibia/ui/item.png",
  "opentibia/ui/left-hand.png",
  "opentibia/ui/legs.png",
  "opentibia/ui/minimap.png",
  "opentibia/ui/miniwindow.png",
  "opentibia/ui/miniwindow_buttons.png",
  "opentibia/ui/neck.png",
  "opentibia/ui/panel_content.png",
  "opentibia/ui/panel_side.png",
  "opentibia/ui/questlog.png",
  "opentibia/ui/right-hand.png",
  "opentibia/ui/skills.png",
  "opentibia/ui/zoom_in.png",
  "opentibia/ui/zoom_out.png",
];
const assets = new Set(files.map(file => new URL(file, root).href));
const home = new URL("index.html", root).href;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([...assets].map(url => new Request(url, { cache: "reload" })));
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(cachePrefix) && name !== cacheName).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isHome = event.request.mode === "navigate" && url.origin === root.origin &&
    (url.pathname === root.pathname || url.pathname === new URL(home).pathname);
  const key = isHome ? home : url.href;
  if (!assets.has(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return await cache.match(key) ?? fetch(event.request);
  })());
});
