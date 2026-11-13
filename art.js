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
    timber: "#8a6747", sideTimber: "#8a6747", roof: "#7e5043", fence: "#92724d", smial: "#b3af64", millWheel: "#694727", partyTree: "#39522a", appleTree: "#536535", hedge: "#506132"
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
    draw(c, sprites.grounds[type], x, y, vx, vy, phase);
  }

  function edge(c, x, y, side) {
    draw(c, sprites.edges[side], x, y);
  }

  const landmarks = {};

  function landmark(type) {
    if (landmarks[type]) return landmarks[type];
    const smial = type === "smial";
    const image = document.createElement("canvas");
    image.width = smial ? 96 : 32;
    image.height = smial ? 57 : 32;
    const ctx = image.getContext("2d");
    if (smial) {
      const grass = ["#3a4a21", "#455628", "#50612b", "#5c6b30", "#647136"];
      const soil = ["#715030", "#805d39", "#8f6942", "#9b764b", "#a48258"];
      const stone = ["#665a43", "#7e7052", "#938561", "#a79a6e"];
      const wood = ["#374728", "#435b2c", "#4e6632", "#5c7438"];
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

  function object(c, type, x, y, vx = 0, vy = 0) {
    if (type === "rug" || type === "bunting") return decoration(c, type, x, y);
    if (type === "partyTree") {
      c.save();
      c.translate(x + size * 0.75, y + size);
      c.scale(1.65, 1.65);
      draw(c, sprites.objects.partyTree, -size * 0.75, -size);
      c.restore();
      return;
    }
    if (type === "smial" || type === "millWheel") {
      const image = landmark(type);
      c.drawImage(image, x - (image.width - size) / 2, y + size - image.height);
      return;
    }
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

  function actor(c, type, x, y, face = OpenTibia.Direction.South, step = 0) {
    draw(c, sprites.actors[type], x, y, face, 0, step, 1);
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
    if (sprites.items[id]) {
      draw(c, sprites.items[id], x, y);
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
    if (type === "smial" || type === "millWheel") {
      const image = landmark(type);
      c.drawImage(image, 0, 0, size, size * image.height / image.width);
      return;
    }
    if (type === "notice") return signpost(c, 0, 0);
    if (type === "rug" || type === "bunting") return decoration(c, type, 0, 0);
    const group = layer === "objects" ? sprites.objects : sprites.actors;
    const thing = group[type];
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
