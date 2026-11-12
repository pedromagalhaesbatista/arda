var OpenTibia = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // opentibia/source/runtime.ts
  var runtime_exports = {};
  __export(runtime_exports, {
    Direction: () => Direction,
    TILE_SIZE: () => TILE_SIZE,
    WALK_DURATION_MS: () => WALK_DURATION_MS,
    directionFromStepDelta: () => directionFromStepDelta,
    findPath: () => findPath,
    spriteIndex: () => spriteIndex
  });

  // opentibia/source/constants.ts
  var TILE_SIZE = 32;

  // opentibia/source/pathfinding.ts
  var NEIGHBORS = [
    { dx: 0, dy: -1 },
    // North
    { dx: 1, dy: 0 },
    // East
    { dx: 0, dy: 1 },
    // South
    { dx: -1, dy: 0 }
    // West
  ];
  var MAX_PATH_LENGTH = 512;
  function manhattanDistance(ax, ay, bx, by) {
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }
  function findPath(startX, startY, goalX, goalY, isWalkable, isFloorChange) {
    if (startX === goalX && startY === goalY) return [];
    if (!isWalkable(goalX, goalY)) return null;
    const openSet = /* @__PURE__ */ new Map();
    const cameFrom = /* @__PURE__ */ new Map();
    const gScore = /* @__PURE__ */ new Map();
    const startKey = `${startX}:${startY}`;
    const goalKey = `${goalX}:${goalY}`;
    gScore.set(startKey, 0);
    openSet.set(startKey, {
      x: startX,
      y: startY,
      g: 0,
      f: manhattanDistance(startX, startY, goalX, goalY)
    });
    while (openSet.size > 0) {
      const [currentKey, current] = takeLowestCostNode(openSet);
      if (currentKey === goalKey) {
        return reconstructPath(cameFrom, goalKey, startKey);
      }
      for (const { dx, dy } of NEIGHBORS) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const neighborKey = `${nx}:${ny}`;
        if (!isWalkable(nx, ny)) continue;
        if (neighborKey !== goalKey && isFloorChange(nx, ny)) continue;
        const tentativeG = current.g + 1;
        if (tentativeG > MAX_PATH_LENGTH) continue;
        const prevG = gScore.get(neighborKey);
        if (prevG !== void 0 && tentativeG >= prevG) continue;
        gScore.set(neighborKey, tentativeG);
        cameFrom.set(neighborKey, currentKey);
        openSet.set(neighborKey, {
          x: nx,
          y: ny,
          g: tentativeG,
          f: tentativeG + manhattanDistance(nx, ny, goalX, goalY)
        });
      }
    }
    return null;
  }
  function takeLowestCostNode(openSet) {
    let bestKey = "";
    let bestNode = null;
    for (const [key, node] of openSet) {
      if (!bestNode || node.f < bestNode.f) {
        bestKey = key;
        bestNode = node;
      }
    }
    if (!bestNode) {
      throw new Error("cannot take a path node from an empty open set");
    }
    openSet.delete(bestKey);
    return [bestKey, bestNode];
  }
  function reconstructPath(cameFrom, goalKey, startKey) {
    const path = [];
    let current = goalKey;
    while (current !== startKey) {
      const [x, y] = current.split(":").map(Number);
      path.unshift({ x, y });
      const prev = cameFrom.get(current);
      if (!prev) break;
      current = prev;
    }
    return path;
  }

  // opentibia/source/player.ts
  var Direction = {
    North: 0,
    East: 1,
    South: 2,
    West: 3
  };
  function directionFromStepDelta(dx, dy, fallback) {
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return fallback;
    if (dx > 0) return Direction.East;
    if (dx < 0) return Direction.West;
    if (dy > 0) return Direction.South;
    if (dy < 0) return Direction.North;
    return fallback;
  }

  // opentibia/source/spriteLayout.ts
  function spriteIndex(fg, phase, patX, patY, layer, h, w) {
    const yComponent = phase * fg.numPatternZ * fg.numPatternY + patY;
    const xyComponent = yComponent * fg.numPatternX + patX;
    return ((xyComponent * fg.layers + layer) * fg.height + h) * fg.width + w;
  }

  // opentibia/source/walkAnimation.ts
  var WALK_DURATION_MS = 200;
  return __toCommonJS(runtime_exports);
})();
