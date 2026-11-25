import React from 'react';
import { AltarEntity, DIR_LABELS, GridPoint, PlayerState } from '../game/types';
import { ViewportMode } from '../hooks/useViewportMode';

interface MinimapProps {
  size: number;
  map: number[][];
  explored: boolean[][];
  player: PlayerState;
  goalPos: GridPoint;
  altars: AltarEntity[];
  viewportMode?: ViewportMode;
  onOpenFullMap: () => void;
}

const DIR_ROTATION = ['rotate-0', 'rotate-90', 'rotate-180', '-rotate-90'];

export const Minimap: React.FC<MinimapProps> = ({
  size,
  map,
  explored,
  player,
  goalPos,
  altars,
  viewportMode = 'desktop',
  onOpenFullMap,
}) => {
  const altarLookup = new Map<string, AltarEntity>();
  for (const a of altars) altarLookup.set(`${a.x},${a.y}`, a);

  const cellSizeClass =
    viewportMode === 'mobile-landscape'
      ? 'w-2.5 h-2.5 text-[7px]'
      : viewportMode === 'mobile-portrait'
        ? 'w-3 h-3 text-[8px]'
        : 'w-4 h-4 text-[9px]';

  const arrowClass =
    viewportMode === 'mobile-landscape'
      ? 'border-l-[3px] border-r-[3px] border-b-[6px]'
      : viewportMode === 'mobile-portrait'
        ? 'border-l-[3.5px] border-r-[3.5px] border-b-[7px]'
        : 'border-l-[4px] border-r-[4px] border-b-[8px]';

  const cells: React.ReactNode[] = [];
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const mx = player.x + dx;
      const my = player.y + dy;
      const key = `${dx},${dy}`;

      if (dx === 0 && dy === 0) {
        cells.push(
          <div
            key={key}
            className={`${cellSizeClass} bg-slate-800 flex items-center justify-center relative`}
          >
            <span
              className={`block w-0 h-0 border-l-transparent border-r-transparent border-b-rose-500 transition-transform duration-150 ${arrowClass} ${DIR_ROTATION[player.dir]}`}
            />
          </div>,
        );
        continue;
      }

      if (mx >= 0 && mx < size && my >= 0 && my < size && explored[my]?.[mx]) {
        const al = altarLookup.get(`${mx},${my}`);
        if (mx === goalPos.x && my === goalPos.y) {
          cells.push(
            <div
              key={key}
              className={`${cellSizeClass} bg-emerald-500 font-bold text-slate-950 flex items-center justify-center leading-none`}
            >
              終
            </div>,
          );
        } else if (al) {
          cells.push(
            <div
              key={key}
              className={`${cellSizeClass} font-bold flex items-center justify-center leading-none ${
                al.lit ? 'bg-amber-400 text-amber-950' : 'bg-stone-500 text-stone-100'
              }`}
            >
              祭
            </div>,
          );
        } else if (map[my][mx] === 1) {
          cells.push(<div key={key} className={`${cellSizeClass} bg-slate-600`} />);
        } else {
          cells.push(<div key={key} className={`${cellSizeClass} bg-slate-800/95`} />);
        }
      } else {
        cells.push(<div key={key} className={`${cellSizeClass} bg-[#070b14]`} />);
      }
    }
  }

  return (
    <button
      type="button"
      onClick={onOpenFullMap}
      title="點擊展開已探索地圖 (Space)"
      className={`group text-left bg-[#0c1220]/95 border border-slate-700/90 hover:border-amber-400/70 rounded-lg shadow-xl transition-colors cursor-pointer ${
        viewportMode === 'mobile-landscape' ? 'p-1.5' : 'p-2'
      }`}
    >
      <div
        className={`flex items-center justify-between text-slate-300 px-0.5 font-mono-num ${
          viewportMode === 'mobile-landscape' ? 'text-[10px] mb-1' : 'text-[11px] mb-1.5'
        }`}
      >
        <span>{DIR_LABELS[player.dir]}</span>
        <span className="text-slate-400">
          {player.x},{player.y}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-[1px] bg-slate-950 p-[2px] rounded border border-slate-800">
        {cells}
      </div>
    </button>
  );
};
