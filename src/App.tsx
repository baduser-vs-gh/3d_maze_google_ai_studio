import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AltarEntity,
  CountChoiceMap,
  DEFAULT_COUNT_CHOICE,
  DX,
  DY,
  Direction,
  GameState,
  MENU_SIZES,
  MazeSize,
  ModalType,
  MonsterEntity,
  PlayerAction,
  PlayerState,
  RunStats,
  TextureCategory,
  TextureChoice,
  ToastMessage,
} from './game/types';
import {
  GeneratedMaze,
  createMenuShowcaseMaze,
  generateMazeRun,
  stepMonsters,
} from './game/maze';
import { getTextureLibrary } from './game/textures';
import { MODEL_CATALOG } from './game/models3d';
import { audioEngine } from './game/audio';
import { useViewportMode } from './hooks/useViewportMode';
import { MazeViewport3D } from './components/MazeViewport3D';
import { Minimap } from './components/Minimap';
import { FullMapModal } from './components/FullMapModal';
import { SummaryScreen } from './components/SummaryScreen';
import { MenuScreen } from './components/MenuScreen';
import { ModelPreviewModal } from './components/ModelPreview3D';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Flag,
  Map as MapIcon,
  Volume2,
  VolumeX,
} from 'lucide-react';

function loadSavedTextures(): TextureChoice {
  const fallback: TextureChoice = { wall: 1, floor: 0, ceil: 1 };
  try {
    const raw = JSON.parse(localStorage.getItem('maze-textures') || 'null');
    if (!raw) return fallback;
    const lib = getTextureLibrary();
    return {
      wall: Number.isInteger(raw.wall) && lib.wall[raw.wall] ? raw.wall : fallback.wall,
      floor: Number.isInteger(raw.floor) && lib.floor[raw.floor] ? raw.floor : fallback.floor,
      ceil: Number.isInteger(raw.ceil) && lib.ceil[raw.ceil] ? raw.ceil : fallback.ceil,
    };
  } catch {
    return fallback;
  }
}

function loadSavedInterval(): number {
  try {
    const saved = Number(localStorage.getItem('maze-monster-interval'));
    if (saved >= 1 && saved <= 5) return saved;
  } catch {
    // ignore
  }
  return 1;
}

function createExploredGrid(size: number, px: number, py: number): boolean[][] {
  const g = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const nx = px + ox;
      const ny = py + oy;
      if (nx >= 0 && nx < size && ny >= 0 && ny < size) g[ny][nx] = true;
    }
  }
  return g;
}

function createTrailGrid(size: number, px: number, py: number): boolean[][] {
  const g = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  g[py][px] = true;
  return g;
}

export default function App() {
  const viewport = useViewportMode();
  const showcaseMaze = useMemo(() => createMenuShowcaseMaze(), []);

  const [gameState, setGameState] = useState<GameState>('MENU');
  const [modalType, setModalType] = useState<ModalType>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  const [menuIndex, setMenuIndex] = useState(0);
  const [countChoice, setCountChoice] = useState<CountChoiceMap>(DEFAULT_COUNT_CHOICE);
  const [monsterIntervalSec, setMonsterIntervalSec] = useState<number>(loadSavedInterval);
  const [texChoice, setTexChoice] = useState<TextureChoice>(loadSavedTextures);
  const [muted, setMuted] = useState<boolean>(audioEngine.muted);
  const [bgmName, setBgmName] = useState<string>(audioEngine.bgmTrackName);

  const [activeMaze, setActiveMaze] = useState<GeneratedMaze>(showcaseMaze);
  const [player, setPlayer] = useState<PlayerState>({ x: 4, y: 5, dir: 0, yawSteps: 0 });
  const [altars, setAltars] = useState<AltarEntity[]>(showcaseMaze.altars);
  const [monsters, setMonsters] = useState<MonsterEntity[]>(showcaseMaze.monsters);
  const [explored, setExplored] = useState<boolean[][]>(() => createExploredGrid(10, 4, 5));
  const [trailMap, setTrailMap] = useState<boolean[][]>(() => createTrailGrid(10, 4, 5));
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [stats, setStats] = useState<RunStats>({
    steps: 0,
    encounters: 0,
    startTime: Date.now(),
    endTime: null,
    victory: false,
  });

  const moveLockUntilRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);

  // Refs for stable interval/keyboard handlers
  const playerRef = useRef(player);
  playerRef.current = player;
  const altarsRef = useRef(altars);
  altarsRef.current = altars;
  const monstersRef = useRef(monsters);
  monstersRef.current = monsters;
  const activeMazeRef = useRef(activeMaze);
  activeMazeRef.current = activeMaze;
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const modalTypeRef = useRef(modalType);
  modalTypeRef.current = modalType;

  const showToast = useCallback((text: string, kind: ToastMessage['kind'] = 'info') => {
    setToast({ id: Date.now(), text, kind });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 2400);
  }, []);

  // Unlock BGM on first user gesture
  useEffect(() => {
    const unlock = () => audioEngine.startBgm();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const handleToggleMute = useCallback(() => {
    const next = !audioEngine.muted;
    audioEngine.setMuted(next);
    setMuted(next);
  }, []);

  const handleUploadBgm = useCallback((file: File) => {
    audioEngine.loadCustomBgmFile(file);
    setBgmName(file.name);
    if (audioEngine.muted) {
      audioEngine.setMuted(false);
      setMuted(false);
    }
  }, []);

  const handleChangeTexture = useCallback((cat: TextureCategory, idx: number) => {
    setTexChoice((prev) => {
      const next = { ...prev, [cat]: idx };
      try {
        localStorage.setItem('maze-textures', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleChangeCount = useCallback((size: MazeSize, kind: 'monsters' | 'altars', value: number) => {
    setCountChoice((prev) => ({
      ...prev,
      [size]: { ...prev[size], [kind]: value },
    }));
  }, []);

  const handleChangeInterval = useCallback((sec: number) => {
    setMonsterIntervalSec(sec);
    try {
      localStorage.setItem('maze-monster-interval', String(sec));
    } catch {
      // ignore
    }
  }, []);

  const startGame = useCallback(
    (size: MazeSize) => {
      audioEngine.startBgm();
      const run = generateMazeRun(size, countChoice[size]);
      const startPlayer: PlayerState = {
        x: run.startPos.x,
        y: run.startPos.y,
        dir: 0,
        yawSteps: 0,
      };
      setActiveMaze(run);
      setPlayer(startPlayer);
      setAltars(run.altars);
      setMonsters(run.monsters);
      setExplored(createExploredGrid(size, run.startPos.x, run.startPos.y));
      setTrailMap(createTrailGrid(size, run.startPos.x, run.startPos.y));
      setStats({
        steps: 0,
        encounters: 0,
        startTime: Date.now(),
        endTime: null,
        victory: false,
      });
      setModalType(null);
      setToast(null);
      setGameState('PLAYING');
      moveLockUntilRef.current = 0;
    },
    [countChoice],
  );

  const finishToSummary = useCallback((victory: boolean) => {
    setModalType(null);
    setStats((prev) => ({
      ...prev,
      endTime: Date.now(),
      victory,
    }));
    setGameState('SUMMARY');
  }, []);

  const returnToMenu = useCallback(() => {
    setModalType(null);
    setToast(null);
    setActiveMaze(showcaseMaze);
    setAltars(showcaseMaze.altars);
    setMonsters(showcaseMaze.monsters);
    setPlayer({ x: 4, y: 5, dir: 0, yawSteps: 0 });
    setGameState('MENU');
  }, [showcaseMaze]);

  // Monster roaming interval
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const id = window.setInterval(() => {
      if (gameStateRef.current !== 'PLAYING' || modalTypeRef.current) return;
      const maze = activeMazeRef.current;
      const p = playerRef.current;
      const now = performance.now();
      const { nextMonsters, hitMonster } = stepMonsters(
        monstersRef.current,
        maze.map,
        maze.size,
        { x: p.x, y: p.y },
        now,
      );
      setMonsters(nextMonsters);
      if (hitMonster) {
        audioEngine.playMonsterHit();
        setStats((s) => ({ ...s, encounters: s.encounters + 1 }));
        showToast(`碰到怪物：${MODEL_CATALOG[hitMonster.type].name}！`, 'danger');
      }
    }, monsterIntervalSec * 1000);
    return () => window.clearInterval(id);
  }, [gameState, monsterIntervalSec, showToast]);

  const handleAction = useCallback(
    (action: PlayerAction) => {
      if (gameStateRef.current !== 'PLAYING') return;
      if (modalTypeRef.current) return;

      if (action === 'QUIT') {
        setModalType('quit');
        return;
      }

      const now = performance.now();
      if (now < moveLockUntilRef.current) return;

      const p = playerRef.current;
      const maze = activeMazeRef.current;
      let targetX = p.x;
      let targetY = p.y;
      let newDir: Direction = p.dir;
      let newYawSteps = p.yawSteps;

      if (action === 'LEFT') {
        newDir = ((p.dir + 3) % 4) as Direction;
        newYawSteps = p.yawSteps - 1;
        audioEngine.playTurn();
      } else if (action === 'RIGHT') {
        newDir = ((p.dir + 1) % 4) as Direction;
        newYawSteps = p.yawSteps + 1;
        audioEngine.playTurn();
      } else if (action === 'FORWARD') {
        targetX += DX[p.dir];
        targetY += DY[p.dir];
      } else if (action === 'BACKWARD') {
        targetX -= DX[p.dir];
        targetY -= DY[p.dir];
      }

      const moved = action === 'FORWARD' || action === 'BACKWARD';
      if (moved) {
        if (
          targetX < 0 ||
          targetX >= maze.size ||
          targetY < 0 ||
          targetY >= maze.size ||
          maze.map[targetY][targetX] === 1
        ) {
          audioEngine.playBump();
          moveLockUntilRef.current = now + 110;
          return;
        }
        audioEngine.playStep();
      }

      moveLockUntilRef.current = now + 135;
      setPlayer({ x: targetX, y: targetY, dir: newDir, yawSteps: newYawSteps });

      if (moved) {
        setStats((s) => ({ ...s, steps: s.steps + 1 }));

        setExplored((prev) => {
          const next = prev.map((row) => row.slice());
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              const nx = targetX + ox;
              const ny = targetY + oy;
              if (nx >= 0 && nx < maze.size && ny >= 0 && ny < maze.size) {
                next[ny][nx] = true;
              }
            }
          }
          return next;
        });

        setTrailMap((prev) => {
          if (prev[targetY]?.[targetX]) return prev;
          const next = prev.map((row) => row.slice());
          next[targetY][targetX] = true;
          return next;
        });

        // Check monster collision
        const hit = monstersRef.current.find((m) => m.x === targetX && m.y === targetY);
        if (hit) {
          audioEngine.playMonsterHit();
          setStats((s) => ({ ...s, encounters: s.encounters + 1 }));
          showToast(`碰到怪物：${MODEL_CATALOG[hit.type].name}！`, 'danger');
        }

        // Check altar interaction
        let latestAltars = altarsRef.current;
        const hitAltarIdx = latestAltars.findIndex((a) => a.x === targetX && a.y === targetY);
        if (hitAltarIdx !== -1) {
          const al = latestAltars[hitAltarIdx];
          if (!al.lit) {
            latestAltars = latestAltars.map((item, idx) =>
              idx === hitAltarIdx ? { ...item, lit: true } : item,
            );
            setAltars(latestAltars);
            const litCount = latestAltars.filter((x) => x.lit).length;
            audioEngine.playAltarLit(litCount);
            showToast(
              litCount === latestAltars.length
                ? `祭壇發光了！全部 ${latestAltars.length} 座都已點亮，前往綠色出口吧！`
                : `觸摸祭壇：祭壇發光了！（${litCount} / ${latestAltars.length}）`,
              'ok',
            );
          } else {
            showToast('這座祭壇已經點亮了', 'info');
          }
        }

        // Check Goal
        if (targetX === maze.goalPos.x && targetY === maze.goalPos.y) {
          const left = latestAltars.filter((a) => !a.lit).length;
          if (left === 0) {
            audioEngine.playVictory();
            window.setTimeout(() => {
              setModalType('victory');
            }, 160);
          } else {
            audioEngine.playSealed();
            showToast(`出口被封印：還有 ${left} 座祭壇尚未點亮`, 'danger');
          }
        }
      }
    },
    [showToast],
  );

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (galleryOpen) return;
      if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;

      if (e.key === 'm' || e.key === 'M') {
        handleToggleMute();
        e.preventDefault();
        return;
      }

      if (gameState === 'PLAYING' && (e.key === 'h' || e.key === 'H') && !modalType) {
        setDockCollapsed((v) => !v);
        e.preventDefault();
        return;
      }

      if (gameState === 'PLAYING' && modalType) {
        if (e.repeat) return;
        if (modalType === 'quit') {
          if (e.key === 'Enter') {
            finishToSummary(false);
            e.preventDefault();
          } else if (e.key === 'Escape') {
            setModalType(null);
            e.preventDefault();
          }
        } else if (modalType === 'map') {
          if (e.key === ' ' || e.key === 'Escape') {
            setModalType(null);
            e.preventDefault();
          }
        } else if (modalType === 'victory') {
          if (e.key === 'Enter' || e.key === 'Escape') {
            finishToSummary(true);
            e.preventDefault();
          }
        }
        return;
      }

      if (gameState === 'MENU') {
        if (e.repeat) return;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          setMenuIndex((i) => (i + MENU_SIZES.length - 1) % MENU_SIZES.length);
          e.preventDefault();
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          setMenuIndex((i) => (i + 1) % MENU_SIZES.length);
          e.preventDefault();
        } else if (e.key === 'Enter') {
          startGame(MENU_SIZES[menuIndex]);
          e.preventDefault();
        }
        return;
      }

      if (gameState === 'PLAYING') {
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          handleAction('FORWARD');
          e.preventDefault();
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          handleAction('BACKWARD');
          e.preventDefault();
        } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          if (!e.repeat) handleAction('LEFT');
          e.preventDefault();
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          if (!e.repeat) handleAction('RIGHT');
          e.preventDefault();
        } else if (e.key === 'Escape') {
          if (!e.repeat) handleAction('QUIT');
          e.preventDefault();
        } else if (e.key === ' ') {
          if (!e.repeat) setModalType('map');
          e.preventDefault();
        }
        return;
      }

      if (gameState === 'SUMMARY' && !e.repeat && (e.key === 'Escape' || e.key === 'Enter')) {
        returnToMenu();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    gameState,
    modalType,
    galleryOpen,
    menuIndex,
    startGame,
    handleAction,
    finishToSummary,
    returnToMenu,
    handleToggleMute,
  ]);

  const litAltarCount = altars.filter((a) => a.lit).length;
  const allAltarsLit = altars.length > 0 && litAltarCount === altars.length;
  const isDesktop = viewport.mode === 'desktop';
  const isMobilePortrait = viewport.mode === 'mobile-portrait';
  const isMobileLandscape = viewport.mode === 'mobile-landscape';

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#060911]">
      {/* Dedicated full-viewport 3D WebGL Canvas (with touch swipe support for mobile) */}
      <MazeViewport3D
        gameState={gameState}
        maze={activeMaze}
        player={player}
        altars={altars}
        monsters={monsters}
        texChoice={texChoice}
        allAltarsLit={allAltarsLit}
        onSwipeAction={handleAction}
      />

      {/* MENU OVERLAY */}
      {gameState === 'MENU' && (
        <MenuScreen
          menuIndex={menuIndex}
          onSelectMenu={setMenuIndex}
          onStartGame={startGame}
          countChoice={countChoice}
          onChangeCount={handleChangeCount}
          monsterIntervalSec={monsterIntervalSec}
          onChangeInterval={handleChangeInterval}
          texChoice={texChoice}
          onChangeTexture={handleChangeTexture}
          muted={muted}
          bgmName={bgmName}
          viewportMode={viewport.mode}
          onToggleMute={handleToggleMute}
          onUploadBgm={handleUploadBgm}
          onOpenGallery={() => setGalleryOpen(true)}
        />
      )}

      {/* IN-GAME HUD (Solid/RGBA surfaces, zero backdrop-filter over WebGL) */}
      {gameState === 'PLAYING' && (
        <>
          {/* Top-Left Status Strip */}
          <div
            className={`fixed z-10 pointer-events-auto bg-[#0c1220]/92 border border-slate-700/80 rounded-lg shadow-xl ${
              isMobileLandscape
                ? 'top-2.5 left-3 px-3 py-1.5'
                : isMobilePortrait
                  ? 'top-3 left-3 px-3 py-2'
                  : 'top-4 left-4 px-4 py-2.5'
            }`}
            style={{
              marginTop: 'env(safe-area-inset-top, 0px)',
              marginLeft: 'env(safe-area-inset-left, 0px)',
            }}
          >
            {isDesktop && <div className="font-display text-sm font-bold text-slate-100">復古網格迷宮</div>}
            <div
              className={`flex items-center font-mono-num text-slate-300 ${
                isMobileLandscape
                  ? 'gap-2 text-[11px]'
                  : isMobilePortrait
                    ? 'gap-2 text-[11px] flex-wrap max-w-[195px]'
                    : 'gap-2.5 text-xs mt-0.5'
              }`}
            >
              <span>
                {activeMaze.size}×{activeMaze.size}
              </span>
              <span className="text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className={allAltarsLit ? 'text-emerald-300 font-semibold' : 'text-amber-300'}>
                祭壇 {litAltarCount}/{altars.length}
              </span>
              {!isMobileLandscape && (
                <>
                  <span className="text-slate-600" aria-hidden="true">
                    ·
                  </span>
                  <span>怪物 {monsters.length}</span>
                </>
              )}
              <span className="text-slate-600" aria-hidden="true">
                ·
              </span>
              <span>步數 {stats.steps}</span>
            </div>
          </div>

          {/* Top-Right 7x7 Minimap */}
          <div
            className={`fixed z-10 pointer-events-auto ${
              isMobileLandscape ? 'top-2.5 right-3' : isMobilePortrait ? 'top-3 right-3' : 'top-4 right-4'
            }`}
            style={{
              marginTop: 'env(safe-area-inset-top, 0px)',
              marginRight: 'env(safe-area-inset-right, 0px)',
            }}
          >
            <Minimap
              size={activeMaze.size}
              map={activeMaze.map}
              explored={explored}
              player={player}
              goalPos={activeMaze.goalPos}
              altars={altars}
              viewportMode={viewport.mode}
              onOpenFullMap={() => setModalType('map')}
            />
          </div>

          {/* Center-Top Toast Feedback */}
          {toast && (
            <div
              key={toast.id}
              role="status"
              className={`fixed left-1/2 -translate-x-1/2 z-20 px-4 md:px-5 py-2 md:py-2.5 rounded-lg border text-xs md:text-sm font-medium shadow-2xl pointer-events-none whitespace-nowrap max-w-[90vw] truncate ${
                isMobilePortrait ? 'top-24' : isMobileLandscape ? 'top-2.5' : 'top-5'
              } ${
                toast.kind === 'danger'
                  ? 'bg-[#2a0f14]/95 border-rose-500 text-rose-100'
                  : toast.kind === 'ok'
                    ? 'bg-[#261e08]/95 border-amber-400 text-amber-100'
                    : 'bg-[#0e172a]/95 border-sky-400/80 text-sky-100'
              }`}
              style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
            >
              {toast.text}
            </div>
          )}

          {/* ==================== DESKTOP CONTROLS (100% UNCHANGED) ==================== */}
          {isDesktop && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center pointer-events-auto max-w-[94vw]">
              <button
                type="button"
                onClick={() => setDockCollapsed((v) => !v)}
                className="px-3.5 py-1 rounded-t-lg bg-[#0c1220]/94 border border-b-0 border-slate-700/80 text-[11px] text-slate-300 hover:text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                {dockCollapsed ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    顯示控制列 (H)
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    收合控制列 (H)
                  </>
                )}
              </button>

              {!dockCollapsed && (
                <div className="bg-[#0c1220]/94 border border-slate-700/90 rounded-xl px-4 py-3 shadow-2xl flex flex-wrap items-center justify-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAction('LEFT')}
                      className="h-10 px-3 rounded-lg bg-[#162036] hover:bg-slate-700 active:translate-y-[1px] border border-slate-600 text-slate-100 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <ArrowLeft className="w-4 h-4 text-amber-300" />
                      左轉
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction('FORWARD')}
                      className="h-10 px-3.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 active:translate-y-[1px] border border-amber-400/70 text-amber-100 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <ArrowUp className="w-4 h-4 text-amber-300" />
                      前進
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction('BACKWARD')}
                      className="h-10 px-3 rounded-lg bg-[#162036] hover:bg-slate-700 active:translate-y-[1px] border border-slate-600 text-slate-100 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <ArrowDown className="w-4 h-4 text-slate-300" />
                      後退
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction('RIGHT')}
                      className="h-10 px-3 rounded-lg bg-[#162036] hover:bg-slate-700 active:translate-y-[1px] border border-slate-600 text-slate-100 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      右轉
                      <ArrowRight className="w-4 h-4 text-amber-300" />
                    </button>
                  </div>

                  <div className="hidden sm:block w-px h-7 bg-slate-700/80" aria-hidden="true" />

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setModalType('map')}
                      className="h-10 px-3.5 rounded-lg bg-[#162036] hover:bg-slate-700 border border-slate-600 text-slate-100 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <MapIcon className="w-4 h-4 text-sky-400" />
                      地圖 (Space)
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleMute}
                      title="切換音效 (M)"
                      className="h-10 w-10 rounded-lg bg-[#162036] hover:bg-slate-700 border border-slate-600 text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction('QUIT')}
                      className="h-10 px-3.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-700/80 text-rose-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      放棄 (ESC)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== MOBILE PORTRAIT CONTROLS ==================== */}
          {isMobilePortrait && (
            <div
              className="fixed bottom-3 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center pointer-events-auto w-[94vw] max-w-sm"
              style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
            >
              <button
                type="button"
                onClick={() => setDockCollapsed((v) => !v)}
                className="px-3.5 py-1 rounded-t-lg bg-[#0c1220]/92 border border-b-0 border-slate-700/80 text-[11px] text-slate-300 flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                {dockCollapsed ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    顯示按鈕
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    收合按鈕
                  </>
                )}
              </button>

              {!dockCollapsed && (
                <div className="w-full bg-[#0c1220]/92 border border-slate-700/90 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3">
                  {/* Ergonomic 3x3 Cross D-Pad */}
                  <div className="grid grid-cols-3 grid-rows-3 gap-1.5 shrink-0">
                    <button
                      type="button"
                      aria-label="前進"
                      onClick={() => handleAction('FORWARD')}
                      className="col-start-2 row-start-1 w-14 h-12 rounded-xl bg-amber-500/25 active:bg-amber-500/45 border border-amber-400/75 text-amber-100 flex items-center justify-center cursor-pointer"
                    >
                      <ArrowUp className="w-6 h-6" />
                    </button>
                    <button
                      type="button"
                      aria-label="左轉"
                      onClick={() => handleAction('LEFT')}
                      className="col-start-1 row-start-2 w-14 h-12 rounded-xl bg-[#162036] active:bg-slate-600 border border-slate-600 text-slate-100 flex items-center justify-center cursor-pointer"
                    >
                      <ArrowLeft className="w-6 h-6 text-amber-300" />
                    </button>
                    <button
                      type="button"
                      aria-label="右轉"
                      onClick={() => handleAction('RIGHT')}
                      className="col-start-3 row-start-2 w-14 h-12 rounded-xl bg-[#162036] active:bg-slate-600 border border-slate-600 text-slate-100 flex items-center justify-center cursor-pointer"
                    >
                      <ArrowRight className="w-6 h-6 text-amber-300" />
                    </button>
                    <button
                      type="button"
                      aria-label="後退"
                      onClick={() => handleAction('BACKWARD')}
                      className="col-start-2 row-start-3 w-14 h-12 rounded-xl bg-[#162036] active:bg-slate-600 border border-slate-600 text-slate-200 flex items-center justify-center cursor-pointer"
                    >
                      <ArrowDown className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Right thumb action stack */}
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => setModalType('map')}
                      className="min-h-[44px] px-3 rounded-xl bg-[#162036] active:bg-slate-700 border border-slate-600 text-slate-100 text-xs font-medium flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <MapIcon className="w-4 h-4 text-sky-400" />
                      探索地圖
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleMute}
                      className="min-h-[44px] px-3 rounded-xl bg-[#162036] active:bg-slate-700 border border-slate-600 text-slate-100 text-xs font-medium flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                      {muted ? '已靜音' : '音效開'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction('QUIT')}
                      className="min-h-[44px] px-3 rounded-xl bg-rose-950/75 active:bg-rose-900 border border-rose-700/80 text-rose-200 text-xs font-medium flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      放棄探索
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== MOBILE LANDSCAPE CONTROLS (TWIN-THUMB CORNERS) ==================== */}
          {isMobileLandscape && (
            <>
              {/* Compact bottom-center toggle for Zen / Full-View mode */}
              <button
                type="button"
                onClick={() => setDockCollapsed((v) => !v)}
                className="fixed bottom-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-lg bg-[#0c1220]/88 border border-slate-700/80 text-[11px] text-slate-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
              >
                {dockCollapsed ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>{dockCollapsed ? '顯示按鈕' : '隱藏按鈕'}</span>
              </button>

              {!dockCollapsed && (
                <>
                  {/* Left thumb: Cross D-Pad */}
                  <div
                    className="fixed bottom-3 left-3 z-10 pointer-events-auto bg-[#0c1220]/85 border border-slate-700/80 rounded-2xl p-2 shadow-xl"
                    style={{
                      marginBottom: 'env(safe-area-inset-bottom, 0px)',
                      marginLeft: 'env(safe-area-inset-left, 0px)',
                    }}
                  >
                    <div className="grid grid-cols-3 grid-rows-3 gap-1">
                      <button
                        type="button"
                        aria-label="前進"
                        onClick={() => handleAction('FORWARD')}
                        className="col-start-2 row-start-1 w-11 h-11 rounded-lg bg-amber-500/25 active:bg-amber-500/45 border border-amber-400/75 text-amber-100 flex items-center justify-center cursor-pointer"
                      >
                        <ArrowUp className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        aria-label="左轉"
                        onClick={() => handleAction('LEFT')}
                        className="col-start-1 row-start-2 w-11 h-11 rounded-lg bg-[#162036] active:bg-slate-600 border border-slate-600 text-slate-100 flex items-center justify-center cursor-pointer"
                      >
                        <ArrowLeft className="w-5 h-5 text-amber-300" />
                      </button>
                      <button
                        type="button"
                        aria-label="右轉"
                        onClick={() => handleAction('RIGHT')}
                        className="col-start-3 row-start-2 w-11 h-11 rounded-lg bg-[#162036] active:bg-slate-600 border border-slate-600 text-slate-100 flex items-center justify-center cursor-pointer"
                      >
                        <ArrowRight className="w-5 h-5 text-amber-300" />
                      </button>
                      <button
                        type="button"
                        aria-label="後退"
                        onClick={() => handleAction('BACKWARD')}
                        className="col-start-2 row-start-3 w-11 h-11 rounded-lg bg-[#162036] active:bg-slate-600 border border-slate-600 text-slate-200 flex items-center justify-center cursor-pointer"
                      >
                        <ArrowDown className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Right thumb: Utility action cluster */}
                  <div
                    className="fixed bottom-3 right-3 z-10 pointer-events-auto bg-[#0c1220]/85 border border-slate-700/80 rounded-2xl p-2 shadow-xl flex flex-col gap-1.5"
                    style={{
                      marginBottom: 'env(safe-area-inset-bottom, 0px)',
                      marginRight: 'env(safe-area-inset-right, 0px)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setModalType('map')}
                      className="min-h-[44px] px-3.5 rounded-lg bg-[#162036] active:bg-slate-700 border border-slate-600 text-slate-100 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <MapIcon className="w-4 h-4 text-sky-400" />
                      地圖
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleToggleMute}
                        aria-label="切換音效"
                        className="min-h-[44px] min-w-[44px] rounded-lg bg-[#162036] active:bg-slate-700 border border-slate-600 text-slate-200 flex items-center justify-center cursor-pointer"
                      >
                        {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction('QUIT')}
                        className="min-h-[44px] px-3 rounded-lg bg-rose-950/75 active:bg-rose-900 border border-rose-700/80 text-rose-200 text-xs font-medium flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Flag className="w-3.5 h-3.5" />
                        放棄
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Explored Map Modal */}
          <FullMapModal
            open={modalType === 'map'}
            size={activeMaze.size}
            map={activeMaze.map}
            explored={explored}
            trailMap={trailMap}
            player={player}
            startPos={activeMaze.startPos}
            goalPos={activeMaze.goalPos}
            altars={altars}
            viewport={viewport}
            onClose={() => setModalType(null)}
          />

          {/* Quit Confirmation Modal */}
          {modalType === 'quit' && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#050811]/90 p-4 safe-inset">
              <div className="bg-[#0e1526] border border-slate-700 rounded-xl p-6 max-w-sm w-full shadow-2xl text-center space-y-5">
                <div>
                  <h3 className="font-display text-lg font-bold text-amber-300">放棄遊戲</h3>
                  <p className="text-sm text-slate-300 mt-2">
                    確定要結束本次迷宮探險並查看全圖復盤嗎？
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => finishToSummary(false)}
                    className="min-h-[44px] px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {isDesktop ? '確定放棄 (Enter)' : '確定放棄'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalType(null)}
                    className="min-h-[44px] px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {isDesktop ? '繼續探索 (ESC)' : '繼續探索'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Victory Modal */}
          {modalType === 'victory' && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#050811]/90 p-4 safe-inset">
              <div className="bg-[#0e1526] border border-emerald-500/70 rounded-xl p-6 max-w-sm w-full shadow-2xl text-center space-y-5">
                <div>
                  <h3 className="font-display text-xl font-bold text-emerald-300">恭喜通關</h3>
                  <p className="text-sm text-slate-300 mt-2">
                    所有祭壇皆已點亮，你成功解開迷宮封印並順利脫出！
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => finishToSummary(true)}
                  className="w-full min-h-[44px] px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  {isDesktop ? '查看迷宮探索復盤 (Enter / ESC)' : '查看迷宮探索復盤'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* SUMMARY REPLAY SCREEN */}
      {gameState === 'SUMMARY' && (
        <SummaryScreen
          size={activeMaze.size}
          map={activeMaze.map}
          trailMap={trailMap}
          startPos={activeMaze.startPos}
          goalPos={activeMaze.goalPos}
          altars={altars}
          monsters={monsters}
          openCellCount={activeMaze.openCellCount}
          stats={stats}
          viewport={viewport}
          onReturnToMenu={returnToMenu}
          onPlayAgain={() => startGame(activeMaze.size)}
        />
      )}

      {/* 3D MODEL BESTIARY MODAL */}
      <ModelPreviewModal open={galleryOpen} onClose={() => setGalleryOpen(false)} />
    </div>
  );
}
