import React from 'react';
import { AltarEntity, GridPoint, MonsterEntity, RunStats } from '../game/types';
import { RotateCcw, Home } from 'lucide-react';

interface SummaryScreenProps {
  size: number;
  map: number[][];
  trailMap: boolean[][];
  startPos: GridPoint;
  goalPos: GridPoint;
  altars: AltarEntity[];
  monsters: MonsterEntity[];
  openCellCount: number;
  stats: RunStats;
  onReturnToMenu: () => void;
  onPlayAgain: () => void;
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const SummaryScreen: React.FC<SummaryScreenProps> = ({
  size,
  map,
  trailMap,
  startPos,
  goalPos,
  altars,
  monsters,
  openCellCount,
  stats,
  onReturnToMenu,
  onPlayAgain,
}) => {
  const altarLookup = new Map<string, AltarEntity>();
  for (const a of altars) altarLookup.set(`${a.x},${a.y}`, a);

  const monsterLookup = new Set<string>();
  for (const m of monsters) monsterLookup.add(`${m.x},${m.y}`);

  let trailCells = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (trailMap[y]?.[x] && map[y]?.[x] === 0) trailCells++;
    }
  }
  const coverage = openCellCount > 0 ? Math.min(100, Math.round((trailCells / openCellCount) * 100)) : 0;
  const litCount = altars.filter((a) => a.lit).length;
  const elapsedMs = (stats.endTime ?? Date.now()) - stats.startTime;
  const cellPx = Math.max(10, Math.min(20, Math.floor(420 / size)));

  return (
    <div className="fixed inset-0 z-30 bg-[#090d16]/96 flex items-center justify-center p-6 overflow-y-auto">
      <div className="w-full max-w-4xl bg-[#0f1729] border border-slate-700/80 rounded-xl p-6 md:p-8 shadow-2xl flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <p className="text-xs font-medium text-amber-400">
              {stats.victory ? '迷宮通關紀錄' : '探索復盤紀錄'} · {size} × {size}
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-slate-100 mt-1">
              {stats.victory ? '成功走出迷宮' : '迷宮探索復盤'}
            </h2>
          </div>
          <div className="flex items-center gap-6 text-sm font-mono-num">
            <div>
              <div className="text-xs text-slate-400">耗時</div>
              <div className="text-lg font-semibold text-slate-100">{formatDuration(elapsedMs)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">步數</div>
              <div className="text-lg font-semibold text-slate-100">{stats.steps}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">點亮祭壇</div>
              <div className="text-lg font-semibold text-amber-300">
                {litCount} / {altars.length}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">探索率</div>
              <div className="text-lg font-semibold text-sky-300">{coverage}%</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">遭遇怪物</div>
              <div className="text-lg font-semibold text-rose-300">{stats.encounters}</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 bg-amber-500 rounded-xs" />
              起點
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 bg-emerald-500 rounded-xs" />
              出口
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 bg-sky-500 rounded-xs" />
              本局路徑
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 bg-amber-300 rounded-xs" />
              已點亮祭壇
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 bg-stone-400 rounded-xs" />
              未點亮祭壇
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 bg-rose-500 rounded-xs" />
              怪物最後位置
            </span>
          </div>

          <div className="overflow-auto max-w-full max-h-[46vh] p-1.5 bg-[#070b14] border border-slate-700/80 rounded-lg">
            <div
              className="grid gap-[1px]"
              style={{
                gridTemplateColumns: `repeat(${size}, ${cellPx}px)`,
                gridAutoRows: `${cellPx}px`,
              }}
            >
              {Array.from({ length: size * size }, (_, idx) => {
                const x = idx % size;
                const y = Math.floor(idx / size);
                const key = `${x},${y}`;
                const al = altarLookup.get(key);

                let cls = 'bg-slate-800';
                if (x === startPos.x && y === startPos.y) cls = 'bg-amber-500';
                else if (x === goalPos.x && y === goalPos.y) cls = 'bg-emerald-500';
                else if (al) cls = al.lit ? 'bg-amber-300' : 'bg-stone-400';
                else if (monsterLookup.has(key)) cls = 'bg-rose-500';
                else if (trailMap[y]?.[x]) cls = 'bg-sky-500';
                else if (map[y]?.[x] === 1) cls = 'bg-slate-600';

                return <div key={idx} className={cls} />;
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800">
          <span className="text-xs text-slate-400">按下 Enter 或 ESC 可直接返回主選單</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onPlayAgain}
              className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm font-medium text-slate-100 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              同尺寸再來一局
            </button>
            <button
              type="button"
              onClick={onReturnToMenu}
              className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Home className="w-4 h-4" />
              返回主選單
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
