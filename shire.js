"use strict";

const Shire = (() => {
  function create() {
    const map = { version: 1, name: "The Shire", width: 65, height: 42, adventure: "shire", floors: [] };
    const surface = World.makeFloor(map, 0, "Hobbiton & Bywater", "grass");
    const bagEnd = World.makeFloor(map, -1, "Bag End", "void");
    const storehouse = World.makeFloor(map, -2, "Mill Storehouse", "void");
    const inn = World.makeFloor(map, -3, "The Green Dragon", "void");
    const cottage = World.makeFloor(map, -4, "Bagshot Row Cottage", "void");
    map.floors.push(surface, bagEnd, storehouse, inn, cottage);

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
        for (let dx = -width; dx <= width; dx++) {
          const tx = x + dx;
          const ty = y + dy;
          if (surface.ground[World.index(map, tx, ty)] === "grass") ground(surface, tx, ty, "meadow");
        }
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
    track(26, 32, 58, 32);
    track(8, 11, 9, 18);
    track(9, 18, 9, 31);
    track(9, 31, 17, 29);
    track(17, 29, 26, 32);
    track(34, 19, 55, 19);
    track(55, 19, 55, 28);
    track(55, 28, 58, 32);
    track(42, 32, 41, 29);

    for (let x = 0; x < map.width; x++) {
      const river = 23 + Math.round(2 * Math.sin((x - 5) / 9));
      const pool = Math.max(0, 1 - ((x - 44) / 11) ** 2);
      const depth = 3 + Math.round(5 * Math.sqrt(pool));
      const crossing = (x >= 9 && x <= 10) || (x >= 26 && x <= 28) || (x >= 55 && x <= 56);
      for (let y = river; y < river + depth; y++) ground(surface, x, y, crossing ? "bridge" : "river");
    }
    for (const [x, y] of [[13, 13], [23, 12], [30, 12], [11, 29], [38, 30], [53, 30], [60, 29]]) hillDoor(x, y);
    rect(surface, 40, 27, 41, 30, "bridge");
    rect(surface, 40, 31, 41, 31, "stone");
    house(32, 38, 18, 35);
    house(42, 48, 30, 45);
    object(surface, 37, 21, "millWheel");
    object(surface, 36, 19, "barrel");
    object(surface, 44, 31, "barrel");
    object(surface, 47, 31, "lamp");
    object(surface, 16, 15, "partyTree");
    object(surface, 14, 16, "table");
    object(surface, 14, 17, "bench");
    object(surface, 16, 17, "bunting");
    object(surface, 15, 14, "flowers");
    object(surface, 18, 16, "flowers");
    object(surface, 42, 31, "bench");
    object(surface, 43, 33, "basket");
    object(surface, 46, 33, "table");
    object(surface, 48, 33, "bench");
    object(surface, 48, 31, "flowers");
    object(surface, 40, 29, "bench");
    object(surface, 40, 27, "basket");
    for (const [x, y] of [[6, 12], [6, 15], [11, 11], [11, 16], [12, 20], [13, 31], [16, 31], [19, 30]]) {
      object(surface, x, y, "appleTree");
    }
    for (const [x, y] of [[7, 21], [12, 22], [18, 23], [31, 23], [36, 22], [39, 22], [43, 27], [48, 27], [50, 28], [53, 26], [57, 23]]) {
      object(surface, x, y, "reeds");
    }
    for (const [x, y] of [[11, 14], [11, 15], [19, 12], [20, 12], [25, 16], [26, 16], [32, 12], [33, 12], [49, 31], [50, 31], [51, 31]]) {
      object(surface, x, y, "hedge");
    }
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
        const outskirts = x < 5 || x > 61 || y < 7 || y > 36;
        if (roll < (outskirts ? 22 : 3)) object(surface, x, y, "tree");
        else if (roll < (outskirts ? 36 : 10)) object(surface, x, y, "shrub");
        else if (roll > 91) object(surface, x, y, "flowers");
      }
    }

    room(bagEnd, 17, 5, 29, 13, "wood");
    for (const y of [6, 7, 8, 11, 12]) object(bagEnd, 21, y, "sideTimber");
    for (const y of [6, 7, 8, 9, 12]) object(bagEnd, 26, y, "sideTimber");
    object(bagEnd, 19, 7, "bed");
    object(bagEnd, 18, 8, "chest");
    object(bagEnd, 23, 7, "hearth");
    object(bagEnd, 24, 9, "table");
    object(bagEnd, 22, 9, "bench");
    object(bagEnd, 23, 10, "rug");
    object(bagEnd, 23, 11, "rug");
    object(bagEnd, 27, 7, "table");
    object(bagEnd, 28, 8, "barrel");
    object(bagEnd, 28, 9, "basket");
    object(bagEnd, 18, 11, "lamp");
    room(cottage, 25, 6, 35, 13, "wood");
    object(cottage, 27, 8, "bed");
    object(cottage, 30, 8, "hearth");
    object(cottage, 32, 9, "table");
    object(cottage, 33, 9, "bench");
    object(cottage, 30, 11, "rug");
    room(storehouse, 30, 13, 41, 23, "wood");
    for (const [x, y] of [[31, 14], [31, 17], [39, 16], [39, 17], [39, 20]]) object(storehouse, x, y, "barrel");
    object(storehouse, 32, 18, "lamp");
    object(storehouse, 40, 21, "chest");
    room(inn, 40, 23, 50, 31, "wood");
    for (const [x, y] of [[43, 25], [47, 25], [43, 28], [48, 28]]) object(inn, x, y, "table");
    object(inn, 41, 25, "barrel");
    object(inn, 45, 24, "hearth");
    object(inn, 45, 27, "rug");
    object(inn, 45, 28, "rug");
    object(inn, 49, 25, "basket");

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
    connect(surface, 30, 12, cottage, 30, 12);

    const notices = [
      [25, 14, "Bag End · The green door opens into the hall of Bag End."],
      [17, 17, "Party Field · The great tree stands above the tables on The Hill."],
      [31, 13, "Bagshot Row · A row of homes cut into the hillside below Bag End."],
      [8, 12, "Hobbiton Orchard · Follow the lane south to the orchard footbridge."],
      [10, 28, "Orchard Footbridge · The south-bank path joins the road to Bywater."],
      [27, 21, "Hobbiton Bridge · Cross The Water to the road for Bywater."],
      [33, 19, "Hobbiton Mill · The mill door leads down to the storehouse."],
      [40, 32, "Bywater · The Green Dragon is just east along the lane."],
      [41, 31, "Bywater Pool · The landing looks out across the quiet water."],
      [46, 31, "The Green Dragon · The inn’s front door is one step northwest."],
      [56, 27, "East Footbridge · Cross to the north-bank lane and the mill."],
    ];
    for (const [x, y, text] of notices) {
      delete surface.objects[World.key(x, y)];
      marker(surface, x, y, "notice", { text });
    }
    for (const [x, y] of [[21, 15], [34, 20], [52, 8]]) delete surface.objects[World.key(x, y)];

    track(51, 32, 55, 34);
    track(55, 34, 59, 36);
    track(59, 36, 62, 38);
    for (const [x, y, type, fields] of [
      [47, 32, "merchant"],
      [47, 33, "notice", { text: "Bywater Outfitter · Buy supplies and sell your hunting loot beside the Green Dragon." }],
      [54, 33, "notice", { text: "Bywater Hunting Trail · Follow the path east for bank rats and marsh wolves. Leave the trail to let the creatures return." }],
      [56, 35, "bankRat"], [59, 38, "bankRat"], [63, 39, "marshWolf"],
    ]) {
      delete surface.objects[World.key(x, y)];
      marker(surface, x, y, type, fields);
    }
    return World.validate(map);
  }

  return { create, previousRevisions: ["b902d48dab786345", "e6258651b64f76aa"] };
})();
