import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GeneratedMaze } from '../game/maze';
import { AnimatedModelInstance, createModel3D } from '../game/models3d';
import { createThreeTextures, getTextureLibrary } from '../game/textures';
import {
  AltarEntity,
  GameState,
  MONSTER_MOVE_MS,
  MonsterEntity,
  PlayerState,
  TextureChoice,
} from '../game/types';

interface MazeViewport3DProps {
  gameState: GameState;
  maze: GeneratedMaze;
  player: PlayerState;
  altars: AltarEntity[];
  monsters: MonsterEntity[];
  texChoice: TextureChoice;
  allAltarsLit: boolean;
  onSwipeAction?: (action: 'FORWARD' | 'BACKWARD' | 'LEFT' | 'RIGHT') => void;
}

const CELL = 1.0;
const WALL_H = 1.0;
const EYE_Y = 0.5;

const _dummy = new THREE.Object3D();

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

export const MazeViewport3D: React.FC<MazeViewport3DProps> = ({
  gameState,
  maze,
  player,
  altars,
  monsters,
  texChoice,
  allAltarsLit,
  onSwipeAction,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [contextLost, setContextLost] = useState(false);

  // Latest props in refs so WebGL render loop never tears down on UI state changes
  const stateRef = useRef({
    gameState,
    player,
    altars,
    monsters,
    allAltarsLit,
  });
  stateRef.current = { gameState, player, altars, monsters, allAltarsLit };

  const sceneApiRef = useRef<{
    rebuildMazeGeometry: (m: GeneratedMaze, tc: TextureChoice) => void;
    updateTexturesOnly: (tc: TextureChoice) => void;
    syncCameraImmediate: (p: PlayerState) => void;
  } | null>(null);

  const mazeRef = useRef(maze);
  mazeRef.current = maze;
  const texRef = useRef(texChoice);
  texRef.current = texChoice;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setContextLost(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;

    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    const bgHex = 0x060911;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.34);

    // Studio environment reflection for metallic plates & crystals
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.45;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 16);

    // Warm player torch + cool dungeon hemisphere fill
    const hemi = new THREE.HemisphereLight(0x8aa8d6, 0x26201a, 0.55);
    scene.add(hemi);

    const torch = new THREE.PointLight(0xffdfb0, 2.35, 6.2, 1.55);
    scene.add(torch);

    // Secondary soft rim light slightly behind player
    const fillLight = new THREE.PointLight(0x7aa2d4, 0.42, 4.5, 1.8);
    scene.add(fillLight);

    const maxAniso = isSoftwareGl ? 1 : Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const texLib = getTextureLibrary();

    // Shared materials updated when textures change
    const wallMat = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0.06, bumpScale: 0.025 });
    const floorMat = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.05, bumpScale: 0.02 });
    const ceilMat = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0.05, bumpScale: 0.02 });

    let activeTexDisposables: THREE.Texture[] = [];

    const applyTextures = (tc: TextureChoice) => {
      activeTexDisposables.forEach((t) => t.dispose());
      activeTexDisposables = [];

      const wEntry = texLib.wall[tc.wall] ?? texLib.wall[1];
      const fEntry = texLib.floor[tc.floor] ?? texLib.floor[0];
      const cEntry = texLib.ceil[tc.ceil] ?? texLib.ceil[1];

      const wTex = createThreeTextures(wEntry, maxAniso);
      const fTex = createThreeTextures(fEntry, maxAniso);
      const cTex = createThreeTextures(cEntry, maxAniso);

      activeTexDisposables.push(wTex.map, wTex.bumpMap, fTex.map, fTex.bumpMap, cTex.map, cTex.bumpMap);

      wallMat.map = wTex.map;
      wallMat.bumpMap = wTex.bumpMap;
      wallMat.roughness = wEntry.roughness;
      wallMat.metalness = wEntry.metalness;
      wallMat.needsUpdate = true;

      floorMat.map = fTex.map;
      floorMat.bumpMap = fTex.bumpMap;
      floorMat.roughness = fEntry.roughness;
      floorMat.metalness = fEntry.metalness;
      floorMat.needsUpdate = true;

      ceilMat.map = cTex.map;
      ceilMat.bumpMap = cTex.bumpMap;
      ceilMat.roughness = cEntry.roughness;
      ceilMat.metalness = cEntry.metalness;
      ceilMat.needsUpdate = true;
    };

    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    const altarMap = new Map<number, { inst: AnimatedModelInstance; light: THREE.PointLight }>();
    const monsterMap = new Map<number, { inst: AnimatedModelInstance; entity: MonsterEntity }>();
    let worldGeos: THREE.BufferGeometry[] = [];
    let worldMats: THREE.Material[] = [];
    let exitBeaconMesh: THREE.Mesh | null = null;
    let exitLight: THREE.PointLight | null = null;

    const clearWorld = () => {
      altarMap.forEach(({ inst }) => inst.dispose());
      altarMap.clear();
      monsterMap.forEach(({ inst }) => inst.dispose());
      monsterMap.clear();
      worldGeos.forEach((g) => g.dispose());
      worldGeos = [];
      worldMats.forEach((m) => m.dispose());
      worldMats = [];
      exitBeaconMesh = null;
      exitLight = null;
      while (worldGroup.children.length > 0) {
        worldGroup.remove(worldGroup.children[0]);
      }
    };

    const rebuildMazeGeometry = (m: GeneratedMaze, tc: TextureChoice) => {
      clearWorld();
      applyTextures(tc);

      const size = m.size;
      const wallPositions: Array<[number, number]> = [];
      const openPositions: Array<[number, number]> = [];

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (m.map[y][x] === 1) {
            wallPositions.push([x, y]);
          } else {
            openPositions.push([x, y]);
          }
        }
      }

      // Instanced walls
      if (wallPositions.length > 0) {
        const boxGeo = new THREE.BoxGeometry(CELL, WALL_H, CELL);
        worldGeos.push(boxGeo);
        const wallInst = new THREE.InstancedMesh(boxGeo, wallMat, wallPositions.length);
        wallPositions.forEach(([x, y], i) => {
          _dummy.position.set(x * CELL, WALL_H / 2, y * CELL);
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.set(1, 1, 1);
          _dummy.updateMatrix();
          wallInst.setMatrixAt(i, _dummy.matrix);
        });
        wallInst.instanceMatrix.needsUpdate = true;
        wallInst.computeBoundingSphere();
        worldGroup.add(wallInst);
      }

      // Instanced floors & ceilings
      if (openPositions.length > 0) {
        const floorGeo = new THREE.PlaneGeometry(CELL, CELL);
        floorGeo.rotateX(-Math.PI / 2);
        worldGeos.push(floorGeo);
        const floorInst = new THREE.InstancedMesh(floorGeo, floorMat, openPositions.length);

        const ceilGeo = new THREE.PlaneGeometry(CELL, CELL);
        ceilGeo.rotateX(Math.PI / 2);
        worldGeos.push(ceilGeo);
        const ceilInst = new THREE.InstancedMesh(ceilGeo, ceilMat, openPositions.length);

        openPositions.forEach(([x, y], i) => {
          _dummy.position.set(x * CELL, 0, y * CELL);
          _dummy.rotation.set(0, 0, 0);
          _dummy.scale.set(1, 1, 1);
          _dummy.updateMatrix();
          floorInst.setMatrixAt(i, _dummy.matrix);

          _dummy.position.set(x * CELL, WALL_H, y * CELL);
          _dummy.updateMatrix();
          ceilInst.setMatrixAt(i, _dummy.matrix);
        });
        floorInst.instanceMatrix.needsUpdate = true;
        floorInst.computeBoundingSphere();
        ceilInst.instanceMatrix.needsUpdate = true;
        ceilInst.computeBoundingSphere();
        worldGroup.add(floorInst, ceilInst);
      }

      // Start tile golden inlaid marker
      const padGeo = new THREE.PlaneGeometry(0.84, 0.84);
      padGeo.rotateX(-Math.PI / 2);
      worldGeos.push(padGeo);

      const startPadMat = new THREE.MeshStandardMaterial({
        color: 0xe6aa1e,
        emissive: 0xb47908,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.72,
        roughness: 0.5,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      worldMats.push(startPadMat);
      const startPad = new THREE.Mesh(padGeo, startPadMat);
      startPad.position.set(m.startPos.x * CELL, 0.008, m.startPos.y * CELL);
      worldGroup.add(startPad);

      // Goal tile emerald portal pad + beacon
      const goalPadMat = new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x16a34a,
        emissiveIntensity: 0.75,
        transparent: true,
        opacity: 0.78,
        roughness: 0.35,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      worldMats.push(goalPadMat);
      const goalPad = new THREE.Mesh(padGeo, goalPadMat);
      goalPad.position.set(m.goalPos.x * CELL, 0.008, m.goalPos.y * CELL);
      worldGroup.add(goalPad);

      const beaconGeo = new THREE.CylinderGeometry(0.16, 0.32, 0.96, 14, 1, true);
      worldGeos.push(beaconGeo);
      const beaconMat = new THREE.MeshBasicMaterial({
        color: 0x4ade80,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      worldMats.push(beaconMat);
      exitBeaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
      exitBeaconMesh.position.set(m.goalPos.x * CELL, 0.48, m.goalPos.y * CELL);
      worldGroup.add(exitBeaconMesh);

      exitLight = new THREE.PointLight(0x4ade80, 0.9, 3.2, 1.8);
      exitLight.position.set(m.goalPos.x * CELL, 0.45, m.goalPos.y * CELL);
      worldGroup.add(exitLight);

      // Build Altars
      for (const al of m.altars) {
        const inst = createModel3D('altar');
        inst.group.position.set(al.x * CELL, 0, al.y * CELL);
        worldGroup.add(inst.group);

        const light = new THREE.PointLight(0x7df9ff, al.lit ? 1.4 : 0.15, 2.8, 1.8);
        light.position.set(al.x * CELL, 0.58, al.y * CELL);
        worldGroup.add(light);

        altarMap.set(al.id, { inst, light });
      }

      // Build Monsters
      for (const mo of m.monsters) {
        const inst = createModel3D(mo.type);
        inst.group.position.set(mo.x * CELL, 0, mo.y * CELL);
        worldGroup.add(inst.group);
        monsterMap.set(mo.id, { inst, entity: mo });
      }

      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }
    };

    // Camera smooth state
    const camState = {
      x: stateRef.current.player.x * CELL,
      z: stateRef.current.player.y * CELL,
      yaw: -stateRef.current.player.yawSteps * (Math.PI / 2),
      bobPhase: 0,
      bobAmp: 0,
    };

    const syncCameraImmediate = (p: PlayerState) => {
      camState.x = p.x * CELL;
      camState.z = p.y * CELL;
      camState.yaw = -p.yawSteps * (Math.PI / 2);
      camState.bobAmp = 0;
    };

    sceneApiRef.current = {
      rebuildMazeGeometry,
      updateTexturesOnly: applyTextures,
      syncCameraImmediate,
    };

    rebuildMazeGeometry(mazeRef.current, texRef.current);

    const resize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      const aspect = w / Math.max(1, h);
      camera.aspect = aspect;
      // Keep desktop & landscape at exact 72 deg; gently widen vertical FOV in portrait so corridor side walls stay visible
      camera.fov = aspect < 1 ? Math.min(102, 72 / Math.pow(aspect, 0.42)) : 72;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    window.addEventListener('orientationchange', resize);

    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    const startTime = lastTime;

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
        if (st === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;

      const now = performance.now();
      const dt = Math.min(0.08, (now - lastTime) / 1000);
      lastTime = now;
      const elapsed = (now - startTime) / 1000;

      const { gameState: gs, player: p, altars: latestAltars, monsters: latestMonsters, allAltarsLit: litAll } =
        stateRef.current;

      if (gs === 'MENU') {
        // Gentle ambient camera breathing looking down the torchlit menu showcase corridor
        camera.position.set(
          4.0 + Math.sin(elapsed * 0.45) * 0.08,
          EYE_Y + Math.sin(elapsed * 0.9) * 0.02,
          5.35 + Math.cos(elapsed * 0.35) * 0.14,
        );
        camera.rotation.set(
          Math.sin(elapsed * 0.5) * 0.02,
          Math.sin(elapsed * 0.3) * 0.09,
          0,
          'YXZ',
        );
      } else {
        const targetX = p.x * CELL;
        const targetZ = p.y * CELL;
        const targetYaw = -p.yawSteps * (Math.PI / 2);

        const prevX = camState.x;
        const prevZ = camState.z;

        camState.x = THREE.MathUtils.damp(camState.x, targetX, 15, dt);
        camState.z = THREE.MathUtils.damp(camState.z, targetZ, 15, dt);
        camState.yaw = THREE.MathUtils.damp(camState.yaw, targetYaw, 16, dt);

        const speed = Math.hypot(camState.x - prevX, camState.z - prevZ) / Math.max(dt, 0.001);
        const targetBob = Math.min(1, speed * 0.25);
        camState.bobAmp = THREE.MathUtils.damp(camState.bobAmp, targetBob, 12, dt);
        if (camState.bobAmp > 0.01) {
          camState.bobPhase += dt * 13;
        }

        const bobY = Math.sin(camState.bobPhase) * 0.024 * camState.bobAmp;
        camera.position.set(camState.x, EYE_Y + bobY, camState.z);
        camera.rotation.set(0, camState.yaw, 0, 'YXZ');
      }

      // Flickering warm player torchlight
      const flicker = 1 + Math.sin(elapsed * 7.3) * 0.035 + Math.sin(elapsed * 13.7) * 0.02;
      torch.intensity = 2.35 * flicker;
      torch.position.set(camera.position.x, camera.position.y + 0.08, camera.position.z);
      fillLight.position.set(camera.position.x, camera.position.y - 0.1, camera.position.z);

      // Update Altars
      for (const al of latestAltars) {
        const entry = altarMap.get(al.id);
        if (!entry) continue;
        entry.inst.update(elapsed, al.lit);
        entry.light.intensity = al.lit ? 1.45 + Math.sin(elapsed * 3.5 + al.id) * 0.2 : 0.12;
      }

      // Update Exit portal beacon
      if (exitBeaconMesh && exitLight) {
        const bMat = exitBeaconMesh.material as THREE.MeshBasicMaterial;
        exitBeaconMesh.rotation.y = elapsed * 0.7;
        if (litAll) {
          bMat.opacity = 0.22 + 0.08 * Math.sin(elapsed * 4);
          exitLight.intensity = 1.85 + 0.35 * Math.sin(elapsed * 4);
        } else {
          bMat.opacity = 0.07;
          exitLight.intensity = 0.55;
        }
      }

      // Update Monsters smooth movement + lookAt camera
      for (const mo of latestMonsters) {
        const entry = monsterMap.get(mo.id);
        if (!entry) continue;
        const prog = mo.moveStart > 0 ? Math.min(1, (now - mo.moveStart) / MONSTER_MOVE_MS) : 1;
        const ease = (1 - Math.cos(Math.PI * prog)) / 2;
        const wx = (mo.fromX + (mo.x - mo.fromX) * ease) * CELL;
        const wz = (mo.fromY + (mo.y - mo.fromY) * ease) * CELL;

        // Hide monster if practically overlapping the player camera
        const distToCam = Math.hypot(wx - camera.position.x, wz - camera.position.z);
        entry.inst.group.visible = distToCam > 0.32;
        entry.inst.group.position.set(wx, 0, wz);

        // Smoothly face camera with subtle organic sway
        const angleToCam = Math.atan2(camera.position.x - wx, camera.position.z - wz);
        entry.inst.group.rotation.y = angleToCam + Math.sin(elapsed * 0.9 + mo.seed) * 0.24;
        entry.inst.update(elapsed + mo.seed);
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      window.removeEventListener('orientationchange', resize);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      clearWorld();
      activeTexDisposables.forEach((t) => t.dispose());
      wallMat.dispose();
      floorMat.dispose();
      ceilMat.dispose();
      envRT.dispose();
      renderer.dispose();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
      sceneApiRef.current = null;
    };
  }, []);

  // Rebuild 3D maze geometry whenever a new maze is generated
  useEffect(() => {
    sceneApiRef.current?.rebuildMazeGeometry(maze, texChoice);
    sceneApiRef.current?.syncCameraImmediate(player);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maze]);

  // Swap textures live without tearing down the scene or resetting camera
  useEffect(() => {
    sceneApiRef.current?.updateTexturesOnly(texChoice);
  }, [texChoice]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (gameState !== 'PLAYING' || !onSwipeAction || e.touches.length !== 1) return;
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (gameState !== 'PLAYING' || !onSwipeAction || !touchStartRef.current) return;
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 32) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      onSwipeAction(dx > 0 ? 'RIGHT' : 'LEFT');
    } else {
      onSwipeAction(dy < 0 ? 'FORWARD' : 'BACKWARD');
    }
  };

  return (
    <div
      className="relative w-full h-full bg-[#060911]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div ref={containerRef} className="w-full h-full" />
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#090d16] text-slate-300 text-sm px-6 text-center">
          3D 繪圖環境暫時中斷，請重新整理頁面以恢復畫面。
        </div>
      )}
    </div>
  );
};
