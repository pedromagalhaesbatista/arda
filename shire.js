"use strict";

const Shire = (() => {
  // The surface uses one tile per eight pixels of the supplied 2560 × 1440 map.
  const width = 320;
  const height = 180;
  const regionalRevision = "1f9b74a99de1818e";
  const previousRevisions = [regionalRevision, "a68195270fd424c9", "b902d48dab786345", "e6258651b64f76aa"];
  const places = [
    ["Duillond", 9, 62, "Ered Luin", "Elven settlement."],
    ["Falathlorn Homesteads", 20, 73, "Ered Luin", "Homes along the Lune."],
    ["Celondim", 13, 90, "Ered Luin", "Elven settlement on the Lune."],
    ["Kheledûl", 16, 40, "Ered Luin", "Quays on the northern Lune."],
    ["Lhúngobel", 35, 25, "Ered Luin", "Northern road through the Blue Mountains."],
    ["Gamwich", 78, 55, "Yondershire", "Village near the headwaters."],
    ["Tighfield", 79, 74, "Yondershire", "Farms west of Nobottle."],
    ["Nobottle", 108, 80, "Yondershire", "Road junction on The Water."],
    ["Needlehole", 131, 86, "Yondershire", "Upstream from Rushock Bog."],
    ["Long Cleeve", 112, 43, "Northfarthing", "Moorland village above The Water."],
    ["Annúminas", 177, 23, "Evendim", "Ruins overlooking Lake Evendim."],
    ["Dwaling", 220, 36, "Northfarthing", "Road north of Oatbarton."],
    ["Northcotton", 186, 47, "Northfarthing", "Farms near Oatbarton."],
    ["Oatbarton", 196, 52, "Northfarthing", "Farming village on the Evendim road."],
    ["Brockenborings", 190, 84, "Northfarthing", "Village east of the Norbourn."],
    ["Overhill", 175, 89, "Westfarthing", "Hill village in Bindbole Wood."],
    ["Scary", 203, 88, "Eastfarthing", "Village east of Brockenborings."],
    ["Bag End", 166, 99, "Hobbiton", "Smial on The Hill above Hobbiton."],
    ["Party Tree", 165, 102, "Hobbiton", "The Party Field below Bag End."],
    ["Hobbiton", 167, 111, "Hobbiton", "Village on The Water below The Hill."],
    ["Bywater", 177, 115, "Bywater", "Village beside the pool on The Water."],
    ["Frogmorton", 190, 117, "Eastfarthing", "Village on the East Road south of The Water."],
    ["Budgeford", 206, 114, "Eastfarthing", "Ford on The Water."],
    ["Stock", 223, 120, "Eastfarthing", "Village west of the Brandywine."],
    ["Little Delving", 128, 117, "Westfarthing", "Village north of Michel Delving."],
    ["Michel Delving", 139, 132, "Westfarthing", "Market town of the Westfarthing."],
    ["Waymeet", 154, 124, "Westfarthing", "Junction of the East Road and the lanes south."],
    ["Tuckborough", 168, 130, "Southfarthing", "Hill village below Hobbiton."],
    ["Woodhall", 208, 129, "Eastfarthing", "Village above Woody End."],
    ["Bamfurlong", 216, 135, "Eastfarthing", "Farm of the Marish."],
    ["Bucklebury", 233, 129, "Buckland", "Settlement across the Brandywine."],
    ["Crickhollow", 237, 122, "Buckland", "Lane north of Bucklebury."],
    ["Newbury", 232, 117, "Buckland", "Village south of the bridge."],
    ["Rushey", 241, 149, "Eastfarthing", "Marsh settlement by the Brandywine."],
    ["Deephallow", 230, 155, "Eastfarthing", "Village near the Shirebourn mouth."],
    ["Willowbottom", 209, 161, "Southfarthing", "Village beside the Shirebourn."],
    ["Wisimead", 188, 160, "Southfarthing", "Meadow village west of Willowbottom."],
    ["Pincup", 171, 150, "Southfarthing", "Village in the Green Hill Country."],
    ["Shire Homesteads", 147, 154, "Southfarthing", "Farms south of Michel Delving."],
    ["Trader’s Wharf", 240, 39, "Bree-land", "Landing on the east bank of the Brandywine."],
    ["Cotfast", 273, 29, "Bree-land", "Settlement on the Wildwood road."],
    ["Trestlebridge", 296, 9, "Bree-land", "Northern crossing beyond the Wildwood."],
    ["Hengstacer", 309, 46, "Bree-land", "Farms on the north road."],
    ["Thornley’s", 297, 76, "Bree-land", "Farms near the Everclear Lakes."],
    ["Adso’s Camp", 278, 97, "Bree-land", "Camp on the East Road west of Bree."],
    ["Bree-town", 311, 106, "Bree-land", "Town on the eastern end of the East Road."],
    ["Ost Barandor", 256, 73, "Bree-land", "Ruin in the Brandy Hills."],
    ["Ost Gorthad", 295, 146, "Bree-land", "Ruin in the Barrow-downs."],
    ["Rushock Bog", 146, 95, "Westfarthing", "Wetlands upstream from Hobbiton."],
    ["North Moors", 100, 33, "Northfarthing", "Open country above Long Cleeve."],
    ["Bindbole Wood", 169, 92, "Westfarthing", "Wooded slopes above The Hill."],
    ["Woody End", 204, 142, "Southfarthing", "Forest south of Woodhall."],
    ["Old Forest", 257, 126, "Buckland", "Woodland east of Buckland."],
    ["The Marish", 219, 143, "Eastfarthing", "Low fields west of the Brandywine."],
    ["Green Hill Country", 178, 138, "Southfarthing", "Rolling hills south of Tuckborough."],
    ["The Hill", 171, 103, "Hobbiton", "Hillside above Bag End and Bagshot Row."],
    ["Brandywine Bridge", 226, 114, "Eastfarthing", "East Road crossing north of Stock."],
  ];
  const localPlaces = [
    ["Bagshot Row", 168, 104, "Hobbiton", "Homes cut into the foot of The Hill."],
    ["Hobbiton Mill", 170, 109, "Hobbiton", "The mill and its storehouse stand just east, beside The Water."],
    ["Hobbiton Bridge", 167, 113, "Hobbiton", "Cross The Water to take the lane to Bywater."],
    ["Bywater Pool", 177, 114, "Bywater", "The landing looks north across the pool."],
    ["The Green Dragon", 180, 119, "Bywater", "The inn stands off the village lane."],
    ["Bywater Outfitter", 183, 118, "Bywater", "Buy supplies and sell your hunting loot."],
    ["Bywater Hunting Trail", 183, 122, "Bywater", "Follow the bank south and east for rats and marsh wolves."],
    ["Overhill Smial", 174, 87, "Westfarthing", "Use the blue door north of this path."],
    ["Michel Delving Market Hall", 138, 130, "Westfarthing", "Enter the stone hall on the market square."],
    ["Stock Ferry House", 221, 123, "Eastfarthing", "The ferry lane continues south past this house."],
    ["Bucklebury Ferry", 225, 129, "Eastfarthing", "Use the landing immediately east to cross the Brandywine."],
    ["Buckland Landing", 231, 129, "Buckland", "Use the landing immediately west to return to the Marish."],
    ["Lake Evendim", 166, 8, "Evendim", "The lake lies north of Annúminas."],
    ["Bree Road", 244, 106, "Bree-land", "Follow the East Road to Bree-town."],
    ["The Prancing Pony", 311, 109, "Bree-land", "Use the inn door immediately north."],
    ["Wildwood", 262, 46, "Bree-land", "Woods between Trader’s Wharf and the north road."],
    ["Barrow-downs", 282, 131, "Bree-land", "Open hills south of the East Road."],
  ];
  const landmarkRegions = new Map([...places, ...localPlaces].map(([name, , , region]) => [name, region]));
  const atlasLabels = new Set([
    "Celondim", "Gamwich", "Nobottle", "Needlehole", "Long Cleeve", "Annúminas", "Oatbarton", "Brockenborings",
    "Overhill", "Hobbiton", "Bywater", "Frogmorton", "Budgeford", "Stock", "Michel Delving", "Waymeet", "Tuckborough",
    "Woodhall", "Bucklebury", "Willowbottom", "Trader’s Wharf", "Trestlebridge", "Bree-town", "Rushock Bog", "Woody End",
    "Old Forest", "The Marish", "North Moors", "Barrow-downs", "Lake Evendim",
  ]);
  const labelOffsets = {
    Hobbiton: [-4, -9], Bywater: [-4, 17], Frogmorton: [-4, 16], Budgeford: [-9, -8],
    Stock: [-7, 17], Bucklebury: [6, 13], Waymeet: [-8, 17], "Michel Delving": [-6, 16],
    "Rushock Bog": [-2, -8], Overhill: [-7, 15], "Lake Evendim": [3, -10],
  };
  const waterLabels = [
    ["Lune", 7, 116, -1.32], ["The Water", 122, 80, .55], ["Norbourn", 177, 74, 1.29],
    ["Brandywine", 227, 85, 1.43], ["Shirebourn", 187, 176, -.08], ["Withywindle", 260, 136, -.42],
  ];
  const actors = [
    ["start", 167, 109], ["gardener", 164, 107], ["miller", 173, 110], ["merchant", 183, 117],
    ["wolf", 174, 95], ["bankRat", 185, 123], ["bankRat", 188, 125], ["marshWolf", 192, 127],
  ];
  const ferries = [[226, 129], [230, 129]];

  // Map old surface positions around corresponding villages and keep the interior grids.
  const migrationAnchors = [
    [47, 49, 166, 99], [41, 54, 165, 102], [47, 54, 167, 109], [54, 49, 168, 103],
    [59, 55, 172, 110], [64, 69, 177, 115], [65, 68, 178, 113], [69, 67, 180, 118],
    [71, 70, 183, 118], [78, 70, 183, 122], [80, 72, 185, 123], [83, 75, 188, 125],
    [87, 76, 192, 127], [76, 45, 174, 95], [56, 31, 175, 89], [52, 28, 174, 86],
    [19, 85, 139, 132], [16, 81, 138, 129], [42, 77, 154, 124], [60, 85, 168, 130],
    [31, 40, 131, 86], [21, 35, 108, 80], [27, 9, 112, 43], [72, 29, 190, 84],
    [78, 15, 196, 52], [85, 34, 203, 88], [82, 67, 190, 117], [91, 58, 206, 114],
    [104, 68, 223, 120], [100, 72, 221, 122], [112, 65, 226, 114], [124, 62, 244, 106],
    [110, 81, 226, 129], [116, 81, 230, 129], [120, 80, 233, 129], [123, 86, 257, 126],
    [105, 88, 219, 143], [86, 83, 208, 129], [68, 93, 171, 150], [101, 94, 209, 161],
  ];
  const previousSpawns = {
    "0:76,45:wolf": "0:174,95:wolf", "0:80,72:bankRat": "0:185,123:bankRat",
    "0:83,75:bankRat": "0:188,125:bankRat", "0:87,76:marshWolf": "0:192,127:marshWolf",
  };

  function moveOldSave(progress, revision) {
    if (!progress?.creatures || !Array.isArray(progress.loot)) return progress;
    const recent = revision === regionalRevision;
    const move = point => {
      if (point?.z !== 0 || !Number.isInteger(point.x) || !Number.isInteger(point.y)) return point;
      const x = point.x + (recent ? 0 : 24);
      const y = point.y + (recent ? 0 : 37);
      let distance = Infinity;
      let nearest;
      for (const anchor of migrationAnchors) {
        const steps = (x - anchor[0]) ** 2 + (y - anchor[1]) ** 2;
        if (steps < distance) {
          distance = steps;
          nearest = anchor;
        }
      }
      const [oldX, oldY, newX, newY] = nearest;
      return { ...point, x: newX + x - oldX, y: newY + y - oldY };
    };
    const creatures = Object.fromEntries(Object.entries(progress.creatures).map(([id, point]) => {
      const shifted = recent ? id : id.replace(/^0:(\d+),(\d+):/, (_, x, y) => "0:" + (Number(x) + 24) + "," + (Number(y) + 37) + ":");
      return [previousSpawns[shifted] ?? id, move(point)];
    }));
    return { ...progress, creatures, player: move(progress.player), loot: progress.loot.map(move) };
  }

  function create() {
    const map = { version: 1, name: "The Shire and Its Neighbours", width, height, adventure: "shire", floors: [] };
    const surface = World.makeFloor(map, 0, "Surface", "grass");
    map.floors.push(surface);
    const key = World.key;
    const get = (x, y) => surface.ground[World.index(map, x, y)];
    const set = (x, y, type, floor = surface) => { floor.ground[World.index(map, x, y)] = type; };
    const object = (x, y, type, floor = surface) => { floor.objects[key(x, y)] = type; };
    const clear = (x, y) => { delete surface.objects[key(x, y)]; };
    const marker = (x, y, type, fields = {}, floor = surface) => { floor.markers[key(x, y)] = { type, ...fields }; };
    const wet = type => type === "water" || type === "river";
    const noise = (x, y) => ((Math.imul(x + 13, 73856093) ^ Math.imul(y + 97, 19349663)) >>> 0) % 101;

    function ellipse(cx, cy, rx, ry, paint) {
      for (let y = Math.max(0, cy - ry); y <= Math.min(height - 1, cy + ry); y++) {
        for (let x = Math.max(0, cx - rx); x <= Math.min(width - 1, cx + rx); x++) {
          const edge = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
          if (edge < .88 + noise(x, y) / 430) paint(x, y);
        }
      }
    }

    function stroke(points, paint, connectCorners = false) {
      for (let i = 1; i < points.length; i++) {
        const [x1, y1] = points[i - 1];
        const [x2, y2] = points[i];
        const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
        let lastY = y1;
        for (let step = 0; step <= steps; step++) {
          const x = Math.round(x1 + (x2 - x1) * step / steps);
          const y = Math.round(y1 + (y2 - y1) * step / steps);
          if (connectCorners && lastY !== y) paint(x, lastY);
          paint(x, y);
          lastY = y;
        }
      }
    }

    function channel(points, radius) {
      stroke(points, (x, y) => {
        for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) + Math.abs(dy) <= radius && World.inside(map, x + dx, y + dy)) set(x + dx, y + dy, "river");
        }
      });
    }

    // Blue Mountains and moors, then the hills and forests on either side of the Shire.
    for (const [x, y, rx, ry] of [[26, 13, 36, 30], [66, 21, 47, 26], [104, 30, 31, 18], [141, 15, 27, 20],
      [95, 115, 32, 19], [180, 140, 33, 17], [290, 139, 24, 25], [257, 78, 21, 12]]) {
      ellipse(x, y, rx, ry, (px, py) => set(px, py, "heath"));
    }
    for (const [x, y, rx, ry, tree] of [[35, 65, 24, 22, "pine"], [168, 94, 15, 12, "tree"],
      [202, 143, 16, 18, "tree"], [253, 51, 28, 22, "pine"], [253, 120, 18, 15, "tree"], [258, 143, 24, 23, "tree"]]) {
      ellipse(x, y, rx, ry, (px, py) => {
        set(px, py, "meadow");
        if (noise(px, py) < 31) object(px, py, tree);
        else if (noise(px, py) < 41) object(px, py, "shrub");
      });
    }
    for (const [x, y, rx, ry] of [[146, 95, 12, 10], [219, 144, 12, 16], [245, 164, 12, 12], [188, 116, 8, 7]]) {
      ellipse(x, y, rx, ry, (px, py) => set(px, py, noise(px, py) < 13 ? "water" : "marsh"));
    }

    // The Lune separates the western coast, The Water crosses the Shire, and the Brandywine drains south.
    channel([[33, 0], [31, 16], [27, 27], [23, 34], [16, 45], [13, 52], [10, 64], [13, 75],
      [12, 86], [9, 101], [10, 114], [7, 130], [6, 147], [4, 158], [8, 179]], 2);
    channel([[49, 34], [46, 53], [43, 59], [28, 64], [12, 65]], 1);
    channel([[60, 37], [59, 53], [51, 61], [30, 64]], 1);
    for (let y = 92; y < height; y++) for (let x = 0; x <= Math.floor((y - 89) / 6); x++) set(x, y, "water");

    ellipse(161, 1, 15, 7, (x, y) => set(x, y, "water"));
    ellipse(182, 2, 15, 6, (x, y) => set(x, y, "water"));
    channel([[244, 0], [242, 20], [240, 34], [231, 45], [224, 51], [221, 61], [223, 75],
      [220, 86], [224, 99], [226, 114], [226, 127], [228, 139], [232, 145], [247, 152], [258, 163], [261, 179]], 3);
    channel([[127, 17], [121, 30], [117, 44], [114, 57], [112, 70], [113, 79], [122, 83],
      [132, 88], [143, 94], [153, 96], [159, 103], [160, 108], [166, 111], [177, 113],
      [187, 114], [196, 116], [206, 115], [214, 116], [225, 114]], 1);
    channel([[77, 26], [76, 41], [81, 53], [86, 66], [96, 73], [104, 75], [113, 79]], 1);
    ellipse(179, 113, 4, 3, (x, y) => set(x, y, "river"));
    channel([[164, 35], [163, 47], [166, 55], [173, 61], [177, 67], [180, 79], [181, 89],
      [182, 100], [179, 112]], 1);
    ellipse(172, 61, 4, 6, (x, y) => set(x, y, "river"));
    channel([[93, 93], [105, 96], [110, 103], [123, 108], [130, 118], [138, 118], [140, 108], [146, 98]], 1);
    channel([[174, 149], [176, 158], [180, 168], [188, 173], [201, 172], [211, 166], [216, 158], [227, 153], [239, 153]], 1);
    channel([[190, 147], [192, 156], [201, 160], [209, 162], [215, 162]], 1);
    channel([[198, 139], [202, 135], [203, 131], [214, 128], [221, 122], [226, 122]], 1);
    channel([[271, 127], [262, 132], [255, 136], [246, 140], [234, 143]], 1);
    ellipse(267, 60, 4, 8, (x, y) => set(x, y, "water"));
    for (const [x, y] of [[284, 73], [289, 77], [285, 83], [212, 95]]) {
      ellipse(x, y, 3, 2, (px, py) => set(px, py, "water"));
    }

    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const type = get(x, y);
      const roll = noise(x, y);
      if (wet(type)) clear(x, y);
      else if (type === "marsh" && roll < 35) object(x, y, "reeds");
      else if (type === "heath" && roll < 8) object(x, y, "rock");
      else if (type === "grass" && roll < 3) object(x, y, "tree");
      else if (type === "grass" && roll > 95) object(x, y, "flowers");
    }

    function road(points, wide = false) {
      stroke(points, (x, y) => {
        for (let lane = 0; lane <= Number(wide); lane++) {
          if (!World.inside(map, x, y + lane)) continue;
          const type = get(x, y + lane);
          set(x, y + lane, wet(type) || type === "bridge" ? "bridge" : "path");
          clear(x, y + lane);
        }
      }, true);
    }

    // East Road, the older northern road through Nobottle, and the lanes of the Farthings.
    road([[57, 141], [88, 139], [111, 137], [130, 132], [139, 132], [148, 129], [154, 124], [165, 122],
      [176, 119], [186, 119], [190, 117], [198, 119], [210, 119], [221, 117], [226, 114], [236, 112],
      [245, 105], [258, 101], [268, 96], [278, 97], [292, 99], [307, 102], [311, 106]], true);
    road([[9, 62], [14, 63], [18, 64], [20, 73], [16, 81], [13, 90]]);
    road([[16, 40], [15, 50], [12, 58], [9, 62]]);
    road([[16, 40], [24, 34], [35, 25]]);
    road([[18, 64], [27, 68], [35, 65], [44, 68], [56, 67], [64, 71], [72, 69], [79, 74], [91, 76], [108, 80]]);
    road([[79, 74], [73, 66], [74, 59], [78, 55]]);
    road([[108, 80], [110, 72], [113, 65], [112, 54], [112, 43]]);
    road([[108, 80], [115, 78], [123, 84], [131, 86], [143, 92], [150, 98], [153, 109],
      [153, 117], [154, 124]]);
    road([[108, 80], [112, 92], [120, 100], [128, 117], [135, 124], [139, 132]]);
    road([[117, 74], [128, 72], [136, 64], [146, 57], [160, 59], [166, 56], [175, 58],
      [186, 55], [196, 52], [205, 47], [217, 43], [220, 36]]);
    road([[196, 52], [191, 49], [186, 47], [181, 41], [181, 31], [177, 23], [172, 16], [166, 8]]);
    road([[196, 52], [191, 62], [193, 74], [190, 84], [182, 84], [175, 89], [174, 95], [171, 100], [168, 104], [167, 109]]);
    road([[190, 84], [196, 85], [203, 88], [204, 98], [206, 114], [207, 119]]);
    road([[165, 106], [166, 103], [166, 99]]);
    road([[164, 106], [164, 109], [167, 109], [172, 109], [173, 110]]);
    road([[167, 109], [167, 113], [171, 116], [177, 115], [180, 116], [183, 118], [183, 122]]);
    road([[176, 119], [177, 115]]);
    road([[183, 122], [186, 123], [189, 125], [192, 127]]);
    road([[168, 121], [167, 125], [168, 130], [174, 129], [182, 132], [194, 129], [208, 129],
      [216, 126], [223, 120]]);
    road([[154, 124], [150, 137], [151, 146], [147, 154], [156, 153], [165, 155], [171, 150]]);
    road([[168, 130], [172, 139], [171, 150], [177, 156], [188, 160], [199, 161], [209, 161],
      [219, 155], [230, 155], [232, 154], [237, 153], [241, 149]]);
    road([[223, 120], [223, 123], [225, 129], [221, 135], [219, 143], [221, 151], [230, 155]]);
    road([[208, 129], [216, 135], [219, 143]]);
    road([[232, 112], [232, 117], [237, 122], [233, 129], [231, 129]]);
    road([[233, 129], [239, 126], [249, 124], [257, 126]]);
    road([[278, 97], [288, 86], [297, 76], [297, 65], [293, 49], [295, 36], [295, 21], [296, 9]]);
    road([[293, 49], [300, 50], [309, 46]]);
    road([[295, 21], [284, 21], [273, 29], [266, 36], [258, 44], [247, 44], [240, 39]]);
    road([[258, 44], [256, 54], [250, 59], [256, 73]]);
    road([[311, 106], [309, 118], [301, 127], [295, 146], [301, 155]]);
    road([[286, 103], [283, 117], [282, 131], [289, 136], [295, 146]]);

    function field(x, y, columns, rows) {
      for (let dy = 0; dy < rows; dy++) for (let dx = 0; dx < columns; dx++) {
        const tile = get(x + dx, y + dy);
        if (tile !== "grass" && tile !== "meadow" && tile !== "marsh") continue;
        clear(x + dx, y + dy);
        set(x + dx, y + dy, dy % 2 ? "soil" : "crop");
      }
    }
    for (const [x, y, columns, rows] of [[82, 72, 6, 4], [183, 42, 6, 4], [199, 50, 8, 5],
      [194, 75, 6, 4], [147, 115, 5, 6], [161, 116, 4, 5], [173, 122, 6, 4], [188, 120, 5, 3],
      [204, 121, 7, 4], [214, 136, 5, 5], [136, 150, 6, 5], [143, 156, 6, 4], [302, 44, 6, 4],
      [299, 77, 5, 5], [304, 96, 6, 4]]) field(x, y, columns, rows);

    function building(x, y, span, wall, roof) {
      for (let dy = -2; dy <= 0; dy++) for (let dx = -span; dx <= span; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (wet(get(px, py)) || get(px, py) === "bridge") continue;
        set(px, py, "stone");
        let type = roof;
        if (dy === 0) type = dx === 0 ? "door" : Math.abs(dx) === 1 ? (wall === "wall" ? "stoneWindow" : "cottageWindow") : wall;
        if (dy === -2 && dx === span - 1) type = roof === "thatch" ? "thatchChimney" : "tileChimney";
        object(px, py, type);
      }
      if (!wet(get(x, y + 1))) {
        set(x, y + 1, "stone");
        clear(x, y + 1);
      }
    }
    function smial(x, y, type) {
      ellipse(x, y - 1, 3, 2, (px, py) => {
        if (get(px, py) === "grass" || get(px, py) === "heath") set(px, py, "meadow");
        if (!wet(get(px, py))) clear(px, py);
      });
      object(x, y, type);
    }

    for (const [x, y, type] of [[166, 99, "smial"], [170, 103, "smialRed"], [167, 103, "smialBlue"],
      [160, 104, "smialRed"], [163, 106, "smialBlue"], [174, 86, "smialBlue"], [178, 86, "smialRed"],
      [171, 88, "smial"], [107, 77, "smialBlue"], [105, 82, "smial"], [129, 84, "smialRed"], [134, 86, "smialBlue"],
      [110, 41, "smial"], [114, 43, "smialBlue"], [76, 54, "smialRed"], [77, 72, "smialBlue"], [127, 114, "smial"],
      [129, 119, "smialRed"], [156, 123, "smialBlue"], [166, 129, "smialRed"], [170, 127, "smial"],
      [169, 133, "smialBlue"], [169, 148, "smial"], [173, 147, "smialBlue"], [206, 128, "smialRed"]]) smial(x, y, type);
    for (const [x, y, span, wall, roof] of [
      [172, 110, 2, "wall", "roof"], [180, 118, 2, "timber", "roof"], [184, 116, 1, "timber", "thatch"],
      [174, 118, 1, "timber", "thatch"], [138, 129, 3, "wall", "roof"], [133, 131, 1, "wall", "roof"],
      [142, 135, 2, "timber", "thatch"], [136, 136, 1, "timber", "thatch"], [193, 51, 1, "timber", "thatch"],
      [198, 55, 2, "timber", "thatch"], [187, 45, 1, "timber", "thatch"], [220, 37, 1, "timber", "thatch"],
      [188, 82, 1, "timber", "thatch"], [192, 86, 1, "timber", "thatch"], [205, 87, 1, "timber", "thatch"],
      [191, 119, 1, "timber", "thatch"], [205, 112, 1, "timber", "thatch"], [209, 117, 1, "timber", "thatch"],
      [221, 122, 1, "timber", "thatch"], [219, 119, 1, "timber", "thatch"], [234, 126, 1, "timber", "thatch"],
      [236, 131, 1, "timber", "thatch"], [235, 119, 1, "timber", "thatch"], [216, 134, 2, "timber", "thatch"],
      [218, 142, 1, "timber", "thatch"], [209, 159, 1, "timber", "thatch"], [185, 159, 1, "timber", "thatch"],
      [240, 148, 1, "timber", "thatch"], [230, 157, 1, "timber", "thatch"], [147, 152, 2, "timber", "thatch"],
      [9, 59, 2, "wall", "roof"], [19, 71, 2, "wall", "roof"], [16, 91, 2, "wall", "roof"],
      [18, 38, 2, "wall", "roof"], [34, 23, 1, "wall", "roof"], [243, 39, 1, "timber", "thatch"],
      [274, 26, 1, "timber", "thatch"], [296, 11, 2, "timber", "roof"], [309, 44, 2, "timber", "thatch"],
      [298, 73, 1, "timber", "thatch"], [277, 95, 1, "timber", "thatch"],
      [309, 103, 2, "wall", "roof"], [311, 108, 3, "timber", "roof"], [315, 102, 2, "wall", "roof"], [315, 110, 1, "wall", "roof"],
    ]) building(x, y, span, wall, roof);

    for (const [x, y, type] of [[165, 101, "partyTree"], [164, 102, "bunting"], [163, 102, "table"],
      [164, 103, "bench"], [173, 111, "millWheel"], [171, 111, "barrel"], [179, 120, "bench"],
      [181, 120, "table"], [182, 120, "basket"], [137, 132, "bunting"], [138, 133, "table"],
      [140, 131, "barrel"], [142, 132, "basket"], [183, 116, "lamp"], [222, 123, "barrel"],
      [224, 124, "bench"], [235, 128, "fence"], [237, 128, "fence"], [308, 106, "lamp"],
      [313, 105, "barrel"], [310, 106, "bunting"], [160, 110, "appleTree"], [161, 108, "appleTree"],
      [158, 107, "appleTree"], [157, 109, "appleTree"], [161, 106, "hedge"], [162, 106, "hedge"]]) {
      if (!wet(get(x, y))) object(x, y, type);
    }
    for (const [cx, cy] of [[177, 23], [256, 73], [295, 146]]) {
      ellipse(cx, cy, 4, 3, (x, y) => {
        if (wet(get(x, y))) return;
        set(x, y, "stone");
        if (y === cy - 2 || x === cx - 3 || (x === cx + 3 && y < cy)) object(x, y, "wall");
        else if (noise(x, y) < 20) object(x, y, "rock");
        else clear(x, y);
      });
    }

    function open(x, y, ground) {
      if (!World.passable(map, surface, x, y)) {
        if (wet(get(x, y))) set(x, y, "bridge");
        else clear(x, y);
      }
      if (ground && !wet(get(x, y)) && get(x, y) !== "bridge") set(x, y, ground);
    }

    for (const [name, x, y, , description] of [...places, ...localPlaces]) {
      open(x, y);
      marker(x, y, "notice", { text: name + " · " + description });
    }
    for (const [type, x, y] of actors) {
      open(x, y);
      marker(x, y, type);
    }
    // Preserve the bridge approaches, ferry lanes, and narrow waterside streets after placing buildings.
    road([[212, 119], [217, 118], [223, 116], [226, 114], [236, 112]], true);
    road([[222, 117], [224, 119], [224, 124], [225, 129], [226, 129]]);
    road([[230, 129], [231, 129], [233, 129], [235, 130]]);
    road([[167, 109], [170, 109], [171, 109], [172, 110]]);
    road([[177, 115], [177, 114]]);
    road([[221, 151], [225, 153], [230, 155]]);
    for (const [x, y] of ferries) open(x, y, "bridge");
    const [west, east] = ferries;
    marker(...west, "link", { x: east[0], y: east[1], z: 0 });
    marker(...east, "link", { x: west[0], y: west[1], z: 0 });

    addInteriors();
    return World.validate(map);

    function addInteriors() {
      // Keep the original interior coordinates so older characters and quest loot still load.
      const rooms = [
        [-1, "Bag End", [166, 99], [23, 12], [17, 5, 29, 13], "wood", [
          [19, 7, "bed"], [18, 8, "chest"], [23, 7, "hearth"], [24, 9, "table"], [22, 9, "bench"],
          [23, 10, "rug"], [23, 11, "rug"], [27, 7, "table"], [28, 8, "barrel"], [28, 9, "basket"], [18, 11, "lamp"],
          ...[6, 7, 8, 11, 12].map(y => [21, y, "sideTimber"]), ...[6, 7, 8, 9, 12].map(y => [26, y, "sideTimber"]),
        ]],
        [-2, "Mill Storehouse", [172, 110], [35, 14], [30, 13, 41, 23], "wood", [
          [31, 14, "barrel"], [31, 17, "barrel"], [39, 16, "barrel"], [39, 17, "barrel"], [39, 20, "barrel"],
          [32, 18, "lamp"], [40, 21, "chest"],
        ]],
        [-3, "The Green Dragon", [180, 118], [45, 30], [40, 23, 50, 31], "wood", [
          [43, 25, "table"], [47, 25, "table"], [43, 28, "table"], [48, 28, "table"], [41, 25, "barrel"],
          [45, 24, "hearth"], [45, 27, "rug"], [45, 28, "rug"], [49, 25, "basket"],
        ]],
        [-4, "Bagshot Row Cottage", [168, 103], [30, 12], [25, 6, 35, 13], "wood", [
          [27, 8, "bed"], [30, 8, "hearth"], [32, 9, "table"], [33, 9, "bench"], [30, 11, "rug"],
        ]],
        [-5, "Overhill Smial", [174, 86], [10, 12], [6, 6, 14, 12], "wood", [
          [8, 8, "bed"], [9, 8, "chest"], [12, 7, "hearth"], [10, 9, "rug"], [12, 10, "table"],
        ]],
        [-6, "Michel Delving Market Hall", [138, 129], [10, 12], [6, 6, 14, 12], "stone", [
          [8, 8, "table"], [9, 8, "table"], [11, 8, "table"], [12, 8, "table"], [8, 9, "basket"], [12, 9, "chest"], [7, 10, "barrel"],
        ]],
        [-7, "Stock Ferry House", [221, 122], [10, 12], [6, 6, 14, 12], "wood", [
          [7, 8, "barrel"], [7, 9, "barrel"], [8, 8, "chest"], [12, 7, "hearth"], [12, 9, "table"], [12, 10, "bench"],
        ]],
        [-8, "The Prancing Pony", [311, 108], [10, 12], [5, 5, 16, 12], "wood", [
          [7, 7, "hearth"], [7, 10, "barrel"], [9, 7, "table"], [9, 8, "bench"], [13, 7, "table"],
          [13, 8, "bench"], [14, 10, "table"], [11, 10, "rug"],
        ]],
      ];
      for (const [z, name, door, entrance, bounds, material, furniture] of rooms) {
        const floor = World.makeFloor(map, z, name, "void");
        map.floors.push(floor);
        const [x1, y1, x2, y2] = bounds;
        for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) {
          set(x, y, material, floor);
          if (x === x1 || x === x2 || y === y1 || y === y2) {
            object(x, y, material === "stone" ? "wall" : x === x1 || x === x2 ? "sideTimber" : "timber", floor);
          }
        }
        for (const [x, y, type] of furniture) object(x, y, type, floor);
        const [x, y] = door;
        const [ex, ey] = entrance;
        delete floor.objects[key(ex, ey)];
        open(x, y, "stone");
        if (![-1, -4, -5].includes(z)) object(x, y, "door");
        if (z === -4) object(x, y, "smialBlue");
        marker(x, y, "link", { x: ex, y: ey, z });
        marker(ex, ey, "link", { x, y, z: 0 }, floor);
        if (z === -2) {
          marker(35, 17, "rat", {}, floor);
          marker(37, 20, "rat", {}, floor);
          marker(39, 21, "ledger", {}, floor);
        }
      }
    }
  }

  function landmarkRegion(name) {
    return landmarkRegions.get(name) ?? "Other landmarks";
  }

  function ferryAt(x, y) {
    return ferries.some(([fx, fy]) => fx === x && fy === y);
  }

  function nearbyFerry({ x, y }) {
    return ferries.find(([fx, fy]) => y === fy && Math.abs(x - fx) <= 1);
  }

  return { create, previousRevisions, moveOldSave, landmarkRegion, atlasLabels, labelOffsets, waterLabels, ferryAt, nearbyFerry };
})();
