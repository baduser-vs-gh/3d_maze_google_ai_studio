import React from 'react';
import { AltarEntity, GridPoint, MonsterEntity, RunStats } from '../game/types';
import { ViewportInfo } from '../hooks/useViewportMode';
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
  viewport: ViewportInfo;
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
  viewport,
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

  const isLandscapeMobile = viewport.mode === 'mobile-landscape';
  const isPortraitMobile = viewport.mode === 'mobile-portrait';

  const maxBoardPx = isLandscapeMobile
    ? Math.min(viewport.height - 96, viewport.width * 0.42)
    : isPortraitMobile
      ? Math.min(viewport.width - 72, 320)
      : 420;
  const cellPx = Math.max(7, Math.min(20, Math.floor(maxBoardPx / size)));

  const mapGrid = (
    <div className="overflow-auto max-w-full p-1.5 bg-[#070b14] border border-slate-700/80 rounded-lg">
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
  );

  // Mobile landscape: compact side-by-side summary so everything fits without overflow
  if (isLandscapeMobile) {
    return (
      <div className="fixed inset-0 z-30 bg-[#090d16]/96 flex items-center justify-center p-3 safe-inset overflow-y-auto">
        <div className="w-full max-w-3xl bg-[#0f1729] border border-slate-700/80 rounded-xl p-4 shadow-2xl grid grid-cols-12 gap-4 items-center">
          <div className="col-span-5 flex flex-col items-center gap-2">
            {mapGrid}
            <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[10px] text-slate-300">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 inline-block" />起</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 inline-block" />終</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-sky-500 inline-block" />路</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-300 inline-block" />亮祭</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-rose-500 inline-block" />怪</span>
            </div>
          </div>
          <div className="col-span-7 flex flex-col gap-3">
            <div>
              <p className="text-[11px] font-medium text-amber-400">
                {stats.victory ? '迷宮通關紀錄' : '探索復盤紀錄'} · {size} × {size}
              </p>
              <h2 className="font-display text-xl font-bold text-slate-100 mt-0.5">
                {stats.victory ? '成功走出迷宮' : '迷宮探索復盤'}
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs font-mono-num bg-[#0b1120] border border-slate-800 rounded-lg p-2.5">
              <div>
                <div className="text-[10px] text-slate-400">耗時</div>
                <div className="text-sm font-semibold text-slate-100">{formatDuration(elapsedMs)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">步數</div>
                <div className="text-sm font-semibold text-slate-100">{stats.steps}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">祭壇</div>
                <div className="text-sm font-semibold text-amber-300">{litCount}/{altars.length}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">探索率</div>
                <div className="text-sm font-semibold text-sky-300">{coverage}%</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">遭遇怪物</div>
                <div className="text-sm font-semibold text-rose-300">{stats.encounters}</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={onPlayAgain}
                className="flex-1 min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-medium text-slate-100 flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                再來一局
              </button>
              <button
                type="button"
                onClick={onReturnToMenu}
                className="flex-1 min-h-[44px] px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Home className="w-3.5 h-3.5" />
                返回主選單
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 bg-[#090d16]/96 flex items-center justify-center p-4 md:p-6 safe-inset overflow-y-auto">
      <div className="w-full max-w-4xl bg-[#0f1729] border border-slate-700/80 rounded-xl p-5 md:p-8 shadow-2xl flex flex-col gap-5 md:gap-6 my-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-4 md:pb-5">
          <div>
            <p className="text-xs font-medium text-amber-400">
              {stats.victory ? '迷宮通關紀錄' : '探索復盤紀錄'} · {size} × {size}
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-slate-100 mt-1">
              {stats.victory ? '成功走出迷宮' : '迷宮探索復盤'}
            </h2>
          </div>
          <div className="grid grid-cols-5 md:flex md:items-center gap-3 md:gap-6 text-sm font-mono-num">
            <div>
              <div className="text-[11px] md:text-xs text-slate-400">耗時</div>
              <div className="text-base md:text-lg font-semibold text-slate-100">{formatDuration(elapsedMs)}</div>
            </div>
            <div>
              <div className="text-[11px] md:text-xs text-slate-400">步數</div>
              <div className="text-base md:text-lg font-semibold text-slate-100">{stats.steps}</div>
            </div>
            <div>
              <div className="text-[11px] md:text-xs text-slate-400">祭壇</div>
              <div className="text-base md:text-lg font-semibold text-amber-300">
                {litCount}/{altars.length}
              </div>
            </div>
            <div>
              <div className="text-[11px] md:text-xs text-slate-400">探索率</div>
              <div className="text-base md:text-lg font-semibold text-sky-300">{coverage}%</div>
            </div>
            <div>
              <div className="text-[11px] md:text-xs text-slate-400">遭遇</div>
              <div className="text-base md:text-lg font-semibold text-rose-300">{stats.encounters}</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3.5">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-slate-300">
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

          <div className="max-h-[46dvh] overflow-auto max-w-full">{mapGrid}</div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
          {viewport.mode === 'desktop' && (
            <span className="text-xs text-slate-400">按下 Enter 或 ESC 可直接返回主選單</span>
          )}
          <div className={`flex items-center gap-3 ${viewport.mode !== 'desktop' ? 'w-full' : ''}`}>
            <button
              type="button"
              onClick={onPlayAgain}
              className={`min-h-[44px] px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm font-medium text-slate-100 flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                viewport.mode !== 'desktop' ? 'flex-1' : ''
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              同尺寸再來一局
            </button>
            <button
              type="button"
              onClick={onReturnToMenu}
              className={`min-h-[44px] px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                viewport.mode !== 'desktop' ? 'flex-1' : ''
              }`}
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
