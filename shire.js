"use strict";

const Shire = (() => {
  const offset = { x: 24, y: 37 };
  const previousRevisions = ["a68195270fd424c9", "b902d48dab786345", "e6258651b64f76aa"];

  function moveOldSave(progress) {
    if (!progress?.creatures || !Array.isArray(progress.loot)) return progress;
    const move = point => point?.z === 0 ? { ...point, x: point.x + offset.x, y: point.y + offset.y } : point;
    const creatures = Object.fromEntries(Object.entries(progress.creatures).map(([id, point]) => {
      const shifted = id.replace(/^0:(\d+),(\d+):/, (_, x, y) => `0:${Number(x) + offset.x},${Number(y) + offset.y}:`);
      return [shifted, move(point)];
    }));
    return { ...progress, creatures, player: move(progress.player), loot: progress.loot.map(move) };
  }

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
    return expand(map);
  }

  function expand(core) {
    const map = { ...core, width: 128, height: 100, floors: [] };
    const surface = World.makeFloor(map, 0, core.floors[0].name, "grass");
    map.floors.push(surface);
    const set = (x, y, tile, floor = surface) => { floor.ground[World.index(map, x, y)] = tile; };
    const get = (x, y) => surface.ground[World.index(map, x, y)];
    const objects = surface.objects;
    const key = World.key;
    const place = (x, y, type) => { objects[key(x, y)] = type; };
    const mark = (x, y, type, fields) => { surface.markers[key(x, y)] = { type, ...fields }; };
    const noise = (x, y) => ((Math.imul(x + 13, 73856093) ^ Math.imul(y + 97, 19349663)) >>> 0) % 101;
    const water = tile => tile === "water" || tile === "river";

    function patch(cx, cy, rx, ry, paint) {
      for (let y = Math.max(0, cy - ry); y <= Math.min(map.height - 1, cy + ry); y++) {
        for (let x = Math.max(0, cx - rx); x <= Math.min(map.width - 1, cx + rx); x++) {
          const radius = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
          if (radius <= 0.88 + noise(x, y) / 400) paint(x, y);
        }
      }
    }

    function line(points, paint) {
      for (let i = 1; i < points.length; i++) {
        const [x1, y1] = points[i - 1];
        const [x2, y2] = points[i];
        const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
        for (let step = 0; step <= steps; step++) {
          paint(Math.round(x1 + (x2 - x1) * step / steps), Math.round(y1 + (y2 - y1) * step / steps));
        }
      }
    }

    for (const [x, y, rx, ry] of [[18, 15, 23, 20], [42, 12, 15, 22], [60, 34, 15, 13], [69, 92, 21, 10], [96, 89, 15, 12], [126, 89, 13, 24]]) {
      patch(x, y, rx, ry, (px, py) => {
        set(px, py, "meadow");
        const roll = noise(px, py);
        if (roll < 21) place(px, py, y < 22 ? "pine" : "tree");
        else if (roll < 30) place(px, py, "shrub");
        else if (roll > 95) place(px, py, "rock");
      });
    }
    for (const floor of core.floors) {
      const destination = floor.z === 0 ? surface : World.makeFloor(map, floor.z, floor.name, "void");
      if (floor.z !== 0) map.floors.push(destination);
      const dx = floor.z === 0 ? offset.x : 0;
      const dy = floor.z === 0 ? offset.y : 0;
      for (let y = 0; y < core.height; y++) for (let x = 0; x < core.width; x++) {
        set(x + dx, y + dy, floor.ground[World.index(core, x, y)], destination);
        if (floor.z === 0) delete objects[key(x + dx, y + dy)];
      }
      for (const [pos, type] of Object.entries(floor.objects)) {
        const [x, y] = pos.split(",").map(Number);
        destination.objects[key(x + dx, y + dy)] = type;
      }
      for (const [pos, original] of Object.entries(floor.markers)) {
        const [x, y] = pos.split(",").map(Number);
        const marker = { ...original };
        if (marker.type === "link" && marker.z === 0) {
          marker.x += offset.x;
          marker.y += offset.y;
        }
        destination.markers[key(x + dx, y + dy)] = marker;
      }
    }

    function channel(points, width) {
      line(points, (x, y) => {
        for (let dy = -width; dy <= width; dy++) for (let dx = -width; dx <= width; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > width || !World.inside(map, x + dx, y + dy)) continue;
          set(x + dx, y + dy, "river");
          delete objects[key(x + dx, y + dy)];
        }
      });
    }
    channel([[18, 21], [21, 29], [17, 37], [22, 44], [25, 49], [23, 54], [24, 60]], 1);
    patch(29, 52, 9, 7, (x, y) => {
      if (get(x, y) !== "grass" || objects[key(x, y)]) return;
      const roll = noise(x, y);
      set(x, y, roll < 24 ? "soil" : "meadow");
      if (roll < 40) place(x, y, "reeds");
    });
    channel([[87, 61], [93, 62], [99, 63], [105, 62], [110, 61]], 1);
    channel([[116, 0], [117, 11], [113, 22], [110, 31], [111, 42], [109, 52], [111, 63],
      [113, 75], [111, 84], [116, 92], [121, 99]], 2);
    channel([[69, 12], [68, 22], [64, 29], [65, 38], [67, 46], [66, 58]], 1);
    channel([[70, 97], [80, 94], [87, 89], [96, 90], [104, 87], [112, 84]], 1);
    patch(105, 88, 8, 9, (x, y) => {
      if (!water(get(x, y)) && noise(x, y) < 42) {
        set(x, y, "meadow");
        place(x, y, "reeds");
      }
    });

    function road(points, broad = false) {
      line(points, (x, y) => {
        for (let lane = 0; lane <= Number(broad); lane++) {
          const py = y + lane;
          if (!World.inside(map, x, py)) continue;
          const tile = get(x, py);
          set(x, py, water(tile) || tile === "bridge" ? "bridge" : "path");
          delete objects[key(x, py)];
        }
      });
    }
    road([[8, 86], [19, 85], [25, 81], [34, 80], [42, 77], [53, 73], [64, 70], [73, 70], [82, 67],
      [94, 68], [102, 66], [107, 65], [114, 65], [118, 63], [127, 61]], true);
    road([[47, 56], [51, 60], [51, 69], [53, 73]], true);
    road([[46, 48], [50, 44], [53, 37], [56, 31], [62, 29], [71, 29], [78, 31], [85, 34]]);
    road([[72, 29], [74, 22], [78, 15], [77, 9]]);
    road([[13, 36], [21, 35], [31, 40], [34, 46], [40, 50], [46, 55]]);
    road([[21, 35], [24, 23], [28, 16], [27, 9]]);
    road([[19, 85], [23, 76], [27, 72], [32, 65], [34, 46]]);
    road([[42, 77], [48, 82], [57, 85], [64, 84], [74, 82], [86, 83], [95, 80], [102, 73], [103, 67]]);
    road([[94, 68], [94, 63], [91, 58], [85, 48], [85, 34]]);
    road([[103, 67], [105, 74], [106, 82], [105, 89], [101, 94]]);
    road([[60, 85], [63, 90], [68, 93], [79, 96], [90, 96], [101, 94]]);
    road([[119, 64], [121, 71], [120, 80], [123, 86]]);

    function notice(x, y, name, directions) {
      delete objects[key(x, y)];
      mark(x, y, "notice", { text: `${name} · ${directions}` });
    }

    const settlements = [
      [21, 35, "Nobottle", "Follow The Water downstream toward Needlehole or take the moor road north.", "smialRed"],
      [27, 9, "Long Cleeve", "The lane south descends from the North Moors toward Nobottle.", "smialBlue"],
      [31, 40, "Needlehole", "The upstream road skirts Rushock Bog on its way to Hobbiton.", "smialBlue"],
      [56, 31, "Overhill", "Smials stand in the hills north of Hobbiton, on the edge of Bindbole Wood.", "smialBlue"],
      [72, 29, "Brockenborings", "The road north climbs to Oatbarton. The eastern lane leads to Scary.", "smial"],
      [78, 15, "Oatbarton", "Farm lanes run north from here toward Evendim.", "smialRed"],
      [85, 34, "Scary", "The lane south leads to Budgeford and the East Road.", "smialRed"],
      [42, 77, "Waymeet", "Follow the East Road west to Michel Delving or east to Bywater.", "smialBlue"],
      [27, 72, "Little Delving", "Orchards and hedges line the lane to Michel Delving.", "smial"],
      [19, 85, "Michel Delving", "Stone and timber houses stand around the market of the Westfarthing.", "timber"],
      [60, 85, "Tuckborough", "The lane east runs along the Green Hill Country to Woodhall.", "smialRed"],
      [82, 67, "Frogmorton", "The East Road runs between the fields and The Water.", "timber"],
      [91, 58, "Budgeford", "The ford crosses The Water north of the East Road.", "timber"],
      [86, 83, "Woodhall", "The village stands on the edge of Woody End.", "smialBlue"],
      [104, 68, "Stock", "The bridge is north along the road. The ferry landing is south in the Marish.", "timber"],
      [105, 88, "The Marish", "Reed beds and farm lanes follow the Brandywine south of Stock.", "timber"],
      [68, 93, "Pincup", "A hill village south of Tuckborough in the Green Hill Country.", "smialRed"],
      [101, 94, "Willowbottom", "The southern lane follows the Shirebourn below Woody End.", "timber"],
      [120, 80, "Bucklebury", "The ferry leads back to the Marish. The Old Forest lies southeast.", "timber"],
    ];
    for (const [x, y, name, directions, facade] of settlements) {
      notice(x, y, name, directions);
      const houses = name === "Michel Delving" ? [[4, -4], [-5, 4]] : [[-4, -3], [3, -3], [-3, 4]];
      for (const [dx, dy] of houses) {
        const bx = x + dx;
        const by = y + dy;
        if (water(get(bx, by)) || surface.markers[key(bx, by)] || get(bx, by) === "path" || get(bx, by) === "bridge") continue;
        if (facade === "timber") cottage(bx, by);
        else smial(bx, by, facade);
      }
    }

    function cottage(x, y, stone = false, roof = "thatch") {
      for (let dy = -2; dy <= 0; dy++) for (let dx = -2; dx <= 2; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (water(get(px, py)) || get(px, py) === "bridge" || get(px, py) === "path" || surface.markers[key(px, py)]) continue;
        set(px, py, "stone");
        place(px, py, dy < 0 ? roof : dx === 0 ? "door" : Math.abs(dx) === 1 ? (stone ? "stoneWindow" : "cottageWindow") : stone ? "wall" : "timber");
      }
      if (objects[key(x + 1, y - 2)] === roof) place(x + 1, y - 2, roof === "thatch" ? "thatchChimney" : "tileChimney");
    }

    function fields(x, y) {
      for (let row = 0; row < 4; row++) for (let column = 0; column < 6; column++) {
        const px = x + column;
        const py = y + row;
        if (!["grass", "meadow"].includes(get(px, py)) || objects[key(px, py)] || surface.markers[key(px, py)]) continue;
        set(px, py, row % 2 ? "soil" : "crop");
      }
    }
    for (const [x, y] of [[73, 12], [80, 17], [74, 32], [22, 80], [37, 81], [86, 70], [98, 69], [97, 86], [116, 76]]) {
      fields(x, y);
    }

    function smial(x, y, facade) {
      patch(x, y - 1, 2, 2, (px, py) => {
        if (get(px, py) === "grass" || get(px, py) === "meadow") {
          set(px, py, "meadow");
          if (objects[key(px, py)] === "tree") delete objects[key(px, py)];
        }
      });
      place(x, y, facade);
    }

    // Give the original villages distinct streets and building fronts.
    for (const [x, y, facade] of [[37, 50, "smialBlue"], [54, 49, "smialRed"], [35, 66, "smialRed"], [62, 67, "smialBlue"], [77, 67, "smialRed"], [84, 66, "smialBlue"]]) {
      if (!water(get(x, y))) smial(x, y, facade);
    }
    for (const x of [56, 62]) place(x, 55, "stoneWindow");
    for (const x of [57, 61]) place(x, 53, "tileChimney");
    for (const x of [67, 71]) place(x, 67, "cottageWindow");
    place(71, 65, "tileChimney");
    cottage(72, 72, false);
    cottage(16, 81, true, "roof");
    cottage(23, 88, true, "roof");
    for (const [x, y, type] of [[17, 85, "bench"], [17, 87, "bunting"], [19, 87, "table"],
      [20, 87, "basket"], [14, 83, "lamp"], [13, 86, "flowers"]]) {
      if (get(x, y) !== "path" && !surface.markers[key(x, y)]) place(x, y, type);
    }

    notice(48, 54, "Hobbiton", "Bag End and Bagshot Row lie uphill. Cross The Water to reach Bywater.");
    notice(29, 49, "Rushock Bog", "Wet ground lies west of The Hill, along the upper course of The Water.");
    notice(55, 40, "Bindbole Wood", "The lane climbs through the wood toward Overhill.");
    notice(112, 65, "Brandywine Bridge", "The East Road crosses here from the Shire toward Bree-land.");
    notice(124, 62, "Bree Road", "The East Road leads onward toward Bree.");
    notice(123, 86, "Old Forest Edge", "The forest begins east of Buckland.");

    function connect(from, x, y, to, tx, ty) {
      from.markers[key(x, y)] = { type: "link", x: tx, y: ty, z: to.z };
      to.markers[key(tx, ty)] = { type: "link", x, y, z: from.z };
    }

    smial(52, 28, "smialBlue");
    cottage(100, 72);
    for (const [z, name, x, y, material, furniture] of [
      [-5, "Overhill Smial", 52, 28, "wood", [[8, 8, "bed"], [9, 8, "chest"], [12, 7, "hearth"], [10, 9, "rug"], [12, 10, "table"]]],
      [-6, "Michel Delving Market Hall", 16, 81, "stone", [[8, 8, "table"], [9, 8, "table"], [11, 8, "table"], [12, 8, "table"], [8, 9, "basket"], [12, 9, "chest"], [7, 10, "barrel"]]],
      [-7, "Stock Ferry House", 100, 72, "wood", [[7, 8, "barrel"], [7, 9, "barrel"], [8, 8, "chest"], [12, 7, "hearth"], [12, 9, "table"], [12, 10, "bench"]]],
    ]) {
      const inside = World.makeFloor(map, z, name, "void");
      map.floors.push(inside);
      for (let iy = 6; iy <= 12; iy++) for (let ix = 6; ix <= 14; ix++) {
        set(ix, iy, material, inside);
        if (ix === 6 || ix === 14 || iy === 6 || (iy === 12 && ix !== 10)) {
          inside.objects[key(ix, iy)] = material === "stone" ? "wall" : "timber";
        }
      }
      for (const [ix, iy, type] of furniture) {
        inside.objects[key(ix, iy)] = type;
      }
      if (!World.passable(map, surface, x, y)) delete objects[key(x, y)];
      set(x, y, "stone");
      connect(surface, x, y, inside, 10, 12);
      notice(x, y + 1, name, "Use the door immediately north to go inside.");
    }
    road([[106, 80], [108, 81], [110, 81]]);
    road([[116, 81], [118, 81], [120, 80]]);
    set(110, 81, "bridge");
    set(116, 81, "bridge");
    connect(surface, 110, 81, surface, 116, 81);
    notice(109, 81, "Bucklebury Ferry", "Use the landing immediately east to cross to Buckland.");
    notice(117, 81, "Buckland Landing", "Use the landing immediately west to cross to the Marish.");

    return World.validate(map);
  }

  function landmarkRegion(x, y) {
    if (x >= 114 || (x >= 109 && y >= 79)) return "Buckland and beyond";
    if ((x >= 81 && y >= 55) || x >= 109) return "Eastfarthing and the Brandywine";
    if (y < 46) return "Northfarthing and the upper Water";
    if (y >= 72 || x < 29) return "Westfarthing and the south";
    return "Hobbiton and Bywater";
  }

  return { create, previousRevisions, moveOldSave, landmarkRegion };
})();
