import React from 'react';
import { AltarEntity, DIR_LABELS, GridPoint, PlayerState } from '../game/types';

interface MinimapProps {
  size: number;
  map: number[][];
  explored: boolean[][];
  player: PlayerState;
  goalPos: GridPoint;
  altars: AltarEntity[];
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
  onOpenFullMap,
}) => {
  const altarLookup = new Map<string, AltarEntity>();
  for (const a of altars) altarLookup.set(`${a.x},${a.y}`, a);

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
            className="w-4 h-4 bg-slate-800 flex items-center justify-center relative"
          >
            <span
              className={`block w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px] border-b-rose-500 transition-transform duration-150 ${DIR_ROTATION[player.dir]}`}
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
              className="w-4 h-4 bg-emerald-500 text-[9px] font-bold text-slate-950 flex items-center justify-center leading-none"
            >
              終
            </div>,
          );
        } else if (al) {
          cells.push(
            <div
              key={key}
              className={`w-4 h-4 text-[9px] font-bold flex items-center justify-center leading-none ${
                al.lit ? 'bg-amber-400 text-amber-950' : 'bg-stone-500 text-stone-100'
              }`}
            >
              祭
            </div>,
          );
        } else if (map[my][mx] === 1) {
          cells.push(<div key={key} className="w-4 h-4 bg-slate-600" />);
        } else {
          cells.push(<div key={key} className="w-4 h-4 bg-slate-800/95" />);
        }
      } else {
        cells.push(<div key={key} className="w-4 h-4 bg-[#070b14]" />);
      }
    }
  }

  return (
    <button
      type="button"
      onClick={onOpenFullMap}
      title="點擊展開已探索地圖 (Space)"
      className="group text-left bg-[#0c1220]/95 border border-slate-700/90 hover:border-amber-400/70 rounded-lg p-2 shadow-xl transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1.5 px-0.5 font-mono-num">
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
