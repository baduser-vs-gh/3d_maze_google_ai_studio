import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MODEL_CATALOG, createModel3D } from '../game/models3d';
import { ModelId } from '../game/types';
import { X, Sparkles, RotateCcw } from 'lucide-react';

interface ModelPreviewModalProps {
  open: boolean;
  onClose: () => void;
}

const ORDERED_IDS: ModelId[] = [
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
  'altar',
  'chest',
  'chestOpen',
  'potion',
  'key',
  'spikes',
  'teleport',
];

const CAT_LABELS: Record<string, string> = {
  monster: '巡邏怪物',
  altar: '核心祭壇',
  item: '迷宮寶物',
  trap: '機關設施',
};

function detectSoftwareGl(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const ModelPreviewModal: React.FC<ModelPreviewModalProps> = ({ open, onClose }) => {
  const [selectedId, setSelectedId] = useState<ModelId>('skeleton');
  const [altarLit, setAltarLit] = useState(true);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({ active: false, lastX: 0, yaw: 0.35 });
  const litRef = useRef(altarLit);
  litRef.current = altarLit;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const host = canvasHostRef.current;
    if (!host) return;

    const isSoftwareGl = detectSoftwareGl();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));

    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    host.appendChild(canvas);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b101d);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.65;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 20);
    camera.position.set(0, 0.62, 1.55);
    camera.lookAt(0, 0.34, 0);

    const keyLight = new THREE.DirectionalLight(0xffe8c4, 1.9);
    keyLight.position.set(2.2, 3.2, 2.5);
    scene.add(keyLight);

    const hemi = new THREE.HemisphereLight(0x88b4ff, 0x26211c, 0.7);
    scene.add(hemi);

    const rim = new THREE.DirectionalLight(0x60a5fa, 0.75);
    rim.position.set(-2, 1.5, -2.5);
    scene.add(rim);

    // Subtle stone plinth
    const plinthGeo = new THREE.CylinderGeometry(0.46, 0.52, 0.06, 28);
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75, metalness: 0.15 });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = -0.03;
    scene.add(plinth);

    const modelInst = createModel3D(selectedId);
    scene.add(modelInst.group);

    // Zoom slightly closer for small items
    const isSmall = selectedId === 'potion' || selectedId === 'key';
    camera.position.set(0, isSmall ? 0.36 : 0.62, isSmall ? 0.92 : 1.55);
    camera.lookAt(0, isSmall ? 0.18 : 0.34, 0);

    const resize = () => {
      const w = host.clientWidth || 320;
      const h = host.clientHeight || 320;
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let frameId = 0;
    let disposed = false;
    const t0 = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const st = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (st === gl.UNSIGNALED) frameId = window.setTimeout(poll, 5);
        else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const elapsed = (performance.now() - t0) / 1000;
      if (!dragRef.current.active) {
        dragRef.current.yaw += 0.006;
      }
      modelInst.group.rotation.y = dragRef.current.yaw;
      modelInst.update(elapsed, litRef.current);
      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      modelInst.dispose();
      plinthGeo.dispose();
      plinthMat.dispose();
      envRT.dispose();
      renderer.dispose();
      if (canvas.parentElement === host) host.removeChild(canvas);
    };
  }, [open, selectedId]);

  if (!open) return null;

  const currentMeta = MODEL_CATALOG[selectedId];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050811]/90 p-3 md:p-4 safe-inset">
      <div className="w-full max-w-4xl bg-[#0e1526] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] md:max-h-[88vh]">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-slate-800 shrink-0">
          <div className="min-w-0">
            <h2 className="font-display text-base md:text-lg font-bold text-slate-100">3D 模型圖鑑</h2>
            <p className="text-[11px] md:text-xs text-slate-400 mt-0.5 truncate">
              拖曳預覽台可 360° 旋轉檢視迷宮內所有怪物與道具模型
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉圖鑑"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 flex-1 min-h-0 overflow-hidden">
          {/* Model list */}
          <div className="sm:col-span-5 border-b sm:border-b-0 sm:border-r border-slate-800 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 max-h-[34dvh] sm:max-h-none">
            {(['monster', 'altar', 'item', 'trap'] as const).map((cat) => {
              const items = ORDERED_IDS.filter((id) => MODEL_CATALOG[id].cat === cat);
              return (
                <div key={cat}>
                  <div className="text-xs font-medium text-slate-400 mb-1.5 px-1">{CAT_LABELS[cat]}</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map((id) => {
                      const active = id === selectedId;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setSelectedId(id)}
                          className={`text-left px-3 py-2 min-h-[38px] rounded-lg text-xs md:text-sm transition-colors cursor-pointer truncate ${
                            active
                              ? 'bg-amber-500/20 text-amber-200 border border-amber-500/50 font-medium'
                              : 'bg-slate-900/70 text-slate-300 border border-slate-800 hover:border-slate-600 hover:text-white'
                          }`}
                        >
                          {MODEL_CATALOG[id].name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive 3D Stage */}
          <div className="sm:col-span-7 flex flex-col bg-[#0b101d] min-h-0">
            <div
              ref={canvasHostRef}
              onPointerDown={(e) => {
                dragRef.current.active = true;
                dragRef.current.lastX = e.clientX;
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!dragRef.current.active) return;
                const dx = e.clientX - dragRef.current.lastX;
                dragRef.current.lastX = e.clientX;
                dragRef.current.yaw += dx * 0.012;
              }}
              onPointerUp={(e) => {
                dragRef.current.active = false;
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
              }}
              className="flex-1 min-h-[170px] sm:min-h-[220px] cursor-grab active:cursor-grabbing relative touch-none"
            />
            <div className="px-4 md:px-6 py-3 md:py-4 border-t border-slate-800/80 bg-[#0e1526] flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] md:text-xs text-slate-400">
                  <span>{CAT_LABELS[currentMeta.cat]}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num">{currentMeta.id}</span>
                </div>
                <h3 className="text-sm md:text-base font-bold text-slate-100 mt-0.5">{currentMeta.name}</h3>
                <p className="text-xs md:text-sm text-slate-400 mt-0.5 line-clamp-2">{currentMeta.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedId === 'altar' && (
                  <button
                    type="button"
                    onClick={() => setAltarLit((v) => !v)}
                    className={`px-3 py-2 min-h-[40px] rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
                      altarLit
                        ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {altarLit ? '發光' : '未亮'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    dragRef.current.yaw = 0.35;
                  }}
                  title="重設角度"
                  className="p-2.5 min-h-[40px] min-w-[40px] rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
