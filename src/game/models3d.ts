import * as THREE from 'three';
import { ModelId } from './types';

export interface ModelMeta {
  id: ModelId;
  name: string;
  cat: 'monster' | 'altar' | 'item' | 'trap';
  face: 'player' | 'world' | 'spin';
  shadowRadius: number;
  description: string;
}

export interface AnimatedModelInstance {
  group: THREE.Group;
  update: (t: number, state?: boolean) => void;
  dispose: () => void;
}

export const MODEL_CATALOG: Record<ModelId, ModelMeta> = {
  slime: { id: 'slime', name: '史萊姆', cat: 'monster', face: 'player', shadowRadius: 0.28, description: '彈跳伸縮的翠綠凝膠生物，在潮濕走廊中緩緩蠕動。' },
  skeleton: { id: 'skeleton', name: '骷髏兵', cat: 'monster', face: 'player', shadowRadius: 0.2, description: '揮舞鋼劍、雙眼閃著紅光的古代守衛遺骸。' },
  bat: { id: 'bat', name: '蝙蝠', cat: 'monster', face: 'player', shadowRadius: 0.12, description: '在天花板下高速拍翼盤旋的暗紫洞窟蝙蝠。' },
  ghost: { id: 'ghost', name: '幽靈', cat: 'monster', face: 'player', shadowRadius: 0.18, description: '半透明漂浮的迷途靈體，裙擺隨氣流緩緩旋轉。' },
  eyeball: { id: 'eyeball', name: '獨眼怪', cat: 'monster', face: 'player', shadowRadius: 0.15, description: '懸浮半空、五條觸鬚搖曳並四處張望的巨大眼球。' },
  mushroom: { id: 'mushroom', name: '蘑菇怪', cat: 'monster', face: 'player', shadowRadius: 0.26, description: '頂著紅底白點蕈傘、蹦蹦跳跳巡邏的真菌精怪。' },
  golem: { id: 'golem', name: '石像魔像', cat: 'monster', face: 'player', shadowRadius: 0.3, description: '胸口鑲嵌脈動能量核心的厚重古代石像守衛。' },
  spider: { id: 'spider', name: '巨型蜘蛛', cat: 'monster', face: 'player', shadowRadius: 0.3, description: '八足交錯邁進、腹部帶有猩紅印記的暗影蜘蛛。' },
  flame: { id: 'flame', name: '火焰精靈', cat: 'monster', face: 'player', shadowRadius: 0.15, description: '熾熱跳動的火舌聚靈，周身不斷飄散金色火星。' },
  snake: { id: 'snake', name: '毒蛇', cat: 'monster', face: 'player', shadowRadius: 0.24, description: '盤踞走廊、昂首搖擺並吐出猩紅蛇信的劇毒蟒蛇。' },
  altar: { id: 'altar', name: '祭壇', cat: 'altar', face: 'world', shadowRadius: 0, description: '點亮所有祭壇以解除迷宮出口封印。' },
  chest: { id: 'chest', name: '寶箱（關）', cat: 'item', face: 'world', shadowRadius: 0.3, description: '鑲金邊飾的厚重橡木寶箱。' },
  chestOpen: { id: 'chestOpen', name: '寶箱（開）', cat: 'item', face: 'world', shadowRadius: 0.3, description: '已開啟並裝滿金幣與紅寶石的秘寶箱。' },
  potion: { id: 'potion', name: '補血藥水', cat: 'item', face: 'spin', shadowRadius: 0.1, description: '封存緋紅藥液的圓腹玻璃藥瓶。' },
  key: { id: 'key', name: '鑰匙', cat: 'item', face: 'spin', shadowRadius: 0.12, description: '閃爍微光的純金古鑰匙。' },
  spikes: { id: 'spikes', name: '地刺陷阱', cat: 'trap', face: 'world', shadowRadius: 0, description: '週期性伸縮的九連精鋼尖刺機關。' },
  teleport: { id: 'teleport', name: '傳送陣', cat: 'trap', face: 'world', shadowRadius: 0, description: '旋轉紫色符環與光柱構成的空間傳送陣。' },
};

const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vDir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

interface BuildTracker {
  geos: THREE.BufferGeometry[];
  mats: THREE.Material[];
}

function trackGeo<T extends THREE.BufferGeometry>(tr: BuildTracker, g: T): T {
  tr.geos.push(g);
  return g;
}

function trackMat<T extends THREE.Material>(tr: BuildTracker, m: T): T {
  tr.mats.push(m);
  return m;
}

function stdMat(
  tr: BuildTracker,
  color: string | number,
  opts: {
    roughness?: number;
    metalness?: number;
    glow?: boolean;
    alpha?: number;
    two?: boolean;
  } = {},
): THREE.MeshStandardMaterial {
  const col = new THREE.Color(color);
  const mat = new THREE.MeshStandardMaterial({
    color: col,
    roughness: opts.roughness ?? (opts.glow ? 0.25 : 0.72),
    metalness: opts.metalness ?? 0.08,
    emissive: opts.glow ? col : new THREE.Color(0x000000),
    emissiveIntensity: opts.glow ? 1.35 : 0,
    transparent: (opts.alpha ?? 1) < 1,
    opacity: opts.alpha ?? 1,
    depthWrite: (opts.alpha ?? 1) >= 0.99,
    side: opts.two ? THREE.DoubleSide : THREE.FrontSide,
  });
  return trackMat(tr, mat);
}

function addBox(
  parent: THREE.Object3D,
  tr: BuildTracker,
  pos: [number, number, number],
  size: [number, number, number],
  mat: THREE.Material,
): THREE.Mesh {
  const geo = trackGeo(tr, new THREE.BoxGeometry(size[0], size[1], size[2]));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos[0], pos[1] + size[1] / 2, pos[2]);
  parent.add(mesh);
  return mesh;
}

function addSphere(
  parent: THREE.Object3D,
  tr: BuildTracker,
  pos: [number, number, number],
  rad: [number, number, number],
  mat: THREE.Material,
  opts: { seg?: number; rings?: number; half?: boolean } = {},
): THREE.Mesh {
  const geo = trackGeo(
    tr,
    new THREE.SphereGeometry(
      1,
      opts.seg ?? 12,
      opts.rings ?? 8,
      0,
      Math.PI * 2,
      0,
      opts.half ? Math.PI / 2 : Math.PI,
    ),
  );
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.scale.set(rad[0], rad[1], rad[2]);
  parent.add(mesh);
  return mesh;
}

function addFrustum(
  parent: THREE.Object3D,
  tr: BuildTracker,
  pos: [number, number, number],
  rBottom: number,
  rTop: number,
  height: number,
  mat: THREE.Material,
  opts: { seg?: number; openEnded?: boolean } = {},
): THREE.Mesh {
  const absH = Math.abs(height);
  const flipped = height < 0;
  const geo = trackGeo(
    tr,
    new THREE.CylinderGeometry(
      flipped ? rBottom : rTop,
      flipped ? rTop : rBottom,
      absH,
      opts.seg ?? 8,
      1,
      !!opts.openEnded,
    ),
  );
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos[0], pos[1] + height / 2, pos[2]);
  parent.add(mesh);
  return mesh;
}

function addBeam(
  parent: THREE.Object3D,
  tr: BuildTracker,
  a: [number, number, number],
  b: [number, number, number],
  thickness: number,
  mat: THREE.Material,
): THREE.Mesh {
  _vA.set(a[0], a[1], a[2]);
  _vB.set(b[0], b[1], b[2]);
  _vDir.subVectors(_vB, _vA);
  const length = _vDir.length();
  const geo = trackGeo(tr, new THREE.BoxGeometry(thickness, length || 0.001, thickness));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(_vA).add(_vB).multiplyScalar(0.5);
  if (length > 1e-5) {
    _vDir.normalize();
    mesh.quaternion.setFromUnitVectors(_up, _vDir);
  }
  parent.add(mesh);
  return mesh;
}

function addContactShadow(parent: THREE.Object3D, tr: BuildTracker, radius: number) {
  if (radius <= 0) return;
  const geo = trackGeo(tr, new THREE.CircleGeometry(radius, 18));
  geo.rotateX(-Math.PI / 2);
  const mat = trackMat(
    tr,
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    }),
  );
  const shadow = new THREE.Mesh(geo, mat);
  shadow.position.y = 0.006;
  parent.add(shadow);
}

/**
 * Create a Three.js composite animated model matching the original M3D catalog
 * Model local coordinates: 1 unit = 1 tile, y = 0 is floor, front faces +Z (rotated toward viewer)
 */
export function createModel3D(id: ModelId): AnimatedModelInstance {
  const tr: BuildTracker = { geos: [], mats: [] };
  const group = new THREE.Group();
  const body = new THREE.Group();
  // Original M3D models face -Z; rotate 180 deg so local front is +Z (standard Three.js lookAt)
  body.rotation.y = Math.PI;
  group.add(body);

  const meta = MODEL_CATALOG[id];
  addContactShadow(group, tr, meta.shadowRadius);

  let update: (t: number, state?: boolean) => void = () => {};

  switch (id) {
    case 'slime': {
      const mBody = stdMat(tr, '#45c043', { roughness: 0.22, metalness: 0.05, alpha: 0.92 });
      const mEye = stdMat(tr, '#0d1a0d', { roughness: 0.15 });
      const mSpec = stdMat(tr, '#eaffea', { glow: true });
      const jelly = new THREE.Group();
      body.add(jelly);
      addSphere(jelly, tr, [0, 0.2, 0], [0.28, 0.2, 0.28], mBody, { seg: 16, rings: 12 });
      for (const sx of [-1, 1]) {
        addSphere(jelly, tr, [sx * 0.085, 0.26, -0.255], [0.036, 0.052, 0.025], mEye, { seg: 8, rings: 6 });
      }
      addSphere(jelly, tr, [-0.11, 0.33, -0.13], [0.052, 0.024, 0.04], mSpec, { seg: 8, rings: 6 });
      update = (t) => {
        const s = Math.sin(t * 4);
        jelly.scale.set(1 - 0.08 * s, 1 + 0.16 * s, 1 - 0.08 * s);
      };
      break;
    }

    case 'skeleton': {
      const mBone = stdMat(tr, '#e6dfcc', { roughness: 0.78 });
      const mSocket = stdMat(tr, '#111111', { roughness: 0.9 });
      const mRed = stdMat(tr, '#ff3b3b', { glow: true });
      const mGrip = stdMat(tr, '#6b4a1f', { roughness: 0.85 });
      const mGold = stdMat(tr, '#c9a227', { roughness: 0.28, metalness: 0.82 });
      const mSteel = stdMat(tr, '#c3ccd5', { roughness: 0.22, metalness: 0.88 });

      addBeam(body, tr, [-0.06, 0, 0], [-0.06, 0.32, 0], 0.045, mBone);
      addBeam(body, tr, [0.06, 0, 0], [0.06, 0.32, 0], 0.045, mBone);
      addBox(body, tr, [0, 0.3, 0], [0.2, 0.06, 0.09], mBone);
      addBeam(body, tr, [0, 0.34, 0], [0, 0.62, 0], 0.04, mBone);
      for (let i = 0; i < 4; i++) {
        addBox(body, tr, [0, 0.4 + i * 0.05, -0.01], [0.22 - i * 0.025, 0.022, 0.13], mBone);
      }
      addBox(body, tr, [0, 0.6, 0], [0.28, 0.035, 0.06], mBone);
      addBeam(body, tr, [-0.14, 0.6, 0], [-0.16, 0.4, -0.02], 0.035, mBone);

      // Sword arm pivot
      const armPivot = new THREE.Group();
      armPivot.position.set(0.14, 0.6, 0);
      body.add(armPivot);
      addBeam(armPivot, tr, [0, 0, 0], [0.01, -0.2, 0], 0.035, mBone);
      addBox(armPivot, tr, [0.01, -0.24, 0], [0.025, 0.06, 0.025], mGrip);
      addBox(armPivot, tr, [0.01, -0.18, 0], [0.1, 0.02, 0.035], mGold);
      addBox(armPivot, tr, [0.01, -0.16, 0], [0.03, 0.34, 0.014], mSteel);

      // Skull
      addSphere(body, tr, [0, 0.72, 0], [0.088, 0.088, 0.092], mBone, { seg: 12, rings: 8 });
      addBox(body, tr, [0, 0.62, -0.02], [0.1, 0.045, 0.08], mBone);
      for (const sx of [-1, 1]) {
        addSphere(body, tr, [sx * 0.033, 0.73, -0.082], [0.022, 0.026, 0.014], mSocket, { seg: 8, rings: 6 });
        addSphere(body, tr, [sx * 0.033, 0.73, -0.093], [0.009, 0.009, 0.007], mRed, { seg: 6, rings: 4 });
      }

      update = (t) => {
        armPivot.rotation.x = -(0.45 + 0.6 * Math.sin(t * 3));
      };
      break;
    }

    case 'bat': {
      const mFur = stdMat(tr, '#4a2c58', { roughness: 0.86 });
      const mWing = stdMat(tr, '#3b2346', { roughness: 0.78, two: true });
      const mEye = stdMat(tr, '#ff4040', { glow: true });
      const hover = new THREE.Group();
      body.add(hover);

      addSphere(hover, tr, [0, 0.42, 0], [0.072, 0.092, 0.068], mFur, { seg: 10, rings: 8 });
      addSphere(hover, tr, [0, 0.53, -0.01], [0.056, 0.052, 0.052], mFur, { seg: 10, rings: 8 });

      const wingPivots: Array<{ pivot: THREE.Group; s: number }> = [];
      for (const s of [-1, 1]) {
        addFrustum(hover, tr, [s * 0.03, 0.56, -0.01], 0.02, 0, 0.06, mFur, { seg: 5 });
        addSphere(hover, tr, [s * 0.022, 0.54, -0.055], [0.013, 0.013, 0.008], mEye, { seg: 6, rings: 4 });

        const pivot = new THREE.Group();
        pivot.position.set(s * 0.05, 0.44, 0.01);
        hover.add(pivot);

        const shape = new THREE.Shape();
        const pts: Array<[number, number]> = [
          [0, 0.03],
          [s * 0.25, 0.12],
          [s * 0.37, 0.02],
          [s * 0.29, -0.02],
          [s * 0.23, -0.06],
          [s * 0.15, -0.02],
          [s * 0.08, -0.07],
          [s * 0.01, -0.05],
        ];
        shape.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
        shape.closePath();
        const wingGeo = trackGeo(tr, new THREE.ShapeGeometry(shape));
        const wingMesh = new THREE.Mesh(wingGeo, mWing);
        pivot.add(wingMesh);
        wingPivots.push({ pivot, s });
      }

      update = (t) => {
        hover.position.y = 0.035 * Math.sin(t * 3);
        const flap = Math.sin(t * 12) * 0.72;
        for (const w of wingPivots) {
          w.pivot.rotation.z = w.s * flap;
        }
      };
      break;
    }

    case 'ghost': {
      const mSheet = stdMat(tr, '#dce6ff', { roughness: 0.4, alpha: 0.78, glow: false });
      mSheet.emissive.set('#6b88c9');
      mSheet.emissiveIntensity = 0.35;
      const mDark = stdMat(tr, '#1b1f3a', { roughness: 0.9 });

      const hover = new THREE.Group();
      body.add(hover);
      addFrustum(hover, tr, [0, 0.08, 0], 0.2, 0.16, 0.3, mSheet, { seg: 14, openEnded: true });
      addSphere(hover, tr, [0, 0.38, 0], [0.16, 0.16, 0.16], mSheet, { seg: 14, rings: 8, half: true });

      const skirt = new THREE.Group();
      hover.add(skirt);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        addFrustum(skirt, tr, [Math.cos(a) * 0.15, 0.085, Math.sin(a) * 0.15], 0.05, 0, -0.075, mSheet, { seg: 6 });
      }
      const hands: THREE.Mesh[] = [];
      for (const s of [-1, 1]) {
        addSphere(hover, tr, [s * 0.06, 0.44, -0.145], [0.03, 0.045, 0.02], mDark, { seg: 8, rings: 6 });
        hands.push(addSphere(hover, tr, [s * 0.22, 0.28, 0], [0.05, 0.04, 0.04], mSheet, { seg: 8, rings: 6 }));
      }
      addSphere(hover, tr, [0, 0.33, -0.172], [0.03, 0.04, 0.015], mDark, { seg: 8, rings: 6 });

      update = (t) => {
        hover.position.y = 0.035 * Math.sin(t * 2);
        skirt.rotation.y = t * 1.1;
        hands[0].position.y = 0.28 + 0.03 * Math.sin(t * 3 - 1);
        hands[1].position.y = 0.28 + 0.03 * Math.sin(t * 3 + 1);
      };
      break;
    }

    case 'eyeball': {
      const mSclera = stdMat(tr, '#f2ece6', { roughness: 0.28 });
      const mIris = stdMat(tr, '#2e86c1', { roughness: 0.22 });
      const mPupil = stdMat(tr, '#050505', { roughness: 0.15 });
      const mGlint = stdMat(tr, '#ffffff', { glow: true });
      const mTent = stdMat(tr, '#7a3d8f', { roughness: 0.65 });

      const hover = new THREE.Group();
      body.add(hover);
      addSphere(hover, tr, [0, 0.4, 0], [0.2, 0.2, 0.2], mSclera, { seg: 16, rings: 12 });

      const eyeGroup = new THREE.Group();
      hover.add(eyeGroup);
      addSphere(eyeGroup, tr, [0, 0.4, -0.19], [0.082, 0.082, 0.03], mIris, { seg: 12, rings: 8 });
      addSphere(eyeGroup, tr, [0, 0.4, -0.214], [0.042, 0.042, 0.014], mPupil, { seg: 10, rings: 6 });
      addSphere(eyeGroup, tr, [-0.022, 0.422, -0.224], [0.014, 0.014, 0.008], mGlint, { seg: 6, rings: 4 });

      const tentacles: THREE.Group[] = [];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        const tPivot = new THREE.Group();
        tPivot.position.set(Math.cos(a) * 0.1, 0.26, Math.sin(a) * 0.1);
        hover.add(tPivot);
        for (let j = 0; j < 4; j++) {
          const r = 0.02 - j * 0.003;
          addFrustum(tPivot, tr, [Math.cos(a) * j * 0.02, -j * 0.06, Math.sin(a) * j * 0.02], r, r * 1.15, -0.065, mTent, { seg: 6 });
        }
        tentacles.push(tPivot);
      }

      update = (t) => {
        hover.position.y = 0.03 * Math.sin(t * 2);
        eyeGroup.position.x = Math.sin(t * 1.3) * 0.055;
        eyeGroup.position.y = Math.cos(t * 1.7) * 0.03;
        tentacles.forEach((tp, i) => {
          tp.rotation.z = Math.sin(t * 3 + i * 1.3) * 0.22;
          tp.rotation.x = Math.cos(t * 2.5 + i) * 0.15;
        });
      };
      break;
    }

    case 'mushroom': {
      const mFoot = stdMat(tr, '#c8b28a', { roughness: 0.82 });
      const mStem = stdMat(tr, '#efe2c4', { roughness: 0.78 });
      const mCap = stdMat(tr, '#d8322a', { roughness: 0.52 });
      const mUnder = stdMat(tr, '#e9d7b0', { roughness: 0.85 });
      const mSpot = stdMat(tr, '#ffffff', { roughness: 0.6 });
      const mEye = stdMat(tr, '#1c1c1c', { roughness: 0.2 });

      const feet: THREE.Mesh[] = [];
      for (const s of [-1, 1]) {
        feet.push(addSphere(body, tr, [s * 0.075, 0.03, -0.02], [0.05, 0.03, 0.06], mFoot, { seg: 8, rings: 6 }));
      }
      const bounce = new THREE.Group();
      body.add(bounce);
      addFrustum(bounce, tr, [0, 0.04, 0], 0.12, 0.1, 0.28, mStem, { seg: 12 });
      for (const s of [-1, 1]) {
        addSphere(bounce, tr, [s * 0.04, 0.2, -0.112], [0.017, 0.024, 0.012], mEye, { seg: 6, rings: 4 });
      }
      addSphere(bounce, tr, [0, 0.3, 0], [0.28, 0.2, 0.28], mCap, { seg: 16, rings: 10, half: true });
      const gillGeo = trackGeo(tr, new THREE.CircleGeometry(0.28, 16));
      gillGeo.rotateX(Math.PI / 2);
      const gill = new THREE.Mesh(gillGeo, mUnder);
      gill.position.y = 0.3;
      bounce.add(gill);

      for (const [th, ph, r] of [
        [0.35, 1.9, 0.045],
        [0.8, 4.4, 0.04],
        [0.9, 1.0, 0.035],
        [0.65, 3.2, 0.032],
        [0.95, 5.6, 0.04],
        [0.2, 0.2, 0.03],
        [0.75, 2.4, 0.035],
      ]) {
        addSphere(
          bounce,
          tr,
          [0.28 * Math.sin(th) * Math.cos(ph), 0.3 + 0.2 * Math.cos(th), 0.28 * Math.sin(th) * Math.sin(ph)],
          [r, r * 0.62, r],
          mSpot,
          { seg: 8, rings: 6 },
        );
      }

      update = (t) => {
        bounce.position.y = Math.abs(Math.sin(t * 4)) * 0.038;
        feet[0].position.z = -0.02 - Math.sin(t * 8) * 0.025;
        feet[1].position.z = -0.02 + Math.sin(t * 8) * 0.025;
      };
      break;
    }

    case 'golem': {
      const mStone = stdMat(tr, '#7d7f86', { roughness: 0.92, metalness: 0.08 });
      const mDark = stdMat(tr, '#666870', { roughness: 0.95, metalness: 0.08 });
      const mHead = stdMat(tr, '#878991', { roughness: 0.88, metalness: 0.1 });
      const mFist = stdMat(tr, '#585a62', { roughness: 0.9 });
      const mEye = stdMat(tr, '#99ffff', { glow: true });
      const mCore = stdMat(tr, '#7be8f6', { glow: true });

      addBox(body, tr, [-0.1, 0, 0], [0.12, 0.26, 0.13], mDark);
      addBox(body, tr, [0.1, 0, 0], [0.12, 0.26, 0.13], mDark);
      addBox(body, tr, [0, 0.25, 0], [0.42, 0.32, 0.25], mStone);
      addBox(body, tr, [0, 0.57, -0.02], [0.18, 0.15, 0.16], mHead);
      for (const s of [-1, 1]) {
        addBox(body, tr, [s * 0.045, 0.62, -0.105], [0.036, 0.022, 0.012], mEye);
      }
      addBox(body, tr, [0, 0.39, -0.13], [0.075, 0.075, 0.014], mCore);

      const arms: Array<{ pivot: THREE.Group; s: number }> = [];
      for (const s of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(s * 0.28, 0.55, 0);
        body.add(pivot);
        addBox(pivot, tr, [0, -0.25, 0], [0.11, 0.28, 0.12], mDark);
        addBox(pivot, tr, [s * 0.01, -0.35, 0], [0.15, 0.11, 0.15], mFist);
        arms.push({ pivot, s });
      }

      update = (t) => {
        const step = Math.sin(t * 2.5);
        for (const a of arms) {
          a.pivot.rotation.x = -(a.s * step * 0.35 - 0.1);
        }
        mCore.emissiveIntensity = 0.8 + 0.8 * (0.5 + 0.5 * Math.sin(t * 4));
      };
      break;
    }

    case 'spider': {
      const mLeg = stdMat(tr, '#242428', { roughness: 0.65 });
      const mAbd = stdMat(tr, '#2b2b30', { roughness: 0.58 });
      const mMark = stdMat(tr, '#b91c1c', { roughness: 0.45 });
      const mHead = stdMat(tr, '#35353a', { roughness: 0.55 });
      const mEye = stdMat(tr, '#ff3030', { glow: true });
      const mFang = stdMat(tr, '#e5e7eb', { roughness: 0.3, metalness: 0.3 });

      addSphere(body, tr, [0, 0.2, 0.12], [0.17, 0.13, 0.2], mAbd, { seg: 12, rings: 8 });
      addSphere(body, tr, [0, 0.325, 0.12], [0.05, 0.014, 0.08], mMark, { seg: 8, rings: 4 });
      addSphere(body, tr, [0, 0.17, -0.12], [0.09, 0.08, 0.09], mHead, { seg: 10, rings: 8 });
      for (const [x, y, r] of [
        [-0.03, 0.2, 0.018],
        [0.03, 0.2, 0.018],
        [-0.012, 0.225, 0.011],
        [0.012, 0.225, 0.011],
      ]) {
        addSphere(body, tr, [x, y, -0.205], [r, r, r * 0.65], mEye, { seg: 6, rings: 4 });
      }
      addBeam(body, tr, [-0.025, 0.13, -0.19], [-0.03, 0.08, -0.21], 0.015, mFang);
      addBeam(body, tr, [0.025, 0.13, -0.19], [0.03, 0.08, -0.21], 0.015, mFang);

      const legs: Array<{ pivot: THREE.Group; phase: number; s: number }> = [];
      for (const s of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const hip: [number, number, number] = [s * 0.07, 0.17, -0.15 + i * 0.07];
          const pivot = new THREE.Group();
          pivot.position.set(hip[0], hip[1], hip[2]);
          body.add(pivot);
          const knee: [number, number, number] = [s * 0.15, 0.13, -0.05 + i * 0.04];
          const foot: [number, number, number] = [s * 0.27, -0.16, -0.15 + i * 0.11];
          addBeam(pivot, tr, [0, 0, 0], knee, 0.026, mLeg);
          addBeam(pivot, tr, knee, foot, 0.02, mLeg);
          legs.push({ pivot, phase: i * (Math.PI / 2) + (s > 0 ? Math.PI : 0), s });
        }
      }

      update = (t) => {
        for (const l of legs) {
          const lift = Math.max(0, Math.sin(t * 8 + l.phase));
          l.pivot.rotation.z = l.s * lift * 0.22;
        }
      };
      break;
    }

    case 'flame': {
      const mOuter = stdMat(tr, '#ff6a14', { glow: true });
      const mInner = stdMat(tr, '#ffd23f', { glow: true });
      const mCore = stdMat(tr, '#ff8c1a', { glow: true });
      const mEye = stdMat(tr, '#3a0a00', { roughness: 0.9 });
      const mSpark = stdMat(tr, '#ffcf6b', { glow: true, alpha: 0.9 });

      const hover = new THREE.Group();
      body.add(hover);
      addSphere(hover, tr, [0, 0.22, 0], [0.125, 0.115, 0.125], mCore, { seg: 12, rings: 8 });
      for (const s of [-1, 1]) {
        addSphere(hover, tr, [s * 0.045, 0.26, -0.115], [0.022, 0.03, 0.012], mEye, { seg: 6, rings: 4 });
      }

      const outerTongues: THREE.Mesh[] = [];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.4;
        const m = addFrustum(hover, tr, [Math.cos(a) * 0.09, 0.14, Math.sin(a) * 0.09], 0.07, 0, 0.28, mOuter, { seg: 5 });
        outerTongues.push(m);
      }
      const innerTongues: THREE.Mesh[] = [];
      const innerGroup = new THREE.Group();
      hover.add(innerGroup);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const m = addFrustum(innerGroup, tr, [Math.cos(a) * 0.04, 0.18, Math.sin(a) * 0.04], 0.05, 0, 0.3, mInner, { seg: 5 });
        innerTongues.push(m);
      }
      const sparks: THREE.Mesh[] = [];
      for (let i = 0; i < 5; i++) {
        sparks.push(addBox(hover, tr, [0, 0.35, 0], [0.022, 0.022, 0.022], mSpark));
      }

      update = (t) => {
        hover.position.y = 0.03 * Math.sin(t * 3);
        outerTongues.forEach((m, i) => {
          m.scale.y = 0.85 + 0.32 * Math.sin(t * 9 + i * 1.7);
        });
        innerGroup.rotation.y = t * 1.4;
        innerTongues.forEach((m, i) => {
          m.scale.y = 0.85 + 0.28 * Math.sin(t * 11 + i * 2.3);
        });
        sparks.forEach((sp, i) => {
          const k = (t * 0.6 + i / 5) % 1;
          const a = i * 2.1 + t * 0.5;
          sp.position.set(Math.cos(a) * 0.12, 0.32 + k * 0.36, Math.sin(a) * 0.12);
          sp.scale.setScalar(Math.max(0.15, 1 - k));
        });
      };
      break;
    }

    case 'snake': {
      const mG1 = stdMat(tr, '#3f8f3a', { roughness: 0.48 });
      const mG2 = stdMat(tr, '#2f6e2c', { roughness: 0.54 });
      const mHead = stdMat(tr, '#4aa043', { roughness: 0.44 });
      const mEye = stdMat(tr, '#ffe14d', { glow: true });
      const mTongue = stdMat(tr, '#e11d48', { glow: true });

      let last: [number, number, number] = [0, 0.05, 0.04];
      for (let i = 0; i < 16; i++) {
        const a = i * 0.75;
        const r = 0.18 - i * 0.006;
        const p: [number, number, number] = [Math.cos(a) * r, 0.05 + i * 0.012, Math.sin(a) * r + 0.04];
        const rad = 0.062 - i * 0.0012;
        addSphere(body, tr, p, [rad, 0.05, rad], i % 2 ? mG1 : mG2, { seg: 8, rings: 6 });
        last = p;
      }

      const neckSegments: THREE.Mesh[] = [];
      for (let j = 1; j <= 5; j++) {
        const k = j / 6;
        const p: [number, number, number] = [
          last[0] * (1 - k),
          last[1] + (0.46 - last[1]) * Math.sin((k * Math.PI) / 2),
          last[2] + (-0.1 - last[2]) * k,
        ];
        neckSegments.push(addSphere(body, tr, p, [0.046, 0.046, 0.046], j % 2 ? mG1 : mG2, { seg: 8, rings: 6 }));
      }
      const headGroup = new THREE.Group();
      headGroup.position.set(0, 0.46, -0.1);
      body.add(headGroup);
      addSphere(headGroup, tr, [0, 0, 0], [0.066, 0.046, 0.086], mHead, { seg: 10, rings: 8 });
      for (const s of [-1, 1]) {
        addSphere(headGroup, tr, [s * 0.038, 0.02, -0.046], [0.015, 0.015, 0.011], mEye, { seg: 6, rings: 4 });
      }
      const tongueGroup = new THREE.Group();
      headGroup.add(tongueGroup);
      addBeam(tongueGroup, tr, [0, -0.01, -0.08], [0, -0.01, -0.17], 0.01, mTongue);
      addBeam(tongueGroup, tr, [0, -0.01, -0.17], [-0.02, -0.01, -0.2], 0.008, mTongue);
      addBeam(tongueGroup, tr, [0, -0.01, -0.17], [0.02, -0.01, -0.2], 0.008, mTongue);

      update = (t) => {
        const sway = Math.sin(t * 2) * 0.045;
        headGroup.position.x = sway;
        neckSegments.forEach((seg, idx) => {
          const k = (idx + 1) / 6;
          seg.position.x = last[0] + (sway - last[0]) * k;
        });
        tongueGroup.visible = Math.sin(t * 5) > 0.2;
      };
      break;
    }

    case 'altar': {
      const mSand = stdMat(tr, '#b3a68a', { roughness: 0.88 });
      const mDark = stdMat(tr, '#8f8269', { roughness: 0.92 });
      const mRune = stdMat(tr, '#4a4234', { roughness: 0.5 });
      const mCrystal = stdMat(tr, '#5a5a78', { roughness: 0.2, metalness: 0.15 });
      const mBeam = stdMat(tr, '#7df9ff', { glow: true, alpha: 0.15, two: true });
      const mSpark = stdMat(tr, '#e0fdff', { glow: true, alpha: 0.88 });

      addBox(body, tr, [0, 0, 0], [0.5, 0.06, 0.5], mDark);
      addBox(body, tr, [0, 0.06, 0], [0.4, 0.05, 0.4], mSand);
      addFrustum(body, tr, [0, 0.11, 0], 0.11, 0.09, 0.24, mSand, { seg: 8 });
      addBox(body, tr, [0, 0.35, 0], [0.3, 0.05, 0.3], mDark);

      for (let i = 0; i < 4; i++) {
        const rSide = new THREE.Group();
        rSide.rotation.y = (i * Math.PI) / 2;
        body.add(rSide);
        addBox(rSide, tr, [0, 0.07, -0.204], [0.14, 0.025, 0.008], mRune);
        addBox(rSide, tr, [0, 0.365, -0.154], [0.12, 0.02, 0.008], mRune);
      }

      const crystalGroup = new THREE.Group();
      crystalGroup.position.set(0, 0.5, 0);
      body.add(crystalGroup);
      addFrustum(crystalGroup, tr, [0, 0, 0], 0.075, 0, 0.13, mCrystal, { seg: 4 });
      addFrustum(crystalGroup, tr, [0, 0, 0], 0.075, 0, -0.1, mCrystal, { seg: 4 });

      const litFx = new THREE.Group();
      body.add(litFx);
      addFrustum(litFx, tr, [0, 0.4, 0], 0.17, 0.05, 0.68, mBeam, { seg: 12, openEnded: true });
      const sparks: THREE.Mesh[] = [];
      for (let i = 0; i < 6; i++) {
        sparks.push(addBox(litFx, tr, [0, 0.45, 0], [0.022, 0.022, 0.022], mSpark));
      }
      litFx.visible = false;

      let prevLit: boolean | undefined = undefined;
      update = (t, lit = false) => {
        if (lit !== prevLit) {
          prevLit = lit;
          if (lit) {
            mRune.color.set('#ffd35a');
            mRune.emissive.set('#ffd35a');
            mRune.emissiveIntensity = 1.4;
            mCrystal.color.set('#8ff6ff');
            mCrystal.emissive.set('#5eead4');
            mCrystal.emissiveIntensity = 1.1;
          } else {
            mRune.color.set('#4a4234');
            mRune.emissive.set('#000000');
            mRune.emissiveIntensity = 0;
            mCrystal.color.set('#5a5a78');
            mCrystal.emissive.set('#000000');
            mCrystal.emissiveIntensity = 0;
          }
          litFx.visible = lit;
        }
        crystalGroup.position.y = 0.5 + (lit ? 0.032 * Math.sin(t * 2.2) : 0);
        crystalGroup.rotation.y = lit ? t * 1.3 : 0.4;
        if (lit) {
          sparks.forEach((sp, i) => {
            const k = (t * 0.4 + i / 6) % 1;
            const a = i * 2.3 + t * 1.5;
            sp.position.set(Math.cos(a) * 0.14, 0.42 + k * 0.46, Math.sin(a) * 0.14);
            sp.scale.setScalar(Math.max(0.15, 1 - k));
          });
        }
      };
      break;
    }

    case 'chest':
    case 'chestOpen': {
      const open = id === 'chestOpen';
      const mWood = stdMat(tr, '#8b5a2b', { roughness: 0.78 });
      const mWoodLid = stdMat(tr, '#9c6631', { roughness: 0.75 });
      const mGold = stdMat(tr, '#d4a017', { roughness: 0.26, metalness: 0.85 });
      const mLock = stdMat(tr, '#f1c40f', { roughness: 0.2, metalness: 0.9 });
      addBox(body, tr, [0, 0, 0], [0.5, 0.24, 0.32], mWood);
      for (const s of [-1, 1]) addBox(body, tr, [s * 0.17, 0, 0], [0.05, 0.245, 0.33], mGold);
      if (open) {
        const mCoins = stdMat(tr, '#f5c542', { roughness: 0.25, metalness: 0.8, glow: true });
        const mRuby = stdMat(tr, '#e74c3c', { roughness: 0.15, glow: true });
        addSphere(body, tr, [0, 0.2, 0], [0.22, 0.08, 0.13], mCoins, { seg: 12, rings: 6, half: true });
        addSphere(body, tr, [0.08, 0.27, -0.03], [0.032, 0.042, 0.032], mRuby, { seg: 8, rings: 6 });
      }
      const lidPivot = new THREE.Group();
      lidPivot.position.set(0, 0.24, 0.16);
      body.add(lidPivot);
      addBox(lidPivot, tr, [0, 0, -0.16], [0.5, 0.1, 0.32], mWoodLid);
      for (const s of [-1, 1]) addBox(lidPivot, tr, [s * 0.17, 0, -0.16], [0.05, 0.105, 0.33], mGold);
      addBox(lidPivot, tr, [0, -0.04, -0.325], [0.07, 0.09, 0.02], mLock);
      if (open) lidPivot.rotation.x = 1.65;
      break;
    }

    case 'potion': {
      const mLiquid = stdMat(tr, '#e0294a', { roughness: 0.15, glow: true });
      const mGlass = stdMat(tr, '#cfe8ff', { roughness: 0.1, metalness: 0.1, alpha: 0.38 });
      const mCork = stdMat(tr, '#a0703a', { roughness: 0.9 });
      const mGlint = stdMat(tr, '#ffffff', { glow: true, alpha: 0.85 });
      const bob = new THREE.Group();
      body.add(bob);
      addSphere(bob, tr, [0, 0.12, 0], [0.085, 0.075, 0.085], mLiquid, { seg: 12, rings: 8 });
      addSphere(bob, tr, [0, 0.13, 0], [0.11, 0.11, 0.11], mGlass, { seg: 14, rings: 10 });
      addFrustum(bob, tr, [0, 0.22, 0], 0.04, 0.035, 0.07, mGlass, { seg: 10 });
      addBox(bob, tr, [0, 0.285, 0], [0.06, 0.045, 0.06], mCork);
      addSphere(bob, tr, [-0.04, 0.17, -0.092], [0.015, 0.03, 0.01], mGlint, { seg: 6, rings: 4 });
      update = (t) => {
        bob.position.y = 0.02 + 0.025 * Math.sin(t * 2.2);
        bob.rotation.y = t * 1.1;
      };
      break;
    }

    case 'key': {
      const mGold = stdMat(tr, '#f1c40f', { roughness: 0.22, metalness: 0.92 });
      const bob = new THREE.Group();
      body.add(bob);
      const n = 12;
      const cx = -0.1;
      const r = 0.055;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        addBeam(bob, tr, [cx + Math.cos(a0) * r, 0.16 + Math.sin(a0) * r, 0], [cx + Math.cos(a1) * r, 0.16 + Math.sin(a1) * r, 0], 0.024, mGold);
      }
      addBeam(bob, tr, [cx + r, 0.16, 0], [0.17, 0.16, 0], 0.028, mGold);
      addBeam(bob, tr, [0.11, 0.16, 0], [0.11, 0.105, 0], 0.024, mGold);
      addBeam(bob, tr, [0.155, 0.16, 0], [0.155, 0.115, 0], 0.024, mGold);
      update = (t) => {
        bob.position.y = 0.025 * Math.sin(t * 2.5);
        bob.rotation.y = t * 1.4;
      };
      break;
    }

    case 'spikes': {
      const mBase = stdMat(tr, '#3d4048', { roughness: 0.72, metalness: 0.5 });
      const mHole = stdMat(tr, '#121316', { roughness: 0.95 });
      const mSteel = stdMat(tr, '#cfd6dd', { roughness: 0.2, metalness: 0.9 });
      addBox(body, tr, [0, 0, 0], [0.62, 0.035, 0.62], mBase);
      const spikes: THREE.Mesh[] = [];
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          addBox(body, tr, [i * 0.18, 0.035, j * 0.18], [0.07, 0.004, 0.07], mHole);
          const sp = addFrustum(body, tr, [i * 0.18, 0.035, j * 0.18], 0.032, 0, 0.26, mSteel, { seg: 6 });
          spikes.push(sp);
        }
      }
      update = (t) => {
        const e = Math.pow(Math.max(0, Math.sin(t * 2.2)), 0.4);
        const s = 0.1 + 0.9 * e;
        spikes.forEach((sp) => {
          sp.scale.y = s;
          sp.position.y = 0.035 + 0.13 * s;
        });
      };
      break;
    }

    case 'teleport': {
      const mPurple = stdMat(tr, '#a855f7', { glow: true });
      const mLight = stdMat(tr, '#e9d5ff', { glow: true });
      const mBeam = stdMat(tr, '#a855f7', { glow: true, alpha: 0.16, two: true });
      const mSpark = stdMat(tr, '#f5e8ff', { glow: true, alpha: 0.9 });

      const outerRing = new THREE.Group();
      const innerRing = new THREE.Group();
      body.add(outerRing, innerRing);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        addBox(outerRing, tr, [Math.cos(a) * 0.33, 0, Math.sin(a) * 0.33], [0.05, 0.02, 0.05], mPurple);
      }
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        addBox(innerRing, tr, [Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2], [0.035, 0.015, 0.035], mLight);
      }
      addFrustum(body, tr, [0, 0, 0], 0.32, 0.26, 0.85, mBeam, { seg: 16, openEnded: true });
      const sparks: THREE.Mesh[] = [];
      for (let i = 0; i < 8; i++) {
        sparks.push(addBox(body, tr, [0, 0.2, 0], [0.025, 0.025, 0.025], mSpark));
      }

      update = (t) => {
        outerRing.rotation.y = t * 0.8;
        innerRing.rotation.y = -t * 1.2;
        sparks.forEach((sp, i) => {
          const k = (t * 0.35 + i / 8) % 1;
          const a = i * 2.4 + t;
          sp.position.set(Math.cos(a) * 0.18, k * 0.8, Math.sin(a) * 0.18);
          sp.scale.setScalar(Math.max(0.15, 1 - k));
        });
      };
      break;
    }
  }

  return {
    group,
    update,
    dispose: () => {
      tr.geos.forEach((g) => g.dispose());
      tr.mats.forEach((m) => m.dispose());
    },
  };
}
