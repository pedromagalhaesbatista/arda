"use strict";

const Shire = (() => {
  function create() {
    const map = { version: 1, name: "The Shire", width: 57, height: 39, adventure: "shire", floors: [] };
    const surface = World.makeFloor(map, 0, "Hobbiton & Bywater", "grass");
    const bagEnd = World.makeFloor(map, -1, "Bag End", "void");
    const storehouse = World.makeFloor(map, -2, "Mill Storehouse", "void");
    const inn = World.makeFloor(map, -3, "The Green Dragon", "void");
    map.floors.push(surface, bagEnd, storehouse, inn);

    const ground = (floor, x, y, tile) => { floor.ground[World.index(map, x, y)] = tile; };
    const object = (floor, x, y, type) => { floor.objects[World.key(x, y)] = type; };
    const marker = (floor, x, y, type, fields = {}) => { floor.markers[World.key(x, y)] = { type, ...fields }; };
    const rect = (floor, x1, y1, x2, y2, tile) => {
      for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) ground(floor, x, y, tile);
    };

    function track(x1, y1, x2, y2) {
      const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
      for (let step = 0; step <= steps; step++) {
        const x = Math.round(x1 + (x2 - x1) * step / steps);
        const y = Math.round(y1 + (y2 - y1) * step / steps);
        rect(surface, x, y, x + 1, y + 1, "path");
      }
    }

    function connect(from, x, y, to, tx, ty) {
      marker(from, x, y, "link", { x: tx, y: ty, z: to.z });
      marker(to, tx, ty, "link", { x, y, z: from.z });
    }

    function room(floor, x1, y1, x2, y2, material) {
      rect(floor, x1, y1, x2, y2, material);
      for (let x = x1; x <= x2; x++) {
        object(floor, x, y1, "timber");
        object(floor, x, y2, "timber");
      }
      for (let y = y1 + 1; y < y2; y++) {
        object(floor, x1, y, "sideTimber");
        object(floor, x2, y, "sideTimber");
      }
    }

    function house(x1, x2, y, door) {
      rect(surface, x1, y - 2, x2, y + 2, "stone");
      for (let x = x1; x <= x2; x++) {
        object(surface, x, y - 2, "roof");
        object(surface, x, y - 1, "roof");
        object(surface, x, y, x === door ? "door" : "timber");
      }
    }

    function hillDoor(x, y) {
      for (let dy = -4; dy <= 0; dy++) {
        const width = dy === -4 ? 1 : dy === -3 ? 2 : 3;
        for (let dx = -width; dx <= width; dx++) ground(surface, x + dx, y + dy, "meadow");
      }
      object(surface, x, y, "smial");
      for (const offset of [-2, 2]) object(surface, x + offset, y, "flowers");
    }

    track(4, 18, 17, 18);
    track(17, 18, 26, 17);
    track(26, 17, 34, 19);
    track(34, 19, 51, 19);
    track(22, 12, 22, 18);
    track(12, 13, 13, 18);
    track(29, 12, 28, 18);
    track(26, 18, 26, 32);
    track(26, 32, 51, 32);

    for (let x = 0; x < map.width; x++) {
      const river = 23 + Math.round(2 * Math.sin((x - 5) / 9));
      const depth = x >= 37 && x <= 50 ? 6 + Math.round(2 * Math.sin((x - 37) / 4)) : 3;
      for (let y = river; y < river + depth; y++) {
        ground(surface, x, y, x >= 26 && x <= 28 ? "bridge" : "water");
      }
    }

    for (const [x, y] of [[13, 13], [23, 12], [30, 12], [11, 29], [38, 30]]) hillDoor(x, y);
    house(32, 38, 18, 35);
    house(42, 48, 30, 45);
    object(surface, 37, 21, "millWheel");
    object(surface, 36, 19, "barrel");
    object(surface, 44, 31, "barrel");
    object(surface, 47, 31, "lamp");
    object(surface, 16, 16, "tree");
    object(surface, 20, 10, "tree");
    object(surface, 25, 9, "tree");
    object(surface, 21, 12, "lamp");
    object(surface, 25, 13, "flowers");

    rect(surface, 17, 12, 19, 15, "soil");
    rect(surface, 18, 12, 18, 15, "crop");
    rect(surface, 27, 13, 31, 15, "soil");
    rect(surface, 27, 14, 31, 14, "crop");
    rect(surface, 33, 30, 36, 31, "crop");
    rect(surface, 13, 32, 20, 35, "soil");
    for (let x = 13; x <= 20; x++) {
      for (const y of [32, 34]) ground(surface, x, y, "crop");
      object(surface, x, 35, "fence");
    }

    for (let y = 1; y < map.height - 1; y++) {
      for (let x = 1; x < map.width - 1; x++) {
        const key = World.key(x, y);
        if (surface.objects[key] || surface.ground[World.index(map, x, y)] !== "grass") continue;
        const roll = ((Math.imul(x + 13, 73856093) ^ Math.imul(y + 97, 19349663)) >>> 0) % 101;
        const outskirts = x < 8 || x > 50 || y < 7 || y > 35;
        if (roll < (outskirts ? 22 : 3)) object(surface, x, y, "tree");
        else if (roll < (outskirts ? 36 : 10)) object(surface, x, y, "shrub");
        else if (roll > 91) object(surface, x, y, "flowers");
      }
    }

    room(bagEnd, 18, 6, 28, 13, "wood");
    object(bagEnd, 20, 8, "bed");
    object(bagEnd, 25, 9, "table");
    object(bagEnd, 19, 11, "lamp");
    room(storehouse, 30, 13, 41, 23, "wood");
    for (const [x, y] of [[31, 14], [31, 17], [39, 16], [39, 17], [39, 20]]) object(storehouse, x, y, "barrel");
    object(storehouse, 32, 18, "lamp");
    object(storehouse, 40, 21, "chest");
    room(inn, 40, 23, 50, 31, "wood");
    for (const [x, y] of [[43, 25], [47, 25], [43, 28], [48, 28]]) object(inn, x, y, "table");
    object(inn, 41, 25, "barrel");

    marker(surface, 23, 17, "start");
    marker(surface, 21, 15, "gardener");
    marker(surface, 34, 20, "miller");
    marker(storehouse, 35, 17, "rat");
    marker(storehouse, 37, 20, "rat");
    marker(storehouse, 39, 21, "ledger");
    marker(surface, 52, 8, "wolf");
    connect(surface, 23, 12, bagEnd, 23, 12);
    connect(surface, 35, 18, storehouse, 35, 14);
    connect(surface, 45, 30, inn, 45, 30);

    const notices = [
      [25, 14, "Bag End · The Hill"], [17, 17, "The Party Field"],
      [31, 13, "Bagshot Row · Hobbiton"], [27, 21, "Hobbiton Bridge · The Water"],
      [33, 19, "Hobbiton Mill · Storehouse through the mill door"],
      [40, 32, "Bywater · The Green Dragon east along the lane"],
      [46, 31, "The Green Dragon · Bywater"],
    ];
    for (const [x, y, text] of notices) {
      delete surface.objects[World.key(x, y)];
      marker(surface, x, y, "notice", { text });
    }
    for (const [x, y] of [[21, 15], [34, 20], [52, 8]]) delete surface.objects[World.key(x, y)];
    return World.validate(map);
  }

  return { create };
})();
