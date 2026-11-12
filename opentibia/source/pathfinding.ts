export interface PathNode {
  x: number;
  y: number;
}

interface OpenPathNode extends PathNode {
  g: number;
  f: number;
}

const NEIGHBORS = [
  { dx: 0, dy: -1 }, // North
  { dx: 1, dy: 0 },  // East
  { dx: 0, dy: 1 },  // South
  { dx: -1, dy: 0 }, // West
];

// Arda supports maps up to 128 tiles across and paths around their perimeter.
const MAX_PATH_LENGTH = 512;

function manhattanDistance(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/**
 * A* pathfinding on the tile grid.
 * Returns an array of tile positions from start (exclusive) to goal (inclusive),
 * or null if no path is found.
 */
export function findPath(
  startX: number, startY: number,
  goalX: number, goalY: number,
  isWalkable: (x: number, y: number) => boolean,
  isFloorChange: (x: number, y: number) => boolean,
): PathNode[] | null {
  if (startX === goalX && startY === goalY) return [];

  if (!isWalkable(goalX, goalY)) return null;

  const openSet = new Map<string, OpenPathNode>();
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();

  const startKey = `${startX}:${startY}`;
  const goalKey = `${goalX}:${goalY}`;

  gScore.set(startKey, 0);
  openSet.set(startKey, {
    x: startX, y: startY,
    g: 0,
    f: manhattanDistance(startX, startY, goalX, goalY),
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
      // Floor-change tiles are reachable as a destination but A* must
      // not route *through* them — otherwise a stair on a same-floor
      // path would teleport the walker mid-route. Matches TFS
      // Tile::queryAdd, which returns RETURNVALUE_NOTPOSSIBLE for
      // floor-change tiles when FLAG_PATHFINDING is set.
      if (neighborKey !== goalKey && isFloorChange(nx, ny)) continue;

      const tentativeG = current.g + 1;

      if (tentativeG > MAX_PATH_LENGTH) continue;

      const prevG = gScore.get(neighborKey);
      if (prevG !== undefined && tentativeG >= prevG) continue;

      gScore.set(neighborKey, tentativeG);
      cameFrom.set(neighborKey, currentKey);

      openSet.set(neighborKey, {
        x: nx, y: ny,
        g: tentativeG,
        f: tentativeG + manhattanDistance(nx, ny, goalX, goalY),
      });
    }
  }

  return null;
}

function takeLowestCostNode(openSet: Map<string, OpenPathNode>): [string, OpenPathNode] {
  let bestKey = '';
  let bestNode: OpenPathNode | null = null;

  for (const [key, node] of openSet) {
    if (!bestNode || node.f < bestNode.f) {
      bestKey = key;
      bestNode = node;
    }
  }

  if (!bestNode) {
    throw new Error('cannot take a path node from an empty open set');
  }

  openSet.delete(bestKey);
  return [bestKey, bestNode];
}

function reconstructPath(
  cameFrom: Map<string, string>,
  goalKey: string,
  startKey: string,
): PathNode[] {
  const path: PathNode[] = [];
  let current = goalKey;

  while (current !== startKey) {
    const [x, y] = current.split(':').map(Number);
    path.unshift({ x, y });
    const prev = cameFrom.get(current);
    if (!prev) break;
    current = prev;
  }

  return path;
}
