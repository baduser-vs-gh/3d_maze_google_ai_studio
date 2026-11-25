import React from 'react';
import { AltarEntity, GridPoint, PlayerState } from '../game/types';
import { ViewportInfo } from '../hooks/useViewportMode';

interface FullMapModalProps {
  open: boolean;
  size: number;
  map: number[][];
  explored: boolean[][];
  trailMap: boolean[][];
  player: PlayerState;
  startPos: GridPoint;
  goalPos: GridPoint;
  altars: AltarEntity[];
  viewport: ViewportInfo;
  onClose: () => void;
}

const ARROWS = ['▲', '▶', '▼', '◀'];

export const FullMapModal: React.FC<FullMapModalProps> = ({
  open,
  size,
  map,
  explored,
  trailMap,
  player,
  startPos,
  goalPos,
  altars,
  viewport,
  onClose,
}) => {
  if (!open) return null;

  const altarLookup = new Map<string, AltarEntity>();
  for (const a of altars) altarLookup.set(`${a.x},${a.y}`, a);

  const isLandscapeMobile = viewport.mode === 'mobile-landscape';
  const maxBoardPx =
    viewport.mode === 'desktop'
      ? 380
      : isLandscapeMobile
        ? Math.min(viewport.height - 135, viewport.width * 0.5)
        : Math.min(viewport.width - 76, viewport.height - 230);

  const cellPx = Math.max(7, Math.min(20, Math.floor(maxBoardPx / size)));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#050811]/90 p-3 md:p-4 safe-inset">
      <div
        className={`bg-[#0e1526] border border-slate-700 rounded-xl shadow-2xl flex flex-col items-center max-w-[96vw] max-h-[94dvh] ${
          isLandscapeMobile ? 'p-3.5 gap-2.5' : 'p-5 md:p-6 gap-4'
        }`}
      >
        <div className="w-full flex flex-wrap items-center justify-between gap-x-5 gap-y-1.5">
          <h3 className="font-display text-base md:text-lg font-bold text-amber-300">已探索地圖</h3>
          <div className="flex flex-wrap items-center gap-3 text-[11px] md:text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 bg-sky-500 rounded-xs" />
              足跡
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 bg-amber-400 rounded-xs" />
              點亮祭壇
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 bg-stone-400 rounded-xs" />
              未點亮
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-xs" />
              出口
            </span>
          </div>
        </div>

        <div className="overflow-auto max-w-full p-1 bg-[#070b14] border border-slate-800 rounded-lg">
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
              if (!explored[y]?.[x]) {
                return <div key={idx} className="bg-[#070b14]" />;
              }
              if (x === player.x && y === player.y) {
                return (
                  <div
                    key={idx}
                    className="bg-rose-500 text-white flex items-center justify-center leading-none font-bold"
                    style={{ fontSize: `${Math.max(7, cellPx - 4)}px` }}
                  >
                    {ARROWS[player.dir]}
                  </div>
                );
              }
              const al = altarLookup.get(`${x},${y}`);
              let cls = 'bg-slate-800';
              if (x === goalPos.x && y === goalPos.y) cls = 'bg-emerald-500';
              else if (x === startPos.x && y === startPos.y) cls = 'bg-amber-500';
              else if (al) cls = al.lit ? 'bg-amber-300' : 'bg-stone-400';
              else if (map[y][x] === 1) cls = 'bg-slate-600';
              else if (trailMap[y]?.[x]) cls = 'bg-sky-500';

              return <div key={idx} className={cls} />;
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 min-h-[44px] rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm font-medium text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
        >
          {viewport.mode === 'desktop' ? '關閉地圖 (Space / ESC)' : '關閉地圖'}
        </button>
      </div>
    </div>
  );
};
