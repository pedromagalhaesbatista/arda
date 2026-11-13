"use strict";

const Art = (() => {
  const size = OpenTibia.TILE_SIZE;
  const sprites = OpenTibiaSprites;
  const atlas = new Image();
  atlas.src = sprites.image;
  const ready = atlas.decode();
  let phase = 0;

  const mapColors = {
    grass: "#566035", meadow: "#586b31", crop: "#7c852b", path: "#b49e76", stone: "#858479", wood: "#80522f",
    water: "#276b9b", river: "#367782", bridge: "#855838", soil: "#704a30", void: "#0d100e",
    tree: "#364620", pine: "#2f431e", wall: "#a29b8d", sideWall: "#a29b8d",
    timber: "#8a6747", sideTimber: "#8a6747", roof: "#7e5043", fence: "#92724d", smial: "#b3af64",
    smialBlue: "#a9ad73", smialRed: "#b1a965", thatch: "#b2904e", thatchChimney: "#b2904e",
    tileChimney: "#7e5043", cottageWindow: "#a47d54", stoneWindow: "#a29b8d",
    millWheel: "#694727", partyTree: "#39522a", appleTree: "#536535", hedge: "#506132",
    oldWillow: "#46502e", deadwood: "#5b4f35", campfire: "#ca8244",
    heath: "#75735a", marsh: "#5e6543", road: "#b69d73", woodland: "#45562d",
  };

  function sprite(c, id, x, y) {
    const source = sprites.positions[id];
    if (source) c.drawImage(atlas, source[0], source[1], size, size, x, y, size, size);
  }

  // The OTClient renderer anchors a multipart thing on its bottom-right tile.
  // Parts higher up or to the left extend across neighboring tiles.
  function draw(c, fg, x, y, patternX = 0, patternY = 0, frame = 0, layers = fg.layers) {
    const fx = patternX % fg.numPatternX;
    const fy = patternY % fg.numPatternY;
    const fp = frame % fg.animationPhases;
    for (let h = fg.height - 1; h >= 0; h--) {
      for (let w = fg.width - 1; w >= 0; w--) {
        for (let layer = 0; layer < layers; layer++) {
          const id = fg.spriteIds[OpenTibia.spriteIndex(fg, fp, fx, fy, layer, h, w)];
          sprite(c, id, x - w * size - fg.displacement.x, y - h * size - fg.displacement.y);
        }
      }
    }
  }

  function tile(c, type, x, y, vx = 0, vy = 0) {
    if (type === "void") {
      c.fillStyle = mapColors.void;
      c.fillRect(x, y, size, size);
      return;
    }
    if (["heath", "marsh", "road", "woodland"].includes(type)) {
      const variant = ((Math.imul(vx, 73856093) ^ Math.imul(vy, 19349663)) >>> 0) % 4;
      const id = type + variant;
      c.drawImage(terrainTiles[id] ??= terrainTile(type, variant), x, y);
      return;
    }
    draw(c, sprites.grounds[type], x, y, vx, vy, phase);
  }

  const terrainTiles = {};
  function terrainTile(type, variant) {
    const image = document.createElement("canvas");
    image.width = image.height = size;
    const context = image.getContext("2d");
    const base = { heath: "grass", marsh: "meadow", woodland: "grass", road: "path" }[type];
    draw(context, sprites.grounds[base], 0, 0, variant, 0, 0);
    context.fillStyle = { heath: "#918c7c80", marsh: "#525e3c66", woodland: "#2a432168", road: "#a0804742" }[type];
    context.fillRect(0, 0, size, size);
    if (type === "woodland" || type === "road") {
      for (let i = 0; i < 22; i++) {
        context.fillStyle = type === "woodland" ? ["#79603e", "#777046", "#344625"][i % 3] : ["#b2a487", "#97856b", "#c6b493"][i % 3];
        context.fillRect((i * 23 + variant * 17) % 31, (i * 19 + i * i + variant * 7) % 32, i % 4 ? 1 : 2, 1);
      }
    }
    return image;
  }
  function edge(c, x, y, side) {
    draw(c, sprites.edges[side], x, y);
  }

  const landmarks = {};
  const doors = {
    smial: ["#374728", "#435b2c", "#4e6632", "#5c7438"],
    smialBlue: ["#233738", "#2e4b53", "#385760", "#476975"],
    smialRed: ["#492c24", "#673c2d", "#774938", "#895744"],
  };
  const architecture = new Set(["thatch", "thatchChimney", "tileChimney", "cottageWindow", "stoneWindow"]);
  const thatchTiles = [];

  function landmark(type) {
    if (landmarks[type]) return landmarks[type];
    const smial = Object.hasOwn(doors, type);
    const image = document.createElement("canvas");
    image.width = smial ? 96 : 32;
    image.height = smial ? 57 : 32;
    const ctx = image.getContext("2d");
    if (smial) {
      const grass = ["#3a4a21", "#455628", "#50612b", "#5c6b30", "#647136"];
      const soil = ["#715030", "#805d39", "#8f6942", "#9b764b", "#a48258"];
      const stone = ["#665a43", "#7e7052", "#938561", "#a79a6e"];
      const wood = doors[type];
      for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
        const dx = x - 47;
        const n = (Math.imul(x + 19, 19349663) ^ Math.imul(y + 47, 73856093)) >>> 0;
        const rise = 32 * Math.sqrt(Math.max(0, 1 - (dx / 46) ** 2));
        const front = 54 - Math.abs(dx) / 13;
        const cap = front - 15 - (rise / 5);
        if (Math.abs(dx) > 45 || y < front - rise - 15 || y > front) continue;
        ctx.fillStyle = y < cap + n % 3 ? grass[(n + Math.floor(y / 6)) % grass.length] : soil[n % soil.length];
        const ring = Math.hypot(dx, (y - 40) * 1.04);
        if (ring < 16) ctx.fillStyle = stone[(Math.floor((Math.atan2(y - 40, dx) + Math.PI) * 2.2) + n % 2) % stone.length];
        if (ring < 12.4) ctx.fillStyle = dx % 4 === 0 ? wood[0] : wood[1 + (Math.floor((x + 1) / 4) + n % 2) % 3];
        const window = Math.hypot(x - 73, (y - 40) * 1.05);
        if (window < 7) ctx.fillStyle = window > 5 || x === 73 || y === 40 ? "#59432e" : n % 3 ? "#d0a35c" : "#b68a49";
        if (ring < 2) ctx.fillStyle = "#d9aa50";
        ctx.fillRect(x, y, 1, 1);
      }
    } else {
      for (let y = 1; y < 31; y++) for (let x = 1; x < 31; x++) {
        const dx = x - 16;
        const dy = y - 16;
        const radius = Math.hypot(dx, dy);
        const spoke = Math.abs(dx) < 2 || Math.abs(dy) < 2 || Math.abs(Math.abs(dx) - Math.abs(dy)) < 1.4;
        if (radius > 14.5 || (radius < 10.5 && radius > 3 && !spoke)) continue;
        ctx.fillStyle = radius > 13.5 || radius > 10.5 && radius < 11.5 ? "#4e3525" :
          (x + y * 2) % 5 === 0 ? "#a77e4c" : "#805935";
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.fillStyle = "#bb945f";
      ctx.fillRect(15, 15, 3, 3);
    }
    landmarks[type] = image;
    return image;
  }

  function building(c, type, x, y, vx, vy) {
    if (type.startsWith("thatch")) {
      const variant = ((Math.imul(vx, 73856093) ^ Math.imul(vy, 19349663)) >>> 0) % 8;
      c.drawImage(thatchTiles[variant] ??= thatchTile(variant), x, y);
    } else if (type === "tileChimney") {
      draw(c, sprites.objects.roof, x, y, vx, vy, phase);
    } else {
      draw(c, sprites.objects[type === "stoneWindow" ? "wall" : "timber"], x, y, vx, vy, phase);
      c.fillStyle = "#432d21";
      c.fillRect(x + 7, y + 8, 18, 16);
      c.fillStyle = "#d5a25f";
      c.fillRect(x + 9, y + 10, 14, 11);
      c.fillStyle = "#8c5d37";
      c.fillRect(x + 15, y + 10, 2, 11);
      c.fillRect(x + 9, y + 15, 14, 1);
      c.fillStyle = "#b69b72";
      c.fillRect(x + 6, y + 22, 20, 2);
    }
    if (type.endsWith("Chimney")) {
      c.fillStyle = "#5d4a3b";
      c.fillRect(x + 17, y + 8, 9, 15);
      c.fillStyle = "#92715b";
      c.fillRect(x + 17, y + 10, 6, 11);
      c.fillStyle = "#b29475";
      c.fillRect(x + 16, y + 7, 11, 3);
      c.fillStyle = "#30251f";
      c.fillRect(x + 18, y + 7, 7, 1);
    }
  }

  function thatchTile(variant) {
    const image = document.createElement("canvas");
    image.width = image.height = size;
    const ctx = image.getContext("2d");
    const colors = ["#795730", "#94703d", "#aa8649", "#bb9959", "#cfaf6a"];
    for (let y = 0; y < size; y += 2) for (let x = 0; x < size; x++) {
      const grain = ((Math.imul(x + variant * 32 + 17, 73856093) ^ Math.imul(y + 13, 19349663)) >>> 0) % colors.length;
      ctx.fillStyle = colors[y % 8 === 6 ? Math.min(grain, 2) : grain];
      ctx.fillRect(x, y, 1, 2);
    }
    return image;
  }

  function decoration(c, type, x, y) {
    if (type === "rug") {
      c.fillStyle = "#54362d";
      c.fillRect(x + 1, y + 2, 30, 27);
      c.fillStyle = "#a67f49";
      c.fillRect(x + 3, y + 4, 26, 23);
      c.fillStyle = "#7f4740";
      c.fillRect(x + 5, y + 6, 22, 19);
      c.fillStyle = "#bb9156";
      for (const dx of [9, 16, 23]) {
        c.fillRect(x + dx - 1, y + 14, 3, 3);
        c.fillRect(x + dx, y + 13, 1, 5);
      }
    } else {
      c.fillStyle = "#5e4127";
      c.fillRect(x + 1, y + 3, 2, 25);
      c.fillRect(x + 29, y + 3, 2, 25);
      c.fillRect(x + 2, y + 4, 28, 1);
      const colors = ["#caa456", "#ad5b45", "#71986d", "#c58c53"];
      colors.forEach((color, i) => {
        const left = x + 4 + i * 6;
        c.fillStyle = color;
        c.fillRect(left, y + 5, 5, 2);
        c.fillRect(left + 1, y + 7, 3, 2);
        c.fillRect(left + 2, y + 9, 1, 1);
      });
    }
  }

  const structures = {};
  const pitches = {
    clay: ["#422f2a", "#634036", "#805044", "#955c4b", "#a96a55", "#bb7b60"],
    slate: ["#2c3134", "#42484a", "#55595a", "#656964", "#77796d", "#939081"],
    straw: ["#56402a", "#735432", "#92713e", "#a7864b", "#b89953", "#ceb06a"],
  };
  for (const part of Object.keys(World.objects)) {
    const roof = Object.keys(pitches).find(name => part.startsWith(name));
    if (roof) mapColors[part] = pitches[roof][3];
    else if (part.startsWith("ashlar")) mapColors[part] = mapColors.wall;
    else if (part.startsWith("framed")) mapColors[part] = mapColors.timber;
  }
  const detail = (x, y, variant) => (Math.imul(x + variant * 59, 73856093) ^ Math.imul(y + 37, 19349663)) >>> 0;

  function structure(type, variant) {
    const id = type + variant;
    if (structures[id]) return structures[id];
    const image = document.createElement("canvas");
    image.width = image.height = size;
    const c = image.getContext("2d");
    const fill = (color, x, y, w, h) => {
      c.fillStyle = color;
      c.fillRect(x, y, w, h);
    };
    const roof = Object.keys(pitches).find(name => type.startsWith(name));
    if (roof) {
      const shade = pitches[roof];
      const back = type.includes("Back");
      const ridge = type.includes("Ridge");
      const eave = type.includes("Eave");
      for (let y = 0; y < 32; y++) {
        const row = Math.floor(y / 8);
        const light = ridge && y < 16 || back ? 2 : 3;
        for (let x = 0; x < 32; x++) {
          const seam = roof === "straw" ? (x + Math.floor(y / 6)) % 4 : (x + row % 2 * 4) % 8;
          const n = detail(x, y, variant);
          const tone = roof !== "straw" && y % 8 === 7 ? 1 : seam === 0 ? light - 1 : n % 8 === 1 ? light + 1 : light;
          fill(shade[tone], x, y, 1, 1);
        }
      }
      if (ridge) {
        fill(shade[1], 0, 13, 32, 6);
        fill(shade[5], 0, 13, 32, 2);
        for (let x = 0; x < 32; x += 8) fill(shade[2], x, 15, 1, 4);
      }
      if (eave) {
        fill(shade[0], 0, 28, 32, 4);
        fill(shade[4], 0, 28, 32, 1);
      }
      if (type.endsWith("Left") || type.endsWith("Right")) {
        const edge = type.endsWith("Left") ? 0 : 29;
        fill(shade[0], edge, 0, 3, 32);
        fill(shade[4], edge + (edge === 0 ? 2 : 0), 0, 1, 32);
      }
      if (type.endsWith("Stack")) {
        fill("#252326", 12, 22, 16, 5);
        fill("#574942", 12, 5, 12, 19);
        fill("#978677", 12, 5, 8, 17);
        for (let y = 10; y <= 20; y += 5) fill("#695b50", 12, y, 12, 1);
        fill("#a69583", 10, 3, 16, 4);
        fill("#39322c", 13, 3, 10, 2);
      }
    } else if (type === "stall") {
      fill("#402e1b", 5, 12, 3, 19);
      fill("#402e1b", 25, 12, 3, 19);
      fill("#735138", 6, 21, 21, 7);
      fill("#b28b53", 6, 19, 21, 3);
      fill("#603b2f", 2, 5, 28, 12);
      for (let x = 3; x < 29; x += 5) {
        fill(x % 2 ? "#ac6751" : "#ccae75", x, 6, 4, 9);
        fill(x % 2 ? "#834937" : "#a08657", x, 14, 4, 2);
      }
    } else if (type === "dock") {
      fill("#65462e", 0, 0, 32, 32);
      for (let y = 0; y < 32; y += 8) {
        fill("#94704a", 0, y, 32, 1);
        fill("#513524", 0, y + 7, 32, 1);
        fill("#805b3b", y / 2, y + 3, 16, 1);
      }
      for (const y of [3, 22]) {
        const x = variant % 2 ? 24 : 3;
        fill("#3b271a", x, y + 2, 6, 7);
        fill("#b69368", x, y, 6, 3);
        fill("#a6967a", x - 1, y + 4, 8, 2);
      }
    } else if (type === "trough") {
      fill("#38291d", 3, 11, 26, 15);
      fill("#97704d", 4, 10, 24, 4);
      fill("#684d35", 4, 15, 24, 8);
      fill("#4f7373", 6, 14, 20, 6);
      fill("#729393", 9, 15, 8, 1);
      fill("#ac865b", 4, 21, 24, 2);
    } else if (type !== "smialBank") {
      const stone = type.startsWith("ashlar");
      const wall = stone ? ["#797268", "#837a6a", "#908777", "#988e7b"] : ["#aa9070", "#b49975", "#bda481", "#c2ad8a"];
      const beam = stone ? "#5e574e" : "#503928";
      const hasWindow = type.endsWith("Window");
      const hasDoor = type.endsWith("Door");
      fill(beam, 0, 0, 32, 32);
      for (let y = 3; y < 29; y++) for (let x = 0; x < 32; x++) {
        const mortar = stone && ((y - 3) % 7 === 6 || (x + Math.floor((y - 3) / 7) % 2 * 8) % 16 === 0);
        const n = detail(x, y, variant);
        fill(mortar ? "#6c655a" : wall[n % 11 === 1 ? 0 : n % 9 === 1 ? 3 : 2], x, y, 1, 1);
      }
      if (!stone || type.endsWith("Corner")) {
        fill(beam, 0, 0, 3, 32);
        fill(beam, 29, 0, 3, 32);
        if (!hasWindow && !hasDoor && !stone) {
          for (let i = 0; i < 26; i++) fill(beam, 3 + i, 28 - i, 2, 2);
        }
      }
      if (hasWindow || hasDoor) {
        const inset = hasDoor ? 8 : 7;
        const top = hasDoor ? 7 : 9;
        const w = 32 - inset * 2;
        const h = hasDoor ? 25 : 15;
        fill(beam, inset, top, w, h);
        fill(hasDoor ? "#30231a" : "#3c403a", inset + 2, top + 2, w - 4, h - 3);
        if (hasDoor) {
          for (let x = 11; x < 22; x += 4) fill("#775034", x, 10, 3, 20);
          fill("#b79051", 19, 22, 2, 2);
          fill("#9a8b73", 6, 30, 20, 2);
        } else {
          for (const x of [10, 17]) for (const y of [12, 18]) fill("#ae884d", x, y, 5, 4);
          fill("#d1af70", 10, 12, 4, 1);
          fill("#a48c6e", 6, 24, 20, 2);
        }
      }
    }
    return structures[id] = image;
  }

  function isStructure(type) {
    return /^(ashlar|framed|clay|slate|straw|smialBank|stall|trough|dock)/.test(type);
  }

  const forestProps = new Set(["deadwood", "oldWillow", "campfire"]);
  const forestTiles = new Map();
  function forestProp(type) {
    if (forestTiles.has(type)) return forestTiles.get(type);
    const image = document.createElement("canvas");
    image.width = type === "oldWillow" ? 60 : 32;
    image.height = type === "oldWillow" ? 65 : 32;
    const c = image.getContext("2d");
    const rect = (color, x, y, w, h) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
    if (type === "campfire") {
      for (const [x, y] of [[7, 19], [13, 23], [20, 22], [24, 17], [11, 16], [19, 14]]) {
        rect("#413b32", x, y, 6, 5);
        rect("#80745d", x + 1, y, 4, 2);
      }
      rect("#3b291c", 10, 17, 15, 6);
      rect("#956044", 12, 20, 10, 2);
      rect("#bd592c", 13, 10, 9, 10);
      rect("#ef9041", 14, 13, 6, 8);
      rect("#ffbf59", 16, 9, 4, 10);
      rect("#ffe198", 16, 15, 3, 5);
    } else if (type === "deadwood") {
      rect("#353221", 2, 20, 28, 6);
      rect("#4d3f2d", 3, 14, 26, 9);
      rect("#6a5339", 5, 13, 22, 7);
      rect("#807051", 4, 15, 19, 2);
      rect("#99815b", 25, 14, 5, 8);
      rect("#655439", 26, 16, 2, 4);
      rect("#514f2c", 7, 11, 6, 4);
      rect("#6e6a37", 13, 12, 8, 2);
    } else {
      rect("#372e21", 23, 28, 15, 29);
      rect("#6b5840", 25, 27, 9, 32);
      rect("#473c2c", 15, 57, 29, 5);
      rect("#5b4b32", 10, 60, 20, 3);
      rect("#554632", 32, 56, 17, 4);
      for (let y = 2; y < 54; y++) for (let x = 0; x < 60; x++) {
        const crown = ((x - 30) / 29) ** 2 + ((y - 20) / 19) ** 2;
        const fringe = y > 21 && y < 52 - Math.abs(x - 30) * .22 && Math.abs(x - 30) > 9 && x % 11 < 5;
        if (crown > 1 && !fringe) continue;
        const n = detail(x, y, 1);
        const colors = ["#313d25", "#3d4a2a", "#4b5931", "#586638", "#6b7440"];
        const shade = Math.min(4, Math.max(0, 3 - Math.floor(y / 14) + (n % 9 === 0 ? 1 : 0) - (x % 7 > 4 ? 1 : 0)));
        rect(colors[shade], x, y, 1, 1);
      }
    }
    forestTiles.set(type, image);
    return image;
  }

  function object(c, type, x, y, vx = 0, vy = 0) {
    if (forestProps.has(type)) {
      const image = forestProp(type);
      c.drawImage(image, x + (size - image.width) / 2, y + size - image.height);
      return;
    }
    if (type === "seedCrate") type = "basket";
    if (type === "rug" || type === "bunting") return decoration(c, type, x, y);
    if (type === "partyTree") {
      c.save();
      c.translate(x + size * 0.75, y + size);
      c.scale(1.65, 1.65);
      draw(c, sprites.objects.partyTree, -size * 0.75, -size);
      c.restore();
      return;
    }
    if (Object.hasOwn(doors, type) || type === "millWheel") {
      const image = landmark(type);
      c.drawImage(image, x - (image.width - size) / 2, y + size - image.height);
      return;
    }
    if (architecture.has(type)) return building(c, type, x, y, vx, vy);
    if (isStructure(type)) return c.drawImage(structure(type, type === "dock" ? Number(vx < 228) : detail(vx, vy, 0) % 4), x, y);
    draw(c, sprites.objects[type], x, y, vx, vy, phase);
  }

  function signpost(c, x, y) {
    c.fillStyle = "#3c2a1b";
    c.fillRect(x + 14, y + 12, 4, 17);
    c.fillRect(x + 5, y + 8, 22, 10);
    c.fillStyle = "#815d37";
    c.fillRect(x + 6, y + 9, 20, 7);
    c.fillRect(x + 15, y + 18, 2, 10);
    c.fillStyle = "#bd9560";
    c.fillRect(x + 7, y + 9, 18, 1);
    c.fillRect(x + 9, y + 12, 12, 1);
    c.fillRect(x + 10, y + 14, 9, 1);
  }

  const forestTypes = new Set(["forestWolf", "thornling", "willowGuardian"]);
  const forestActors = new Map();
  function forestActor(type, face, step) {
    const id = `${type}:${face}:${step}`;
    if (forestActors.has(id)) return forestActors.get(id);
    const image = document.createElement("canvas");
    const guardian = type === "willowGuardian";
    const side = guardian ? 44 : 32;
    image.width = image.height = side;
    const c = image.getContext("2d");
    const rect = (color, x, y, w, h) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
    if (type === "forestWolf") {
      draw(c, sprites.actors.wolf, 0, 0, face, 0, step, 1);
      c.globalCompositeOperation = "source-atop";
      rect("#38433570", 0, 0, 32, 32);
    } else {
      const mid = side / 2;
      const sway = step === 1 ? -1 : step === 2 ? 1 : 0;
      const trunk = guardian ? "#685139" : "#55432b";
      const branch = guardian ? "#897151" : "#746048";
      rect("#292b20", mid - 11, side - 4, 22, 3);
      rect(trunk, mid - 7, side - 13 + sway, 5, 11 - sway);
      rect(trunk, mid + 3, side - 13 - sway, 5, 11 + sway);
      rect(branch, mid - 9, side - 4 + sway, 8, 2);
      rect(branch, mid + 2, side - 4 - sway, 9, 2);
      rect("#393123", mid - 8, 11, 16, side - 20);
      rect(trunk, mid - 7, 9, 14, side - 21);
      rect(branch, mid - 5, 12, 3, side - 24);
      rect("#3f3525", mid + 2, 13, 2, side - 26);
      for (const sign of [-1, 1]) {
        const reach = guardian ? 17 : 13;
        for (let n = 7; n <= reach; n++) {
          rect(n % 3 ? trunk : branch, mid + n * sign, Math.floor(15 + (n - 7) * .8 + sway * sign), 3, guardian ? 5 : 3);
        }
        rect("#3b4b2b", mid + sign * 10 - 3, 6 + sway * sign, 7, 7);
        rect("#617344", mid + sign * 10 - 2, 6 + sway * sign, 5, 3);
      }
      rect("#35432b", mid - 9, 6, 18, 7);
      rect("#4b6038", mid - 7, 3, 14, 6);
      rect("#627546", mid - 4, 1, 9, 5);
      if (face !== OpenTibia.Direction.North) {
        const color = guardian ? "#edb25f" : "#b6bd63";
        if (face !== OpenTibia.Direction.East) rect(color, mid - 4, 15, 2, 2);
        if (face !== OpenTibia.Direction.West) rect(color, mid + 2, 15, 2, 2);
      }
      if (guardian) {
        rect("#46633c", mid - 1, 22, 6, 7);
        rect("#93a263", mid, 23, 3, 4);
      }
    }
    forestActors.set(id, image);
    return image;
  }

  function actor(c, type, x, y, face = OpenTibia.Direction.South, step = 0) {
    if (forestTypes.has(type)) {
      const image = forestActor(type, face, step);
      c.drawImage(image, x + (size - image.width) / 2, y + size - image.height);
      return;
    }
    draw(c, sprites.actors[Villages.people[type]?.sprite ?? type], x, y, face, 0, step, 1);
  }

  function corpse(c, type, x, y) {
    c.save();
    c.translate(x + size, y + 15);
    c.scale(.93, .51);
    c.globalAlpha = .74;
    actor(c, type, -size, 0, OpenTibia.Direction.East);
    c.restore();
  }

  function icon(c, id, x = 0, y = 0) {
    if (id === "forestFang" || id === "thornBark" || id === "willowHeart") {
      const heart = id === "willowHeart";
      c.fillStyle = "#332c20";
      c.fillRect(x + 8, y + 23, 17, 3);
      if (id === "forestFang") {
        for (let row = 0; row < 15; row++) {
          const left = 11 + Math.floor(row * .45);
          c.fillStyle = "#9f8b67";
          c.fillRect(x + left, y + 9 + row, Math.max(2, 12 - row), 1);
          c.fillStyle = "#e8d6a7";
          c.fillRect(x + left + 1, y + 9 + row, Math.max(1, 9 - row), 1);
        }
      } else {
        c.fillStyle = heart ? "#5d4734" : "#6a5437";
        c.fillRect(x + 8, y + 12, 17, 11);
        c.fillStyle = heart ? "#a58956" : "#837047";
        c.fillRect(x + 10, y + 10, 11, 11);
        c.fillStyle = heart ? "#c3b478" : "#54623a";
        c.fillRect(x + 14, y + 12, 4, 8);
        c.fillStyle = heart ? "#e5cc87" : "#776240";
        c.fillRect(x + 15, y + 13, 2, 4);
        if (!heart) {
          c.fillRect(x + 11, y + 6, 2, 6);
          c.fillRect(x + 22, y + 8, 2, 6);
        }
      }
      return;
    }
    const spriteId = Equipment.items[id]?.sprite ?? id;
    if (sprites.items[spriteId]) {
      draw(c, sprites.items[spriteId], x, y);
      return;
    }
    c.fillStyle = "#f2cc76";
    if (id === "erase") {
      c.fillRect(x + 6, y + 15, 20, 2);
      return;
    }
    if (id === "start") {
      c.fillRect(x + 14, y + 5, 4, 22);
      c.fillRect(x + 5, y + 14, 22, 4);
      c.fillRect(x + 11, y + 11, 10, 10);
    }
  }

  function preview(c, type, layer) {
    if (layer === "ground") return tile(c, type, 0, 0);
    if (Object.hasOwn(doors, type) || type === "millWheel") {
      const image = landmark(type);
      c.drawImage(image, 0, 0, size, size * image.height / image.width);
      return;
    }
    if (architecture.has(type)) return building(c, type, 0, 0, 0, 0);
    if (type === "smialBank") return tile(c, "meadow", 0, 0);
    if (isStructure(type)) return c.drawImage(structure(type, 0), 0, 0);
    if (forestProps.has(type)) return c.drawImage(forestProp(type), 0, 0, size, size);
    if (forestTypes.has(type)) {
      return c.drawImage(forestActor(type, OpenTibia.Direction.South, 0), 0, 0, size, size);
    }
    if (type === "notice") return signpost(c, 0, 0);
    if (type === "rug" || type === "bunting") return decoration(c, type, 0, 0);
    const group = layer === "objects" ? sprites.objects : sprites.actors;
    const thing = type === "seedCrate" || type === "seedBasket" ? sprites.objects.basket :
      group[Villages.people[type]?.sprite ?? type];
    if (!thing) return icon(c, type);
    c.save();
    const zoom = thing.width > 1 || thing.height > 1 ? 0.5 : 1;
    c.scale(zoom, zoom);
    const x = (thing.width - 1) * size + thing.displacement.x;
    const y = (thing.height - 1) * size + thing.displacement.y;
    draw(c, thing, x, y, layer === "markers" ? OpenTibia.Direction.South : 0, 0, 0, layer === "markers" ? 1 : thing.layers);
    c.restore();
  }

  function animate(now) {
    phase = Math.floor(now / 500);
  }

  return { size, mapColors, ready, animate, tile, edge, object, signpost, actor, corpse, icon, preview };
})();
