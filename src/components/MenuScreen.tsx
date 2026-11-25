import React, { useMemo, useRef } from 'react';
import {
  COUNT_RANGES,
  CountChoiceMap,
  MENU_SIZES,
  MazeSize,
  TextureCategory,
  TextureChoice,
} from '../game/types';
import { getTextureLibrary } from '../game/textures';
import { ViewportMode } from '../hooks/useViewportMode';
import { BookOpen, Music, Play, Volume2, VolumeX } from 'lucide-react';

interface MenuScreenProps {
  menuIndex: number;
  onSelectMenu: (idx: number) => void;
  onStartGame: (size: MazeSize) => void;
  countChoice: CountChoiceMap;
  onChangeCount: (size: MazeSize, kind: 'monsters' | 'altars', value: number) => void;
  monsterIntervalSec: number;
  onChangeInterval: (sec: number) => void;
  texChoice: TextureChoice;
  onChangeTexture: (cat: TextureCategory, idx: number) => void;
  muted: boolean;
  bgmName: string;
  viewportMode: ViewportMode;
  onToggleMute: () => void;
  onUploadBgm: (file: File) => void;
  onOpenGallery: () => void;
}

const CAT_NAMES: Record<TextureCategory, string> = {
  wall: '牆壁材質',
  floor: '地板材質',
  ceil: '天花板材質',
};

const CAT_SHORT_NAMES: Record<TextureCategory, string> = {
  wall: '牆壁',
  floor: '地板',
  ceil: '天花板',
};

export const MenuScreen: React.FC<MenuScreenProps> = ({
  menuIndex,
  onSelectMenu,
  onStartGame,
  countChoice,
  onChangeCount,
  monsterIntervalSec,
  onChangeInterval,
  texChoice,
  onChangeTexture,
  muted,
  bgmName,
  viewportMode,
  onToggleMute,
  onUploadBgm,
  onOpenGallery,
}) => {
  const texLib = useMemo(() => getTextureLibrary(), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedSize = MENU_SIZES[menuIndex];
  const range = COUNT_RANGES[selectedSize];

  const monsterOptions = useMemo(() => {
    const arr: number[] = [];
    for (let n = range.monsters[0]; n <= range.monsters[1]; n++) arr.push(n);
    return arr;
  }, [range]);

  const altarOptions = useMemo(() => {
    const arr: number[] = [];
    for (let n = range.altars[0]; n <= range.altars[1]; n++) arr.push(n);
    return arr;
  }, [range]);

  const bgmFileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="audio/*"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) onUploadBgm(file);
        e.target.value = '';
      }}
    />
  );

  // Mobile Landscape: compact 2-column menu so everything fits comfortably in short landscape height
  if (viewportMode === 'mobile-landscape') {
    return (
      <div className="fixed inset-0 z-20 flex flex-col justify-between px-4 py-2.5 safe-inset bg-[#070b14]/84 overflow-y-auto">
        {bgmFileInput}
        <header className="w-full max-w-4xl mx-auto flex items-center justify-between gap-4 pb-1.5">
          <div className="font-display text-base font-bold tracking-wide text-slate-100 whitespace-nowrap shrink-0">
            復古網格迷宮 3D
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenGallery}
              className="px-3 py-1.5 min-h-[36px] rounded-lg bg-[#11192c]/95 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              3D 圖鑑
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              className="px-2.5 py-1.5 min-h-[36px] rounded-lg bg-[#11192c]/95 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              {muted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{muted ? '靜音' : '音效'}</span>
            </button>
          </div>
        </header>

        <main className="w-full max-w-4xl mx-auto my-auto bg-[#0d1424]/94 border border-slate-700/80 rounded-xl p-3.5 shadow-2xl grid grid-cols-12 gap-4 items-center">
          {/* Left column: Size + Counts + Start CTA */}
          <div className="col-span-6 flex flex-col gap-2.5">
            <div className="grid grid-cols-3 gap-2">
              {MENU_SIZES.map((sz, i) => {
                const active = i === menuIndex;
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => onSelectMenu(i)}
                    className={`py-2 px-2 rounded-lg border text-center transition-colors cursor-pointer font-mono-num ${
                      active
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-semibold'
                        : 'bg-[#121c31] border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="text-sm">{sz}×{sz}</div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                <span>怪物</span>
                <select
                  value={countChoice[selectedSize].monsters}
                  onChange={(e) => onChangeCount(selectedSize, 'monsters', Number(e.target.value))}
                  className="bg-[#121c31] text-slate-100 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono-num"
                >
                  {monsterOptions.map((n) => (
                    <option key={n} value={n}>{n} 隻</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                <span>祭壇</span>
                <select
                  value={countChoice[selectedSize].altars}
                  onChange={(e) => onChangeCount(selectedSize, 'altars', Number(e.target.value))}
                  className="bg-[#121c31] text-slate-100 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono-num"
                >
                  {altarOptions.map((n) => (
                    <option key={n} value={n}>{n} 座</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-[11px] text-slate-400">
                <span>移動間隔</span>
                <select
                  value={monsterIntervalSec}
                  onChange={(e) => onChangeInterval(Number(e.target.value))}
                  className="bg-[#121c31] text-slate-100 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-mono-num"
                >
                  {[1, 2, 3, 4, 5].map((sec) => (
                    <option key={sec} value={sec}>{sec} 秒</option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={() => onStartGame(selectedSize)}
              className="w-full min-h-[44px] px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 active:translate-y-[1px] text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap shadow-lg"
            >
              <Play className="w-4 h-4 fill-current" />
              開始探索 ({selectedSize} × {selectedSize})
            </button>
          </div>

          {/* Right column: Texture Swatches + BGM */}
          <div className="col-span-6 flex flex-col gap-2 border-l border-slate-800 pl-3.5">
            {(['wall', 'floor', 'ceil'] as TextureCategory[]).map((cat) => (
              <div key={cat} className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 w-11 shrink-0">{CAT_SHORT_NAMES[cat]}</span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  {texLib[cat].map((entry, idx) => {
                    const active = texChoice[cat] === idx;
                    return (
                      <button
                        key={entry.name}
                        type="button"
                        onClick={() => onChangeTexture(cat, idx)}
                        className={`flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-md border text-[11px] transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-medium'
                            : 'bg-[#121c31] border-slate-700/80 text-slate-300'
                        }`}
                      >
                        <img
                          src={entry.previewUrl}
                          alt={entry.name}
                          className="w-4 h-4 rounded-xs border border-black/40 object-cover"
                          style={{ imageRendering: 'pixelated' }}
                        />
                        <span>{entry.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
              <div className="flex items-center gap-1.5 min-w-0">
                <Music className="w-3 h-3 shrink-0" />
                <span className="truncate">{bgmName}</span>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-amber-300 underline underline-offset-2 cursor-pointer whitespace-nowrap shrink-0"
              >
                更換 BGM
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Desktop (100% preserved) & Mobile Portrait
  const isMobilePortrait = viewportMode === 'mobile-portrait';

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-4 md:p-8 safe-inset bg-gradient-to-r from-[#070b14]/92 via-[#070b14]/72 to-[#070b14]/45 overflow-y-auto">
      {bgmFileInput}

      {/* Top minimal bar */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between gap-4 md:gap-6">
        <div className="font-display text-lg md:text-xl font-bold tracking-wide text-slate-100 whitespace-nowrap shrink-0">
          復古網格迷宮 3D
        </div>
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenGallery}
            className="px-3 md:px-3.5 py-2 min-h-[40px] rounded-lg bg-[#11192c]/95 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 md:gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            {isMobilePortrait ? '3D 圖鑑' : '3D 模型圖鑑'}
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            className="px-3 py-2 min-h-[40px] rounded-lg bg-[#11192c]/95 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            title="切換靜音 (M)"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{muted ? '已靜音' : '音效開'}</span>
          </button>
        </div>
      </header>

      {/* Main configuration panel */}
      <main className="w-full max-w-6xl mx-auto my-auto py-4 md:py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <section className="lg:col-span-6 bg-[#0d1424]/94 border border-slate-700/80 rounded-xl p-5 md:p-7 shadow-2xl flex flex-col gap-5 md:gap-6">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-slate-50 leading-tight text-balance">
              迷宮探險選單
            </h1>
            <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
              在火把微光中穿行第一人稱立體走廊，躲避巡邏怪物並點亮所有祭壇，即可解除出口封印逃出迷宮。
            </p>
          </div>

          {/* Maze Size Selection */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium text-slate-200">迷宮尺寸</span>
              {!isMobilePortrait && <span>← → 切換 · Enter 開始</span>}
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {MENU_SIZES.map((sz, i) => {
                const active = i === menuIndex;
                return (
                  <button
                    key={sz}
                    type="button"
                    onMouseEnter={() => onSelectMenu(i)}
                    onClick={() => onSelectMenu(i)}
                    className={`py-3 px-2 md:px-3 min-h-[56px] rounded-lg border text-center transition-colors cursor-pointer font-mono-num ${
                      active
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-semibold'
                        : 'bg-[#121c31] border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
                    }`}
                  >
                    <div className="text-base">{sz} × {sz}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 font-sans">
                      {sz === 10 ? '快速探索' : sz === 20 ? '標準地城' : '深層迷宮'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Entities & Speed */}
          <div className="grid grid-cols-3 gap-2.5 md:gap-3">
            <label className="flex flex-col gap-1.5 text-xs text-slate-400">
              <span>怪物數量</span>
              <select
                value={countChoice[selectedSize].monsters}
                onChange={(e) => {
                  onChangeCount(selectedSize, 'monsters', Number(e.target.value));
                  e.currentTarget.blur();
                }}
                className="bg-[#121c31] text-slate-100 border border-slate-700 hover:border-slate-500 rounded-lg px-2.5 md:px-3 py-2.5 text-sm font-mono-num focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {monsterOptions.map((n) => (
                  <option key={n} value={n}>
                    {n} 隻
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs text-slate-400">
              <span>祭壇數量</span>
              <select
                value={countChoice[selectedSize].altars}
                onChange={(e) => {
                  onChangeCount(selectedSize, 'altars', Number(e.target.value));
                  e.currentTarget.blur();
                }}
                className="bg-[#121c31] text-slate-100 border border-slate-700 hover:border-slate-500 rounded-lg px-2.5 md:px-3 py-2.5 text-sm font-mono-num focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {altarOptions.map((n) => (
                  <option key={n} value={n}>
                    {n} 座
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs text-slate-400">
              <span>怪物移動間隔</span>
              <select
                value={monsterIntervalSec}
                onChange={(e) => {
                  onChangeInterval(Number(e.target.value));
                  e.currentTarget.blur();
                }}
                className="bg-[#121c31] text-slate-100 border border-slate-700 hover:border-slate-500 rounded-lg px-2.5 md:px-3 py-2.5 text-sm font-mono-num focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {[1, 2, 3, 4, 5].map((sec) => (
                  <option key={sec} value={sec}>
                    {sec} 秒
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Live Texture Swatch Pickers */}
          <div className="space-y-3 pt-1 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium text-slate-200">迷宮材質（即時預覽）</span>
              {!isMobilePortrait && <span>切換立即反映於背景 3D 場景</span>}
            </div>
            {(['wall', 'floor', 'ceil'] as TextureCategory[]).map((cat) => (
              <div
                key={cat}
                className={isMobilePortrait ? 'flex flex-col gap-1.5' : 'flex items-center gap-3'}
              >
                <span className="text-xs text-slate-400 w-20 shrink-0">{CAT_NAMES[cat]}</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {texLib[cat].map((entry, idx) => {
                    const active = texChoice[cat] === idx;
                    return (
                      <button
                        key={entry.name}
                        type="button"
                        onClick={() => onChangeTexture(cat, idx)}
                        className={`flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 min-h-[36px] rounded-lg border text-xs transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-medium'
                            : 'bg-[#121c31] border-slate-700/80 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <img
                          src={entry.previewUrl}
                          alt={entry.name}
                          className="w-5 h-5 rounded-xs border border-black/40 object-cover"
                          style={{ imageRendering: 'pixelated' }}
                        />
                        <span>{entry.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Primary Start CTA + BGM loader */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-400 min-w-0">
              <Music className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate max-w-[140px]" title={bgmName}>
                {bgmName}
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-amber-300 hover:text-amber-200 underline underline-offset-2 cursor-pointer whitespace-nowrap"
              >
                更換 BGM
              </button>
            </div>

            <button
              type="button"
              onClick={() => onStartGame(selectedSize)}
              className={`min-h-[46px] px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 active:translate-y-[1px] text-slate-950 font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap shadow-lg ${
                isMobilePortrait ? 'w-full' : ''
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              開始探索 ({selectedSize} × {selectedSize})
            </button>
          </div>
        </section>

        {/* Right column open on desktop so player admires live 3D corridor */}
        <aside className="hidden lg:flex lg:col-span-6 flex-col items-end justify-end self-end pb-2 pointer-events-none">
          <div className="text-right space-y-1 max-w-xs">
            <p className="text-xs text-amber-300/90 font-medium">即時 3D 地城視景</p>
            <p className="text-xs text-slate-300/85 leading-relaxed">
              支援方向鍵或 WASD 平滑行走與轉向，按 Space 開啟探索地圖，按 H 隱藏下方控制列。
            </p>
          </div>
        </aside>
      </main>

      <footer className="w-full max-w-6xl mx-auto flex items-center justify-between text-xs text-slate-400 pt-2">
        <span>點亮所有祭壇後前往綠色出口即可通關</span>
        {!isMobilePortrait && <span>操作：↑↓←→ / WASD · Space 地圖 · ESC 放棄</span>}
      </footer>
    </div>
  );
};
