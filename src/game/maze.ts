import {
  AltarEntity,
  CountSetting,
  DX,
  DY,
  GridPoint,
  MazeSize,
  MonsterEntity,
  MonsterType,
} from './types';

export const MONSTER_TYPES: MonsterType[] = [
  'slime',
  'skeleton',
  'bat',
  'ghost',
  'eyeball',
  'mushroom',
  'golem',
  'spider',
  'flame',
  'snake',
];

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface GeneratedMaze {
  size: MazeSize;
  map: number[][];
  startPos: GridPoint;
  goalPos: GridPoint;
  altars: AltarEntity[];
  monsters: MonsterEntity[];
  openCellCount: number;
}

/**
 * 100% 確保連通的完美迷宮生成（遞迴回溯 + BFS 尋找最遠死巷終點）
 */
export function generateMazeRun(size: MazeSize, counts: CountSetting): GeneratedMaze {
  const map: number[][] = Array.from({ length: size }, () => Array<number>(size).fill(1));
  const startX = 1;
  const startY = 1;

  function carve(cx: number, cy: number) {
    map[cy][cx] = 0;
    const dirs = shuffle([
      { x: 0, y: -2 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
      { x: -2, y: 0 },
    ]);
    for (const d of dirs) {
      const nx = cx + d.x;
      const ny = cy + d.y;
      if (nx > 0 && nx < size - 1 && ny > 0 && ny < size - 1 && map[ny][nx] === 1) {
        map[cy + d.y / 2][cx + d.x / 2] = 0;
        carve(nx, ny);
      }
    }
  }

  carve(startX, startY);
  const startPos: GridPoint = { x: startX, y: startY };

  // BFS 計算各格到起點的實際步數
  const dist: number[][] = Array.from({ length: size }, () => Array<number>(size).fill(-1));
  const queue: GridPoint[] = [{ x: startX, y: startY }];
  dist[startY][startX] = 0;
  const nb: Array<[number, number]> = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];

  const openCount = (x: number, y: number) =>
    nb.filter(([ox, oy]) => map[y + oy] && map[y + oy][x + ox] === 0).length;

  while (queue.length) {
    const c = queue.shift()!;
    for (const [ox, oy] of nb) {
      const nx = c.x + ox;
      const ny = c.y + oy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size && map[ny][nx] === 0 && dist[ny][nx] < 0) {
        dist[ny][nx] = dist[c.y][c.x] + 1;
        queue.push({ x: nx, y: ny });
      }
    }
  }

  // 終點：離起點最遠的死巷（只有一個出口）
  let maxDist = -1;
  let bestGoal: GridPoint = { x: startX, y: startY };
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      if (map[y][x] === 0 && !(x === startX && y === startY) && openCount(x, y) === 1) {
        if (dist[y][x] > maxDist) {
          maxDist = dist[y][x];
          bestGoal = { x, y };
        }
      }
    }
  }
  const goalPos = bestGoal;
  map[startPos.y][startPos.x] = 0;
  map[goalPos.y][goalPos.x] = 0;

  // 收集可放置實體的通道格
  const open: GridPoint[] = [];
  let openCellCount = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (map[y][x] !== 0) continue;
      openCellCount++;
      if (x === startPos.x && y === startPos.y) continue;
      if (x === goalPos.x && y === goalPos.y) continue;
      open.push({ x, y });
    }
  }

  shuffle(open);
  const altars: AltarEntity[] = open
    .splice(0, Math.min(counts.altars, open.length))
    .map((c, id) => ({ id, x: c.x, y: c.y, lit: false }));

  const far = open.filter((c) => Math.abs(c.x - startPos.x) + Math.abs(c.y - startPos.y) >= 4);
  const pool = far.length >= counts.monsters ? far : open;
  const types = shuffle([...MONSTER_TYPES]);
  const monsters: MonsterEntity[] = pool.slice(0, counts.monsters).map((c, i) => ({
    id: i,
    type: types[i % types.length],
    x: c.x,
    y: c.y,
    px: -1,
    py: -1,
    fromX: c.x,
    fromY: c.y,
    moveStart: 0,
    seed: i * 1.7,
  }));

  return { size, map, startPos, goalPos, altars, monsters, openCellCount };
}

/**
 * 怪物沿通道隨機走一格，盡量不回頭（死巷才回頭），不與其他怪物重疊
 */
export function stepMonsters(
  monsters: MonsterEntity[],
  map: number[][],
  size: number,
  playerPos: GridPoint,
  now: number,
): { nextMonsters: MonsterEntity[]; hitMonster: MonsterEntity | null } {
  const occupied = new Set<number>(monsters.map((m) => m.y * size + m.x));
  let hitMonster: MonsterEntity | null = null;

  const nextMonsters = monsters.map((m) => {
    const opts: Array<[number, number]> = [];
    for (let d = 0; d < 4; d++) {
      const nx = m.x + DX[d];
      const ny = m.y + DY[d];
      if (nx < 0 || ny < 0 || nx >= size || ny >= size || map[ny][nx] !== 0) continue;
      if (occupied.has(ny * size + nx)) continue;
      opts.push([nx, ny]);
    }
    if (!opts.length) return m;

    const ahead = opts.filter(([x, y]) => !(x === m.px && y === m.py));
    const choices = ahead.length ? ahead : opts;
    const [nx, ny] = choices[Math.floor(Math.random() * choices.length)];

    occupied.delete(m.y * size + m.x);
    occupied.add(ny * size + nx);

    const moved: MonsterEntity = {
      ...m,
      px: m.x,
      py: m.y,
      fromX: m.x,
      fromY: m.y,
      moveStart: now,
      x: nx,
      y: ny,
    };
    if (nx === playerPos.x && ny === playerPos.y) {
      hitMonster = moved;
    }
    return moved;
  });

  return { nextMonsters, hitMonster };
}

/**
 * Build a small ambient demo maze corridor for the menu backdrop
 */
export function createMenuShowcaseMaze(): GeneratedMaze {
  const size: MazeSize = 10;
  const map: number[][] = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    [1, 1, 1, 0, 1, 0, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 1, 0, 1],
    [1, 0, 1, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 0, 1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 0, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ];
  return {
    size,
    map,
    startPos: { x: 4, y: 8 },
    goalPos: { x: 8, y: 1 },
    altars: [
      { id: 0, x: 4, y: 3, lit: true },
      { id: 1, x: 1, y: 5, lit: false },
    ],
    monsters: [
      { id: 0, type: 'flame', x: 3, y: 3, px: 3, py: 3, fromX: 3, fromY: 3, moveStart: 0, seed: 0.4 },
      { id: 1, type: 'skeleton', x: 5, y: 3, px: 5, py: 3, fromX: 5, fromY: 3, moveStart: 0, seed: 2.1 },
    ],
    openCellCount: 30,
  };
}
