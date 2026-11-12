"use strict";

const World = (() => {
  const ground = {
    grass: "Grass", path: "Dirt path", water: "Water", stone: "Flagstone",
    wood: "Planks", meadow: "Meadow", crop: "Crops", bridge: "Bridge", soil: "Garden soil", void: "Void"
  };
  const objects = {
    tree: "Oak", pine: "Pine", shrub: "Shrub", flowers: "Flowers",
    rock: "Boulder", wall: "Stone wall", sideWall: "Stone side wall", timber: "Timber wall", sideTimber: "Timber side wall", roof: "Tiled roof", fence: "Fence",
    barrel: "Barrel", lamp: "Lantern", door: "Door", sign: "Sign",
    smial: "Hobbit door", millWheel: "Water wheel", bank: "Grassy bank", table: "Table", bed: "Bed", chest: "Chest",
  };
  const markers = { start: "Player start", link: "Floor link", keeper: "Innkeeper", miller: "Miller", gardener: "Sam Gamgee", ledger: "Mill ledger", notice: "Signpost", rat: "Cellar rat", wolf: "Wolf" };
  const solid = new Set(["tree", "pine", "rock", "wall", "sideWall", "timber", "sideTimber", "roof", "fence", "barrel", "lamp", "millWheel", "bank", "table", "bed", "chest"]);
  const key = (x, y) => `${x},${y}`;
  const index = (map, x, y) => y * map.width + x;
  const inside = (map, x, y) => x >= 0 && y >= 0 && x < map.width && y < map.height;
  const floorAt = (map, z) => map.floors.find(floor => floor.z === z);

  function makeFloor(map, z, name, fill) {
    return { z, name, ground: Array(map.width * map.height).fill(fill), objects: {}, markers: {} };
  }

  function passable(map, floor, x, y) {
    if (!inside(map, x, y)) return false;
    const tile = floor.ground[index(map, x, y)];
    return tile !== "water" && tile !== "void" && !solid.has(floor.objects[key(x, y)]);
  }

  function canStep(map, floor, x, y, nx, ny, occupied) {
    if (!passable(map, floor, nx, ny) || occupied(nx, ny)) return false;
    if (x === nx || y === ny) return true;
    return passable(map, floor, nx, y) && passable(map, floor, x, ny);
  }

  function route(map, floor, start, goal, occupied = () => false) {
    return OpenTibia.findPath(
      start.x, start.y, goal.x, goal.y,
      (x, y) => passable(map, floor, x, y) && !occupied(x, y),
      (x, y) => floor.markers[key(x, y)]?.type === "link"
    ) ?? [];
  }

  function findStart(map) {
    for (const floor of map.floors) {
      for (const [pos, marker] of Object.entries(floor.markers)) {
        if (marker.type !== "start") continue;
        const [x, y] = pos.split(",").map(Number);
        if (passable(map, floor, x, y)) return { x, y, z: floor.z };
      }
    }
    return null;
  }

  function validate(data) {
    const fail = message => { throw new Error(message); };
    if (!data || data.version !== 1) fail("This file is not an Arda world (version 1).");
    const { width, height, floors, name } = data;
    if (![width, height].every(size => Number.isInteger(size) && size >= 8 && size <= 128)) fail("World size must be between 8 and 128 tiles per side.");
    if (typeof name !== "string" || !name.trim() || name.length > 60) fail("The world needs a name of up to 60 characters.");
    if (!Array.isArray(floors) || floors.length < 1 || floors.length > 16) fail("A world needs 1–16 floors.");

    const ids = new Set();
    const map = { version: 1, width, height, name, floors: [] };
    if (data.adventure === "shire") map.adventure = data.adventure;
    for (const source of floors) {
      if (!source || !Number.isInteger(source.z) || Math.abs(source.z) > 99 || ids.has(source.z)) fail("Each floor needs a unique number between −99 and 99.");
      ids.add(source.z);
      if (typeof source.name !== "string" || !source.name.trim() || source.name.length > 60) fail("Each floor needs a name of up to 60 characters.");
      if (!Array.isArray(source.ground) || source.ground.length !== width * height || source.ground.some(tile => !Object.hasOwn(ground, tile))) fail("Invalid ground layer.");
      const floor = { z: source.z, name: source.name, ground: [...source.ground], objects: {}, markers: {} };
      for (const layer of ["objects", "markers"]) {
        const entries = source[layer];
        if (!entries || typeof entries !== "object" || Array.isArray(entries)) fail("Invalid map layer.");
        for (const [pos, value] of Object.entries(entries)) {
          const [x, y] = pos.split(",").map(Number);
          if (!Number.isInteger(x) || !Number.isInteger(y) || key(x, y) !== pos || !inside(map, x, y)) fail("Invalid tile coordinate.");
          if (layer === "objects") {
            if (!Object.hasOwn(objects, value)) fail("Unknown map object.");
            floor.objects[pos] = value;
            continue;
          }
          if (!value || typeof value !== "object" || !Object.hasOwn(markers, value.type)) fail("Unknown map marker.");
          if (value.type === "link" && (!Number.isInteger(value.z) || !Number.isInteger(value.x) || !Number.isInteger(value.y) || !inside(map, value.x, value.y))) fail("Invalid floor link.");
          if (value.type === "notice" && (typeof value.text !== "string" || !value.text.trim() || value.text.length > 160)) fail("A signpost needs text of up to 160 characters.");
          const marker = { type: value.type };
          if (value.type === "link") Object.assign(marker, { x: value.x, y: value.y, z: value.z });
          if (value.type === "notice") marker.text = value.text;
          floor.markers[pos] = marker;
        }
      }
      map.floors.push(floor);
    }

    let starts = 0;
    for (const floor of map.floors) {
      for (const [pos, marker] of Object.entries(floor.markers)) {
        const [x, y] = pos.split(",").map(Number);
        if (!passable(map, floor, x, y)) fail(`The ${markers[marker.type]} at ${pos} on floor ${floor.z} needs a walkable tile.`);
        if (marker.type === "start") starts++;
        if (marker.type === "link") {
          const target = floorAt(map, marker.z);
          if (!target || !passable(map, target, marker.x, marker.y)) fail(`The link at ${pos} on floor ${floor.z} needs a walkable destination.`);
        }
      }
    }
    if (starts !== 1) fail("Place exactly one player start on the map.");
    return map;
  }

  function seed() {
    const map = { version: 1, name: "Bree", width: 50, height: 36, floors: [] };
    const surface = makeFloor(map, 0, "Surface", "grass");
    const cellar = makeFloor(map, -1, "Inn Cellar", "void");
    map.floors.push(surface, cellar);
    const set = (floor, x, y, tile) => { floor.ground[index(map, x, y)] = tile; };
    const object = (floor, x, y, tile) => { floor.objects[key(x, y)] = tile; };
    const rect = (floor, x1, y1, x2, y2, tile) => {
      for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) set(floor, x, y, tile);
    };
    const random = (x, y) => ((Math.imul(x + 79, 73856093) ^ Math.imul(y + 47, 19349663)) >>> 0) % 101;
    for (let x = 0; x < map.width; x++) {
      const road = 17 + Math.round(Math.sin(x / 7) * 2);
      for (let y = road - 1; y <= road + 1; y++) set(surface, x, y, "path");
    }
    for (let y = 0; y < map.height; y++) {
      const river = 34 + Math.round(Math.sin(y / 5) * 2);
      for (let x = river; x < river + 3; x++) set(surface, x, y, y >= 14 && y <= 16 ? "bridge" : "water");
    }
    rect(surface, 33, 14, 38, 16, "bridge");
    rect(surface, 17, 10, 25, 16, "stone");
    rect(surface, 17, 10, 25, 12, "wood");
    for (let x = 17; x <= 25; x++) {
      object(surface, x, 10, "roof");
      object(surface, x, 11, "roof");
      object(surface, x, 12, x === 21 ? "door" : "timber");
    }
    object(surface, 18, 14, "barrel");
    object(surface, 19, 14, "barrel");
    object(surface, 24, 14, "lamp");
    object(surface, 20, 13, "sign");
    rect(surface, 10, 20, 15, 25, "soil");
    for (let x = 10; x <= 15; x++) {
      object(surface, x, 25, "fence");
      object(surface, x, 20, x === 12 ? "flowers" : "fence");
      object(surface, x, 22, "flowers");
      if (x % 2 === 0) object(surface, x, 24, "flowers");
    }
    rect(surface, 25, 21, 29, 25, "path");
    for (let x = 25; x <= 29; x++) {
      object(surface, x, 21, "roof");
      object(surface, x, 22, "roof");
      object(surface, x, 23, x === 27 ? "door" : "timber");
    }
    object(surface, 25, 24, "barrel");
    object(surface, 29, 24, "lamp");

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (surface.ground[index(map, x, y)] !== "grass") continue;
        const n = random(x, y);
        const forest = x < 13 || x > 37 || y < 8 || y > 26;
        if (n < (forest ? 17 : 5)) object(surface, x, y, n % 3 === 0 ? "pine" : "tree");
        else if (n < (forest ? 24 : 11)) object(surface, x, y, "shrub");
        else if (n >= 97) object(surface, x, y, "flowers");
        else if (n === 88 && forest) object(surface, x, y, "rock");
      }
    }

    rect(cellar, 17, 10, 27, 21, "stone");
    rect(cellar, 18, 11, 26, 14, "wood");
    for (let x = 17; x <= 27; x++) {
      object(cellar, x, 10, "wall");
      object(cellar, x, 21, "wall");
    }
    for (let y = 11; y < 21; y++) {
      object(cellar, 17, y, "sideWall");
      object(cellar, 27, y, "sideWall");
    }
    for (const [x, y] of [[18, 12], [19, 12], [24, 12], [25, 12], [25, 19], [26, 19]]) object(cellar, x, y, "barrel");
    object(cellar, 18, 15, "lamp");
    object(cellar, 26, 18, "lamp");
    const place = (floor, x, y, type, destination = {}) => {
      if (solid.has(floor.objects[key(x, y)])) delete floor.objects[key(x, y)];
      floor.markers[key(x, y)] = { type, ...destination };
    };
    place(surface, 21, 17, "start");
    place(surface, 20, 15, "keeper");
    place(surface, 21, 13, "link", { x: 21, y: 13, z: -1 });
    place(surface, 41, 16, "wolf");
    place(surface, 43, 21, "wolf");
    place(cellar, 21, 13, "link", { x: 21, y: 13, z: 0 });
    place(cellar, 21, 17, "rat");
    place(cellar, 24, 18, "rat");
    return validate(map);
  }

  return { ground, objects, markers, key, index, inside, floorAt, makeFloor, passable, canStep, route, findStart, validate, seed };
})();
