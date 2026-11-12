import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync, crc32 } from 'node:zlib';
import { parseDat, DatAttr, type ThingType } from './source/dat.ts';
import { parseSpr, decodeSprite } from './source/spr.ts';
import { tintOutfitSprite } from './source/outfitTint.ts';

const pack = process.argv[2];
if (!pack) throw new Error('Pass the path to the OpenTibia sprite pack checkout.');
const dat = parseDat(read('otsp.dat'), true);
const spr = parseSpr(read('otsp.spr'), true);

function read(file: string): ArrayBuffer {
  const bytes = readFileSync(resolve(pack, 'client_files', file));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

const grounds = { grass: 101, path: 129, water: 163, stone: 160, wood: 182, meadow: 110, crop: 122, bridge: 182, soil: 136 };
const objects = {
  tree: 1507, pine: 1565, shrub: 1498, flowers: 1338, rock: 1632, wall: 519,
  roof: 189, fence: 1099, barrel: 1110, lamp: 1178, door: 1021, sign: 1181,
  timber: 588, sideWall: 518, sideTimber: 587, bank: 922, table: 1192, bed: 1199, chest: 1115,
};
const items = {
  sword: 1689, broadsword: 1694, buckler: 1915, cap: 1943, tunic: 2010,
  trousers: 2079, boots: 2091, pack: 2099, pendant: 2139, ring: 2147, shireRing: 2148,
  herb: 1455, coin: 1187, link: 1005, ledger: 1904,
};
const actors = { player: 17, keeper: 19, miller: 19, gardener: 16, rat: 24, wolf: 6 };

function select(catalog: ThingType[], table: Record<string, number>) {
  return Object.fromEntries(Object.entries(table).map(([name, id]) => {
    const item = catalog.find(item => item.id === id);
    if (!item) throw new Error(`Sprite entry ${name} (${id}) missing.`);
    return [name, {
      ...item.frameGroup,
      displacement: item.attrs.get(DatAttr.Displacement) ?? { x: 0, y: 0 },
    }];
  }));
}

const group = {
  grounds: select(dat.items, grounds),
  objects: select(dat.items, objects),
  items: select(dat.items, items),
  actors: select(dat.creatures, actors),
  edges: select(dat.items, { 0: 215, 1: 216, 2: 217, 3: 218 }),
};

const recolored = new Map<number, Uint8Array>();
const outfit = group.actors.player;
if (outfit.layers !== 2) throw new Error('The ranger outfit requires a base and tint mask.');
const parts = outfit.width * outfit.height;
const outfitIds: number[] = [];
for (let offset = 0; offset < outfit.spriteIds.length; offset += parts * 2) {
  for (let part = 0; part < parts; part++) {
    const base = decodeSprite(spr, outfit.spriteIds[offset + part]);
    const mask = decodeSprite(spr, outfit.spriteIds[offset + parts + part]);
    const id = base ? spr.spriteCount + recolored.size + 1 : 0;
    if (base) {
      recolored.set(id, mask ? tintOutfitSprite(base, mask, { head: 40, body: 81, legs: 97, feet: 115 }) : base);
    }
    outfitIds.push(id);
  }
}
outfit.spriteIds = outfitIds;
outfit.layers = 1;

const ids = new Set<number>();
for (const entries of Object.values(group)) {
  for (const item of Object.values(entries)) {
    for (const id of item.spriteIds) if (id) ids.add(id);
  }
}

const columns = 16;
const size = 32;
const width = columns * size;
const height = Math.ceil(ids.size / columns) * size;
const stride = width * 4 + 1;
const pixels = Buffer.alloc(height * stride);
const positions: Record<number, number[]> = {};
let index = 0;
for (const id of ids) {
  const sprite = recolored.get(id) ?? decodeSprite(spr, id);
  if (!sprite) continue;
  const x = index % columns * size;
  const y = Math.floor(index / columns) * size;
  for (let row = 0; row < size; row++) {
    pixels.set(sprite.subarray(row * size * 4, (row + 1) * size * 4), (y + row) * stride + 1 + x * 4);
  }
  positions[id] = [x, y];
  index++;
}

function chunk(name: string, payload: Buffer) {
  const tag = Buffer.from(name);
  const header = Buffer.alloc(4);
  header.writeUInt32BE(payload.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([tag, payload])));
  return Buffer.concat([header, tag, payload, checksum]);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0);
header.writeUInt32BE(height, 4);
header[8] = 8;
header[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0)),
]);

const data = { ...group, positions, image: `data:image/png;base64,${png.toString('base64')}` };
writeFileSync(new URL('./assets/sprites.js', import.meta.url),
  '// Generated from the CC BY 4.0 OpenTibia Sprite Pack. See opentibia/README.md.\n' +
  `const OpenTibiaSprites = ${JSON.stringify(data)};\n`);
console.log(`Packed ${index} sprites in a ${width} × ${height} atlas.`);
