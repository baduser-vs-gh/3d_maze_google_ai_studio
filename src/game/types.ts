export type GameState = 'MENU' | 'PLAYING' | 'SUMMARY';
export type ModalType = null | 'quit' | 'victory' | 'map';
export type MazeSize = 10 | 20 | 30;
export type Direction = 0 | 1 | 2 | 3; // 0: 北(-y), 1: 東(+x), 2: 南(+y), 3: 西(-x)
export type PlayerAction = 'FORWARD' | 'BACKWARD' | 'LEFT' | 'RIGHT' | 'QUIT';

export type TextureCategory = 'wall' | 'floor' | 'ceil';

export interface TextureChoice {
  wall: number;
  floor: number;
  ceil: number;
}

export interface CountSetting {
  monsters: number;
  altars: number;
}

export type CountChoiceMap = Record<MazeSize, CountSetting>;

export type MonsterType =
  | 'slime'
  | 'skeleton'
  | 'bat'
  | 'ghost'
  | 'eyeball'
  | 'mushroom'
  | 'golem'
  | 'spider'
  | 'flame'
  | 'snake';

export type PropType =
  | 'altar'
  | 'chest'
  | 'chestOpen'
  | 'potion'
  | 'key'
  | 'spikes'
  | 'teleport';

export type ModelId = MonsterType | PropType;

export interface GridPoint {
  x: number;
  y: number;
}

export interface PlayerState {
  x: number;
  y: number;
  dir: Direction;
  /** Unwrapped cumulative turn count so camera rotates smoothly without 360-degree jumps */
  yawSteps: number;
}

export interface AltarEntity {
  id: number;
  x: number;
  y: number;
  lit: boolean;
}

export interface MonsterEntity {
  id: number;
  type: MonsterType;
  x: number;
  y: number;
  px: number;
  py: number;
  fromX: number;
  fromY: number;
  moveStart: number;
  seed: number;
}

export interface ToastMessage {
  id: number;
  text: string;
  kind: 'info' | 'danger' | 'ok';
}

export interface RunStats {
  steps: number;
  encounters: number;
  startTime: number;
  endTime: number | null;
  victory: boolean;
}

export const DX: readonly number[] = [0, 1, 0, -1];
export const DY: readonly number[] = [-1, 0, 1, 0];
export const DIR_LABELS: readonly string[] = ['北 N', '東 E', '南 S', '西 W'];

export const MENU_SIZES: readonly MazeSize[] = [10, 20, 30];

export const COUNT_RANGES: Record<MazeSize, { monsters: [number, number]; altars: [number, number] }> = {
  10: { monsters: [1, 3], altars: [1, 2] },
  20: { monsters: [5, 10], altars: [3, 4] },
  30: { monsters: [15, 25], altars: [5, 8] },
};

export const DEFAULT_COUNT_CHOICE: CountChoiceMap = {
  10: { monsters: 2, altars: 1 },
  20: { monsters: 8, altars: 3 },
  30: { monsters: 20, altars: 6 },
};

export const MONSTER_MOVE_MS = 450;
